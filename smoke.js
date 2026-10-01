// Prueba de humo: `node smoke.js`. Abre la app, graba unos segundos con zoom, clic simulado, silencio y teleprompter, y comprueba el mp4 con ffprobe.
const { spawn, execFileSync } = require('child_process');
const assert = require('assert');

const script = `(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(3000);
  console.log('SMOKE screen', screenVideo?.videoWidth + 'x' + screenVideo?.videoHeight, 'cam', camVideo?.videoWidth || 0, 'mic', !!micStream);
  api.invoke('open-prompter');
  hotkey('toggle-record');
  await wait(5000);          // 3 s de cuenta atrás + 2 s grabando
  hotkey('zoom-in');
  await wait(1500);
  hotkey('zoom-out');
  onClick({ x: .3, y: .3 });   // clic global simulado: resaltado + zoom automático
  hotkey('toggle-mute'); hotkey('toggle-mute');
  hotkey('toggle-pause'); await wait(500); hotkey('toggle-pause');
  hotkey('tp-toggle');
  await wait(1500);
  hotkey('toggle-record');
  while (!document.getElementById('status').textContent.startsWith('Guardado')) await wait(200);
  console.log('SMOKE done');
})()`;

const p = spawn(require('electron'), ['.'], { env: { ...process.env, LOOM_SMOKE: script } });
let out = '', saved;
p.stdout.on('data', d => {
  out += d; process.stdout.write(d);
  const m = out.match(/Guardado (.+\.(mp4|webm))/);
  if (m) saved = m[1].trim();
  if (out.includes('SMOKE done')) p.kill();
});
p.stderr.on('data', d => process.stdout.write('[stderr] ' + d));
const timer = setTimeout(() => { console.log('TIMEOUT'); p.kill(); }, 40000);

p.on('close', () => {
  clearTimeout(timer);
  assert(!/Error:/.test(out), 'hubo errores en la app');
  assert(/SMOKE screen \d+x\d+/.test(out), 'la pantalla no se capturó');
  assert(saved && saved.endsWith('.mp4'), 'no hay mp4: ' + saved);
  const info = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate', '-of', 'csv=p=0', saved]).toString();
  console.log('ffprobe:', info.trim());
  assert(info.includes('h264,1920,1080,30/1'), 'el mp4 no es 1080p30 h264');
  console.log('OK');
});
