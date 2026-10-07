// Run the actual unpacked Windows application, from a different working directory.
// The Node process is only a development test runner. The packaged child receives
// a PATH with no Python, Node, or ffmpeg and records a public canvas source only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repository = path.resolve(__dirname, '..');
const executable = path.resolve(process.argv[2] || path.join(repository, 'release', 'win-unpacked', 'Prisma.exe'));
if (!fs.existsSync(executable)) {
  console.error('Build Prisma first. Packaged application not found: ' + executable);
  process.exit(1);
}
const output = path.join(repository, 'test-output', 'packaged-smoke-' + Date.now() + '-' + process.pid);
const profile = path.join(output, 'user-data');
const foreignWorkingDirectory = path.join(output, 'foreign-working-directory');
for (const directory of [profile, foreignWorkingDirectory]) fs.mkdirSync(directory, { recursive: true });

// Nothing from the development installation is on the packaged child's PATH.
const windows = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';
const childPath = [path.join(windows, 'System32'), path.join(windows, 'System32', 'Wbem'), path.join(windows, 'System32', 'WindowsPowerShell', 'v1.0')];
const externalRuntimeExecutables = ['python.exe', 'python3.exe', 'node.exe', 'ffmpeg.exe'].flatMap(name => childPath.map(directory => path.join(directory, name)).filter(candidate => fs.existsSync(candidate)));
assert.equal(externalRuntimeExecutables.length, 0, 'Test PATH unexpectedly exposes an external runtime');

const rendererScript = `
(async () => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const until = async (predicate, message, timeout = 15000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await predicate()) return; await wait(50); }
    throw new Error(message);
  };
  const results = { source: 'public synthetic canvas', steps: [] };
  let animation;
  try {
    // The main smoke hook must pass skipMedia to init(), before this script runs.
    check(!screenVideo && !camVideo && !micStream, 'Startup captured a private media source. Expected init({skipMedia:true}).');
    stop(screenVideo); stop(camVideo); screenVideo = camVideo = null;
    micStream?.getTracks().forEach(track => track.stop()); micNode?.disconnect(); micStream = null; micNode = null;
    sysNode?.disconnect(); sysNode = null;
    cfg.mode = 'screen'; cfg.cam = cfg.mic = ''; cfg.camShow = false; cfg.sysAudio = false;
    cfg.bg = 'none'; cfg.res = 720; cfg.fps = 30; cfg.countdown = 0; cfg.dir = ${JSON.stringify(output)};
    cfg.autoZoom = false; cfg.ripple = true; cfg.src = 'smoke-synthetic';
    for (const key of ['mode', 'cam', 'mic', 'res', 'fps', 'bg', 'countdown']) {
      const element = document.querySelector('[data-k="' + key + '"]'); if (element) element.value = cfg[key];
    }
    fill($('src'), [{ id: 'smoke-synthetic', name: 'Fuente pública de prueba · Canvas' }], 'smoke-synthetic');
    $('dir').textContent = cfg.dir;
    const source = document.createElement('canvas'); source.width = 960; source.height = 540;
    const painter = source.getContext('2d'); let frame = 0;
    const paint = () => {
      painter.fillStyle = '#16336a'; painter.fillRect(0, 0, 960, 540);
      painter.fillStyle = '#b1a1ff'; painter.font = '600 22px Segoe UI'; painter.fillText('PRISMA / PRUEBA EMPAQUETADA', 50, 65);
      painter.fillStyle = '#ffffff'; painter.font = '600 53px Segoe UI'; painter.fillText('Una idea. Una toma.', 50, 180);
      painter.fillStyle = '#c9d6ef'; painter.font = '25px Segoe UI'; painter.fillText('Fuente pública sintética. Sin pantalla ni cámara real.', 50, 235);
      painter.fillStyle = '#55dbd2'; painter.fillRect(50 + (frame % 160), 325, 155, 80);
      painter.fillStyle = '#b1a1ff'; painter.fillRect(385, 325, 155, 80);
      painter.fillStyle = '#ff7475'; painter.fillRect(620, 325, 155, 80);
      painter.fillStyle = '#c9d6ef'; painter.font = '18px Segoe UI'; painter.fillText('Fotograma de prueba ' + frame++, 50, 470);
    };
    paint(); animation = setInterval(paint, 33);
    const syntheticStream = source.captureStream(30);
    const syntheticVideo = screenVideo = vid(syntheticStream);
    await until(() => syntheticVideo.videoWidth === 960, 'Synthetic source failed to decode');
    check(!syntheticStream.getVideoTracks()[0].getSettings().displaySurface, 'Synthetic source must not be a desktop capture');
    status('Listo'); ui(); fitCanvas();
    const engine = await api.invoke('transcription-status');
    check(engine.settings.engine === 'builtin', 'Packaged default transcription engine is not integrated Whisper');
    results.defaultTranscriptionEngine = engine.settings.engine;
    results.steps.push('isolated startup and synthetic preview');
    await wait(250);
    await api.invoke('open-widget', false);
    results.steps.push('floating widget opened');
    await api.invoke('open-prompter');
    results.steps.push('teleprompter opened');
    await startRec();
    check(state === 'rec' && recorder.state === 'recording', 'Application failed to start recording');
    check(screenVideo === syntheticVideo && !camVideo && !micStream && !sysNode, 'Recorder input is not synthetic and silent');
    results.steps.push('actual recorder and file IPC started');
    await wait(1100);
    hotkey('zoom-in'); check(zoom.ts > 1, 'Zoom did not activate');
    await wait(350); hotkey('zoom-out'); check(zoom.ts === 1, 'Zoom did not reset');
    results.steps.push('zoom and reset');
    hotkey('toggle-pause'); check(state === 'paused' && recorder.state === 'paused', 'Pause failed');
    await wait(180); const pausedWidget = await api.invoke('widget-state');
    await wait(220); const pausedWidgetAgain = await api.invoke('widget-state');
    check(pausedWidget.state === 'paused' && pausedWidget.elapsed === pausedWidgetAgain.elapsed, 'Shared widget timer did not freeze during pause');
    hotkey('toggle-pause'); check(state === 'rec' && recorder.state === 'recording', 'Resume failed');
    results.steps.push('pause, frozen shared widget timer, and resume');
    onClick({ x: .55, y: .55 });
    await wait(1650);
    check(screenVideo === syntheticVideo && !camVideo && !micStream && !sysNode, 'Recording source changed unexpectedly');
    stopRec();
    await until(() => state === 'idle' && $('status').textContent.startsWith('Guardado:'), 'Application did not finish saving', 25000);
    const saved = await api.invoke('transcription-status');
    check(saved.file && /\\.webm$/i.test(saved.file), 'Expected WebM export without an external ffmpeg installation');
    results.file = saved.file;
    results.steps.push('actual file IPC exported WebM');
    const video = document.createElement('video'); video.muted = true;
    video.src = encodeURI('file:///' + saved.file.replace(/\\\\/g, '/'));
    await until(() => video.readyState >= 2, 'Export cannot be decoded in packaged Chromium');
    check(video.videoWidth === 1280 && video.videoHeight === 720, 'Unexpected exported resolution: ' + video.videoWidth + 'x' + video.videoHeight);
    await video.play(); await wait(650);
    const playback = video.getVideoPlaybackQuality();
    check(playback.totalVideoFrames >= 2 && video.currentTime >= .2, 'Export contains no playable video frames');
    const decoded = document.createElement('canvas'); decoded.width = video.videoWidth; decoded.height = video.videoHeight;
    const decodedContext = decoded.getContext('2d'); decodedContext.drawImage(video, 0, 0);
    const pixel = Array.from(decodedContext.getImageData(10, 10, 1, 1).data);
    check(pixel[2] > pixel[0] * 1.3 && pixel[2] > 50, 'Decoded export does not contain the synthetic blue source');
    results.video = { width: video.videoWidth, height: video.videoHeight, decodedFrames: playback.totalVideoFrames, playbackSeconds: video.currentTime, sourcePixel: pixel };
    results.steps.push('saved WebM decoded with synthetic-source pixels');
    video.pause(); video.remove(); clearInterval(animation); stop(screenVideo); screenVideo = null;
    console.log('PACKAGED_SMOKE_RESULT ' + JSON.stringify({ ok: true, ...results }));
    await wait(250); window.close();
  } catch (error) {
    clearInterval(animation);
    try { if (state === 'rec' || state === 'paused') { discard = true; stopRec(); } } catch (_) {}
    console.log('PACKAGED_SMOKE_RESULT ' + JSON.stringify({ ok: false, error: error.stack || String(error), ...results }));
    await wait(400); window.close();
  }
})()
`;

const environment = { ...process.env, LOOM_SMOKE: rendererScript, PRISMA_SYNTHETIC_MEDIA: '1' };
for (const key of Object.keys(environment)) if (key.toLowerCase() === 'path') delete environment[key];
environment.PATH = childPath.join(';');
delete environment.PYTHONHOME;
delete environment.PYTHONPATH;
delete environment.NODE_OPTIONS;
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(executable, ['--user-data-dir=' + profile, '--disable-gpu', '--in-process-gpu', '--force-device-scale-factor=1'], {
  cwd: foreignWorkingDirectory, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
});
let stdout = '', stderr = '', spawnError;
child.stdout.on('data', data => { stdout += String(data); });
child.stderr.on('data', data => { stderr += String(data); });
child.on('error', error => { spawnError = error; });
let timedOut = false;
const timeout = setTimeout(() => { timedOut = true; child.kill(); }, 90000);
child.once('close', (code, signal) => {
  clearTimeout(timeout);
  fs.writeFileSync(path.join(output, 'stdout.log'), stdout);
  fs.writeFileSync(path.join(output, 'stderr.log'), stderr);
  try {
    assert(!spawnError, 'Packaged launch failed: ' + spawnError);
    assert(!timedOut, 'Packaged smoke test timed out');
    const marker = stdout.split(/\r?\n/).find(line => line.includes('PACKAGED_SMOKE_RESULT '));
    assert(marker, 'Packaged app returned no smoke result. See ' + path.join(output, 'stderr.log'));
    const result = JSON.parse(marker.slice(marker.indexOf('PACKAGED_SMOKE_RESULT ') + 'PACKAGED_SMOKE_RESULT '.length));
    assert(result.ok, result.error);
    assert.equal(code, 0, 'Packaged app exited with ' + code + ' / ' + signal);
    assert(path.resolve(result.file).startsWith(path.resolve(output) + path.sep), 'Export escaped the isolated output folder');
    assert(fs.statSync(result.file).size > 1000, 'Export is empty');
    const signature = fs.readFileSync(result.file).subarray(0, 4).toString('hex');
    assert.equal(signature, '1a45dfa3', 'Export is not an EBML/WebM file');
    const report = { ...result, executable, workingDirectory: foreignWorkingDirectory, requestedUserDataDirectory: profile, externalRuntimeExecutables, exportBytes: fs.statSync(result.file).size };
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
    console.log('Packaged Prisma smoke OK: synthetic preview, zoom, pause/resume, widget, teleprompter, saved and decoded WebM.');
    console.log('Test used no external Python, Node, or ffmpeg in the packaged app PATH.');
    console.log('Artifacts: ' + output);
  } catch (error) {
    console.error(error.stack || error);
    console.error('Artifacts: ' + output);
    process.exitCode = 1;
  }
});
