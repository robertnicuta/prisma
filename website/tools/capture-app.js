// Reproducible portfolio screenshots of Prisma's real Electron UI.
// The isolated harness blocks screen/camera/microphone capture and connections.
// Only studio-demo.png uses a generated public canvas source, clearly labelled.
const { app, BrowserWindow, ipcMain, session } = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
const output = path.join(root, 'website', 'assets', 'screenshots');
const profile = path.join(root, 'test-output', 'website-capture-profile-' + process.pid);
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(profile, { recursive: true });
fs.writeFileSync(path.join(profile, 'transcription-settings.json'), JSON.stringify({ engine: 'builtin', url: 'http://127.0.0.1:8001', model: '' }));
app.setPath('userData', profile);
app.setPath('sessionData', profile);
app.setAppPath(root);
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.on('browser-window-created', (_, w) => w.hide());
require(path.join(root, 'main'));
// Replace the device inventory only in this harness. No application code changes.
ipcMain.removeHandler('sources');
ipcMain.handle('sources', () => [{ id: '', name: 'Ninguna pantalla seleccionada' }]);
ipcMain.removeHandler('select-source');
ipcMain.handle('select-source', () => null);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const manifest = [];
const timer = setTimeout(() => { console.error('Portfolio capture timed out'); app.exit(1); }, 90000);
async function capture(w, filename, description) {
  w.showInactive();
  await wait(400);
  const image = await w.webContents.capturePage();
  w.hide();
  assert(!image.isEmpty(), 'Empty capture: ' + filename);
  fs.writeFileSync(path.join(output, filename), image.toPNG());
  manifest.push({ filename, description, width: image.getSize().width, height: image.getSize().height });
  console.log('Captured', filename, image.getSize());
}
async function findWindow(file) {
  for (let i = 0; i < 100; i++) {
    const w = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().endsWith('/' + file));
    if (w && !w.webContents.isLoading()) return w;
    await wait(100);
  }
  throw new Error('Window did not load: ' + file);
}
app.whenReady().then(async () => {
  // These handlers deny media before the application's init() is invoked.
  session.defaultSession.setDisplayMediaRequestHandler((_, callback) => callback({}));
  session.defaultSession.setPermissionRequestHandler((_, permission, callback) => callback(!['media', 'display-capture'].includes(permission)));
  try {
    const main = await findWindow('index.html');
    await wait(1000);
    main.hide();
    main.setContentSize(1360, 900);
    const execute = code => main.webContents.executeJavaScript(code, true);
    await execute(`
      stop(screenVideo); stop(camVideo); screenVideo = camVideo = null;
      micStream?.getTracks().forEach(t => t.stop()); micNode?.disconnect(); micStream = null;
      sysNode?.disconnect(); sysNode = null;
      cfg.mode = 'both'; cfg.cam = cfg.mic = cfg.src = ''; cfg.dir = 'C:\\\\Prisma\\\\Grabaciones'; muted = false;
      document.querySelector('[data-k="mode"]').value = 'both'; $('cam').value = $('mic').value = $('src').value = '';
      $('dir').textContent = cfg.dir; status('Listo'); ui(); fitCanvas();
    `);
    assert(await execute(`state === 'idle' && !screenVideo && !camVideo && !micStream && !vdoToken && !mobileLink`), 'Expected a private, disconnected, idle studio');
    await execute(`openStudio(); selectSettings('sources')`);
    await capture(main, 'studio.png', 'Real Prisma studio; no screen, camera, microphone, phone, or recording connected.');
    await execute(`selectSettings('appearance')`);
    await capture(main, 'appearance.png', 'Real image quality and camera bubble appearance controls.');
    await execute(`selectSettings('advanced')`);
    await capture(main, 'recording.png', 'Real zoom, click highlighting, countdown, and save controls; idle.');
    await execute(`$('navMobile').click()`);
    await wait(650);
    assert(await execute(`!vdoToken && !mobileLink && $('vdoSend').hidden`), 'Phone must stay disconnected');
    await capture(main, 'mobile.png', 'Real mobile connection panel; no link generated and no stream connected.');
    await execute(`selectSettings('sources'); openTranscript()`);
    assert(await execute(`$('transcriptEngine').value === 'builtin' && !$('transcriptionPanel').hidden && !$('transcriptText').value`));
    await capture(main, 'transcript.png', 'Real Whisper integrated transcription panel; empty, no fabricated transcription.');
    await execute(`$('navHelp').click()`);
    await capture(main, 'shortcuts.png', 'Real global keyboard shortcuts and privacy note.');
    await execute(`openStudio(); selectSettings('sources')`);
    const widget = await findWindow('widget.html');
    widget.hide();
    await capture(widget, 'widget.png', 'Real compact floating widget; idle with no camera attached.');
    await widget.webContents.executeJavaScript(`$('settings').click()`, true);
    await capture(widget, 'widget-settings.png', 'Real floating widget settings; no private source or phone link.');
    await execute(`$('tp').click()`);
    const teleprompter = await findWindow('teleprompter.html');
    teleprompter.hide();
    await teleprompter.webContents.executeJavaScript(`
      cfg.text = 'GUION DE DEMOSTRACIÓN\\n\\nHola, esto es Prisma.\\n\\nGraba tu pantalla y explica tu próxima gran idea.\\n\\nPrepara tus fuentes, ajusta el aspecto y comunica a tu ritmo.\\n\\nTodo empieza con una toma.';
      cfg.font = 28; cfg.opacity = 1; apply(); edit(false);
    `, true);
    await capture(teleprompter, 'teleprompter.png', 'Real teleprompter with an authored public demonstration script.');
    // A public canvas presentation is passed through the actual app preview.
    await execute(`
      const demo = document.createElement('canvas'); demo.width = 1600; demo.height = 900;
      const d = demo.getContext('2d');
      const gradient = d.createLinearGradient(0, 0, 1600, 900);
      gradient.addColorStop(0, '#201c43'); gradient.addColorStop(.65, '#131829'); gradient.addColorStop(1, '#1f2344');
      d.fillStyle = gradient; d.fillRect(0, 0, 1600, 900);
      d.fillStyle = '#bcb0ff'; d.font = '600 22px Segoe UI'; d.fillText('PRISMA  /  DEMOSTRACIÓN', 100, 105);
      d.fillStyle = '#f4f0ff'; d.font = '600 88px Segoe UI'; d.fillText('Tu próxima', 100, 270); d.fillText('gran idea.', 100, 370);
      d.fillStyle = '#b9b5d2'; d.font = '30px Segoe UI'; d.fillText('Dale voz. Dale forma. Dale al play.', 100, 460);
      const cards = [['01', 'Comunicar', 'Explica lo que importa.'], ['02', 'Grabar', 'Una idea, una toma.'], ['03', 'Compartir', 'Haz que se entienda.']];
      cards.forEach((card, i) => {
        const x = 100 + i * 476;
        d.fillStyle = '#b2a2ff15'; d.beginPath(); d.roundRect(x, 610, 440, 190, 24); d.fill();
        d.strokeStyle = '#b5a6ff40'; d.lineWidth = 2; d.stroke();
        d.fillStyle = '#b5a6ff'; d.font = '600 21px Segoe UI'; d.fillText(card[0], x + 28, 655);
        d.fillStyle = '#f4f0ff'; d.font = '600 34px Segoe UI'; d.fillText(card[1], x + 28, 714);
        d.fillStyle = '#b9b5d2'; d.font = '24px Segoe UI'; d.fillText(card[2], x + 28, 757);
      });
      screenVideo = vid(demo.captureStream(15));
      fill($('src'), [{ id: 'demo-public', name: 'Presentación pública · Demo' }], 'demo-public'); cfg.src = 'demo-public';
      cfg.mode = 'screen'; cfg.bg = 'purple'; document.querySelector('[data-k="mode"]').value = 'screen';
      document.querySelector('[data-k="bg"]').value = 'purple'; ui(); fitCanvas();
    `);
    await wait(600);
    assert(await execute(`screenVideo?.videoWidth === 1600 && !camVideo && !micStream && state === 'idle' && !vdoToken`));
    await capture(main, 'studio-demo.png', 'Real Prisma UI previewing an authored public canvas presentation labelled DEMOSTRACIÓN; idle, no real screen/camera/recording.');
    await execute(`stop(screenVideo); screenVideo = null`);
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ application: 'Prisma', method: 'Electron BrowserWindow.webContents.capturePage', profile: 'isolated', privateMediaCaptured: false, screenshots: manifest }, null, 2));
    console.log('Portfolio screenshots OK: real app UI, isolated profile, all media blocked, no recording or phone stream.');
    clearTimeout(timer);
    app.quit();
  } catch (error) {
    console.error(error);
    clearTimeout(timer);
    app.exit(1);
  }
});
