const { app, BrowserWindow, ipcMain, desktopCapturer, globalShortcut, screen, session, shell, dialog, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { viewerURL } = require('./vdo-url');
const transcription = require('./transcription');
const speaches = require('./speaches');
const brand = require('./brand');
const inheritedUserData=app.getPath('userData');
const usingDefaultData=path.resolve(inheritedUserData).toLowerCase()===path.resolve(app.getPath('appData'),app.getName()).toLowerCase();
const existingUserData=usingDefaultData?path.join(app.getPath('appData'),'loom-local'):inheritedUserData;
app.setName(brand.name);app.setPath('userData',existingUserData);app.setPath('sessionData',existingUserData);
const transcriptionSettingsFile = () => path.join(app.getPath('userData'), 'transcription-settings.json');
let transcriptionSettings = {engine:'speaches',url:'http://127.0.0.1:8001',model:'Systran/faster-whisper-small'};

app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.setAppUserModelId(brand.appId);

let main, prompter, tray, sourceId, captureBounds, ws;
let vdoWindow, vdoToken = 0;
let widget, lastRecording, transcriptionJob, setupJob;
let recordingState = { state: 'idle', elapsed: 0, muted: false, message: 'Listo' };
const preload = path.join(__dirname, 'preload.js');
const icon = path.join(__dirname, 'icon.ico');
const clamp = v => Math.min(1, Math.max(0, v));
// pantallas primero: el orden de getSources no es fijo
const sources = async () => (await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } }))
  .sort((a, b) => b.id.startsWith('screen') - a.id.startsWith('screen'));

const HOTKEYS = {
  'CommandOrControl+Shift+R': 'toggle-record',
  'CommandOrControl+Shift+P': 'toggle-pause',
  'CommandOrControl+Shift+M': 'toggle-mute',
  'CommandOrControl+Shift+Z': 'zoom-in',
  'CommandOrControl+Shift+X': 'zoom-out',
  'CommandOrControl+Shift+W': 'toggle-widget',
  'CommandOrControl+Shift+Space': 'tp-toggle',
  'CommandOrControl+Shift+Up': 'tp-faster',
  'CommandOrControl+Shift+Down': 'tp-slower',
};

function win(file, opts) {
  const w = new BrowserWindow({ icon, ...opts, webPreferences: { preload, backgroundThrottling: false } });
  w.setContentProtection(true); // Windows la excluye de cualquier captura: no sale en el vídeo
  w.webContents.on('console-message', ev => console.log(`[${file}]`, ev.message));
  w.loadFile(file);
  return w;
}

// ponytail: los atajos entran como "gesto de usuario" (executeJavaScript userGesture=true)
// porque getDisplayMedia exige uno.
function hotkey(name) {
  if (name === 'toggle-widget') return toggleWidget();
  for (const w of [main, prompter])
    if (w && !w.isDestroyed()) w.webContents.executeJavaScript(`hotkey(${JSON.stringify(name)})`, true).catch(() => {});
}

function showMain() { main.show(); if (main.isMinimized()) main.restore(); main.focus(); }
function openWidget() {
  if (!widget || widget.isDestroyed()) {
    const b = screen.getPrimaryDisplay().workArea;
    widget = win('widget.html', { width: 840, height: 104, x: b.x + Math.round((b.width - 840) / 2), y: b.y + b.height - 124,
      frame: false, transparent: true, resizable: false, maximizable: false, alwaysOnTop: true, skipTaskbar: true, show: false });
    widget.setAlwaysOnTop(true, 'screen-saver');
    widget.on('close', e => { if (!app.isQuitting) { e.preventDefault(); widget.hide(); } });
    for (const event of ['show','hide']) widget.on(event, () => main.webContents.send('widget-visible', widget.isVisible()));
  }
  widget.showInactive();
}
function toggleWidget() { if (widget?.isVisible()) widget.hide(); else openWidget(); }

// cursor normalizado 0..1 dentro de la pantalla grabada (evita líos de DPI)
function cursorNorm() {
  const p = screen.getCursorScreenPoint();
  const b = captureBounds || screen.getDisplayNearestPoint(p).bounds;
  return { x: clamp((p.x - b.x) / b.width), y: clamp((p.y - b.y) / b.height) };
}

// ponytail: PowerShell + GetAsyncKeyState hace de hook global de clics, sin dependencias nativas.
// Latencia ~16-30 ms. Si molesta, cambiar por uiohook-napi.
function watchClicks() {
  const ps = `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern short GetAsyncKeyState(int k);' -Name K -Namespace W
$o=[Console]::Out;$last=0;$i=0
while($true){
$d=[W.K]::GetAsyncKeyState(1) -band 0x8000
if($d -and -not $last){$o.WriteLine('L');$o.Flush()}
$last=$d
$i++
if(($i % 60) -eq 0 -and -not (Get-Process -Id ${process.pid} -ErrorAction SilentlyContinue)){exit}
Start-Sleep -Milliseconds 16}`;
  const p = spawn('powershell', ['-NoProfile', '-EncodedCommand', Buffer.from(ps, 'utf16le').toString('base64')], { windowsHide: true });
  p.stdout.on('data', d => {
    if (!main || main.isDestroyed()) return;
    for (const _ of String(d).match(/L/g) || []) main.webContents.send('click', cursorNorm());
  });
  p.on('error', () => {});
  app.on('will-quit', () => p.kill());
}

function stamp() { return new Date().toISOString().slice(0, 23).replace(/[-:.]/g, '').replace('T', '-'); }

function toMp4(webm, fps) {
  const mp4 = webm.replace(/\.webm$/, '.mp4');
  return new Promise(resolve => {
    const p = spawn('ffmpeg', ['-y', '-i', webm, '-r', String(fps), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', mp4]);
    p.on('error', () => resolve(webm)); // sin ffmpeg en el PATH: se queda el webm
    p.on('close', code => { if (code === 0) { fs.unlinkSync(webm); resolve(mp4); } else resolve(webm); });
  });
}

app.whenReady().then(() => {
  try { transcriptionSettings = {...transcriptionSettings,...JSON.parse(fs.readFileSync(transcriptionSettingsFile(),'utf8'))}; } catch(_) {}
  const work=screen.getPrimaryDisplay().workArea;
  main = win('index.html', { width:Math.min(1280,work.width-40),height:Math.min(860,work.height-40),minWidth:940,minHeight:620,title:brand.name,backgroundColor:'#11141c' });
  main.webContents.on('did-finish-load', async () => {
    await main.webContents.executeJavaScript('init()', true);
    if (process.env.LOOM_SMOKE) main.webContents.executeJavaScript(process.env.LOOM_SMOKE, true); // ver smoke.js
    openWidget();
  });
  main.on('closed', () => app.quit());

  session.defaultSession.setDisplayMediaRequestHandler(async (req, cb) => {
    const list = await sources();
    const video = list.find(s => s.id === sourceId) || list[0];
    cb(req.audioRequested ? { video, audio: 'loopback' } : { video });
  });

  for (const [key, name] of Object.entries(HOTKEYS)) globalShortcut.register(key, () => hotkey(name));
  setInterval(() => main && !main.isDestroyed() && main.webContents.send('cursor', cursorNorm()), 33);
  watchClicks();

  tray = new Tray(icon);
  tray.setToolTip(brand.name);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Grabar / Parar   (Ctrl+Shift+R)', click: () => hotkey('toggle-record') },
    { label: 'Mostrar ventana', click: () => main.show() },
    { label: 'Mostrar / ocultar widget   (Ctrl+Shift+W)', click: toggleWidget },
    { type: 'separator' },
    { label: 'Salir', click: () => app.quit() },
  ]));
  tray.on('click', () => main.show());
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('before-quit', () => { app.isQuitting = true; transcriptionJob?.cancel(); setupJob?.kill(); });
app.on('window-all-closed', () => app.quit());

ipcMain.on('rec-state', (event, value) => {
  if (event.sender !== main.webContents) return;
  recordingState = value;
  if (widget && !widget.isDestroyed()) widget.webContents.send('widget-state', value);
});
ipcMain.on('widget-camera', (event, image) => {
  if (event.sender === main.webContents && widget?.isVisible()) widget.webContents.send('widget-camera', image);
});
ipcMain.handle('widget-state', () => recordingState);
ipcMain.handle('open-widget', (event, compact) => {
  if (event.sender !== main.webContents) return;
  openWidget(); if (compact) main.hide();
});
ipcMain.handle('widget-expand', (event, expanded) => {
  if (event.sender !== widget?.webContents) return;
  const bounds=widget.getBounds(), area=screen.getDisplayMatching(bounds).workArea;
  const height=expanded?Math.min(658,area.height-20):104;
  widget.setBounds({...bounds,height,y:Math.max(area.y+10,Math.min(bounds.y+bounds.height-height,area.y+area.height-height-10))});
});
ipcMain.handle('widget-action', (event, action, value) => {
  if (event.sender !== widget?.webContents) return;
  if (action === 'hide') widget.hide();
  else if (action === 'settings') showMain();
  else if (action === 'transcribe') { showMain(); hotkey('transcribe'); }
  else if (action === 'mobile') {showMain(); main.webContents.executeJavaScript(`document.getElementById('vdoPanel').scrollIntoView({behavior:'smooth'})`);}
  else if (action === 'prompter') main.webContents.executeJavaScript(`document.getElementById('tp').click()`,true);
  else if (['toggle-record','toggle-pause','toggle-mute','zoom-in','zoom-out'].includes(action)) hotkey(action);
  else if (['configure','control','discard','toggle-camera'].includes(action))
    return main.webContents.executeJavaScript(`widgetAction(${JSON.stringify(action)},${JSON.stringify(value??null)})`,true);
});

ipcMain.handle('transcription-status', async () => {
  let models = [], error;
  if (transcriptionSettings.engine === 'speaches') try { models = await speaches.models(transcriptionSettings.url); } catch(e) {error=e.message;}
  return {ready:transcriptionSettings.engine === 'speaches' ? models.includes(transcriptionSettings.model) : transcription.ready(),
    settings:transcriptionSettings, models, error, busy:!!transcriptionJob || !!setupJob, file:lastRecording};
});
ipcMain.handle('transcription-settings', (event, settings) => {
  if (![main.webContents,widget?.webContents].includes(event.sender) || transcriptionJob || setupJob) throw new Error('No se puede cambiar la configuración ahora.');
  if (!['speaches','builtin'].includes(settings.engine)) throw new Error('Motor no válido.');
  transcriptionSettings = {engine:settings.engine,url:speaches.localURL(settings.url),model:String(settings.model || '')};
  fs.mkdirSync(app.getPath('userData'),{recursive:true}); fs.writeFileSync(transcriptionSettingsFile(),JSON.stringify(transcriptionSettings));
});
ipcMain.handle('transcription-prepare', event => {
  if (![main.webContents,widget?.webContents].includes(event.sender)) throw new Error('Origen no autorizado');
  if (setupJob || transcriptionJob) throw new Error('Ya hay una tarea de transcripción en curso.');
  return new Promise((resolve,reject) => {
    setupJob = spawn('powershell', ['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'setup-transcription.ps1')], {windowsHide:true});
    let tail = '';
    for (const stream of [setupJob.stdout,setupJob.stderr]) stream.on('data', data => {
      tail = (tail + data).slice(-2000);
      main.webContents.send('transcription-progress', {message:'Preparando el motor local y descargando el modelo…'});
    });
    setupJob.on('error', e => { setupJob = null; reject(e); });
    setupJob.on('close', code => { setupJob = null; code === 0 && transcription.ready() ? resolve(true) : reject(new Error(tail || 'No se pudo preparar el motor local.')); });
  });
});
ipcMain.handle('transcription-start', async (event, {choose = false, language = 'auto'} = {}) => {
  if (![main.webContents,widget?.webContents].includes(event.sender)) throw new Error('Origen no autorizado');
  if (transcriptionJob || setupJob) throw new Error('Ya hay una tarea de transcripción en curso.');
  if (recordingState.state !== 'idle') throw new Error('Termina de guardar la grabación antes de transcribir.');
  let file = lastRecording;
  if (choose || !file) {
    const result = await dialog.showOpenDialog(main, {title:'Elegir grabación para transcribir', properties:['openFile'],
      filters:[{name:'Vídeo o audio', extensions:['mp4','webm','mkv','mov','wav','mp3','m4a','ogg']}]});
    if (result.canceled) return null;
    file = result.filePaths[0];
  }
  if (transcriptionJob || setupJob) throw new Error('Ya hay una tarea de transcripción en curso.');
  const progress=info=>{main.webContents.send('transcription-progress',info);if(widget&&!widget.isDestroyed())widget.webContents.send('transcription-progress',info);};
  const job = transcriptionJob = transcriptionSettings.engine === 'speaches'
    ? speaches.transcribe(file,language,transcriptionSettings,progress)
    : transcription.transcribe(file, language, percent => progress({percent}));
  try { return await job.promise; } finally { if (transcriptionJob === job) transcriptionJob = null; }
});
ipcMain.handle('transcription-cancel', event => {
  if ([main.webContents,widget?.webContents].includes(event.sender)) transcriptionJob?.cancel();
});

ipcMain.handle('vdo-connect', async (event, input) => {
  if (event.sender !== main.webContents) throw new Error('Origen no autorizado');
  const url = viewerURL(input);
  vdoWindow?.destroy();
  const token = ++vdoToken;
  const receiver = new BrowserWindow({ show: false, webPreferences: {
    preload: path.join(__dirname, 'vdo-preload.js'), contextIsolation: true,
    nodeIntegration: false, sandbox: true, backgroundThrottling: false,
    partition: 'vdo-receiver', autoplayPolicy: 'no-user-gesture-required'
  } });
  vdoWindow = receiver;
  receiver.setContentProtection(true);
  receiver.webContents.session.setPermissionRequestHandler((_, __, callback) => callback(false));
  receiver.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  receiver.webContents.on('will-navigate', (event, target) => {
    if (new URL(target).origin !== 'https://vdo.ninja') event.preventDefault();
  });
  receiver.webContents.on('did-finish-load', () => receiver.webContents.send('vdo-start'));
  receiver.webContents.on('did-fail-load', (_, code, message, __, isMainFrame) => {
    if (isMainFrame && code !== -3) main.webContents.send('vdo-signal', { token, type: 'error', message });
  });
  receiver.on('closed', () => {
    if (vdoWindow === receiver) {
      vdoWindow = null;
      if (main && !main.isDestroyed()) main.webContents.send('vdo-signal', { token, type: 'closed' });
    }
  });
  // Return the token before loading so signals cannot race the renderer setup.
  setImmediate(() => receiver.loadURL(url).catch(() => {}));
  return token;
});
ipcMain.on('vdo-signal', (event, packet) => {
  if (!packet || typeof packet !== 'object' || !vdoWindow) return;
  if (event.sender === vdoWindow.webContents) main.webContents.send('vdo-signal', { ...packet, token: vdoToken });
  else if (event.sender === main.webContents && packet.token === vdoToken && ['answer', 'ice'].includes(packet.type))
    vdoWindow.webContents.send('vdo-signal', packet);
});
ipcMain.handle('vdo-disconnect', event => {
  if (event.sender === main.webContents) { vdoWindow?.destroy(); vdoWindow = null; }
});
ipcMain.handle('copy-text', (event, value) => {
  if ([main.webContents,widget?.webContents].includes(event.sender)) require('electron').clipboard.writeText(String(value));
});

ipcMain.handle('sources', async () => (await sources()).map(s => ({ id: s.id, name: s.name })));

ipcMain.handle('select-source', async (_, id) => {
  sourceId = id;
  const src = (await sources()).find(s => s.id === id && id.startsWith('screen'));
  const disp = src && screen.getAllDisplays().find(d => String(d.id) === src.display_id);
  captureBounds = disp ? disp.bounds : null; // ponytail: si es una ventana, se usa la pantalla del cursor
});

// ventana transparente a pantalla completa para arrastrar un rectángulo
ipcMain.handle('pick-area', () => new Promise(resolve => {
  const b = captureBounds || screen.getPrimaryDisplay().bounds;
  const o = new BrowserWindow({ ...b, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true, resizable: false, hasShadow: false, webPreferences: { preload } });
  o.setAlwaysOnTop(true, 'screen-saver');
  o.loadFile('overlay.html');
  const onArea = (_, r) => { resolve(r); o.close(); };
  ipcMain.once('area', onArea);
  o.on('closed', () => { ipcMain.removeListener('area', onArea); resolve(null); });
}));

ipcMain.handle('default-dir', () => path.join(app.getPath('videos'), brand.name));
ipcMain.handle('choose-dir', async () => (await dialog.showOpenDialog(main, { properties: ['openDirectory'] })).filePaths[0] || null);
ipcMain.handle('open-dir', (_, d) => { fs.mkdirSync(d, { recursive: true }); shell.openPath(d); });
ipcMain.handle('on-top', (_, v) => main.setAlwaysOnTop(v, 'screen-saver'));
ipcMain.handle('show-file', (_, f) => shell.showItemInFolder(f));

ipcMain.handle('rec-start', (_, dir) => {
  fs.mkdirSync(dir, { recursive: true });
  ws = fs.createWriteStream(path.join(dir, `loom-${stamp()}.webm`));
  return ws.path;
});
ipcMain.on('rec-chunk', (_, buf) => ws && ws.write(Buffer.from(buf)));
ipcMain.handle('rec-finish', async (_, fps) => {
  const f = ws.path;
  await new Promise(r => ws.end(r));
  ws = null;
  lastRecording = await toMp4(f, fps);
  return lastRecording;
});
ipcMain.handle('rec-cancel', async () => {
  if (!ws) return;
  const f = ws.path;
  await new Promise(r => ws.end(r));
  ws = null;
  fs.rmSync(f, { force: true });
});

ipcMain.handle('open-prompter', () => {
  if (prompter && !prompter.isDestroyed()) return prompter.focus();
  prompter = win('teleprompter.html', { width: 600, height: 340, minWidth: 320, minHeight: 180, frame: false, alwaysOnTop: true, skipTaskbar: true });
  prompter.setAlwaysOnTop(true, 'screen-saver');
  prompter.on('closed', () => prompter = null);
});
ipcMain.handle('tp-opacity', (_, v) => prompter && !prompter.isDestroyed() && prompter.setOpacity(v));
