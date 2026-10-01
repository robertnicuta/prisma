// Electron integration test: synthetic phone video/audio through the real receiver preload.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const assert = require('assert');
const { viewerURL } = require('./vdo-url');
let main, receiver;
const timer = setTimeout(() => { console.error('VDO test timeout'); app.exit(1); }, 30000);
app.whenReady().then(async () => {
  try {
    assert.equal(new URL(viewerURL('https://vdo.ninja/?push=phone&password=secret')).searchParams.get('view'), 'phone');
    assert.equal(new URL(viewerURL('https://vdo.ninja/?push=phone&password=secret')).searchParams.get('password'), 'secret');
    for (const bad of ['https://evil.test/?view=x', 'https://vdo.ninja.evil.test/?view=x', 'https://vdo.ninja/?room=x', 'http://vdo.ninja/?view=x']) assert.throws(() => viewerURL(bad));
    main = new BrowserWindow({ show: false, webPreferences: { partition: 'vdo-integration-test', preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' } });
    receiver = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'vdo-preload.js'), backgroundThrottling: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required' } });
    ipcMain.handle('vdo-connect', () => { setImmediate(() => receiver.webContents.send('vdo-start')); return 1; });
    ipcMain.on('vdo-signal', (event, packet) => {
      if (event.sender === receiver.webContents) main.webContents.send('vdo-signal', { ...packet, token: 1 });
      else receiver.webContents.send('vdo-signal', packet);
    });
    await receiver.loadURL('data:text/html,<canvas id="c" width="640" height="360"></canvas><video autoplay muted></video>');
    await receiver.webContents.executeJavaScript(`
      const c = document.querySelector('canvas');
      c.getContext('2d').fillStyle = '#ff0000'; c.getContext('2d').fillRect(0,0,640,360);
      const audio = new AudioContext(); const oscillator = audio.createOscillator();
      const output = audio.createMediaStreamDestination(); oscillator.connect(output); oscillator.start(); audio.resume();
      const fake = c.captureStream(30); fake.addTrack(output.stream.getAudioTracks()[0]);
      document.querySelector('video').srcObject = fake;
      setInterval(() => c.getContext('2d').fillRect(0,0,640,360), 33);
    `, true);
    await main.loadFile('index.html');
    const result = await main.webContents.executeJavaScript(`(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      cfg.mode = 'cam'; $('vdoUrl').value = 'testphone'; await connectMobile();
      for (let i=0; i<100 && (!camVideo?.videoWidth || !vdoMedia.audio || vdoPeer.connectionState !== 'connected'); i++) await wait(100);
      fitCanvas(); draw(); await wait(2500);
      const color = Array.from(ctx.getImageData(100,100,1,1).data);
      const a = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(a);
      const audible = a.some(x => Math.abs(x-128) > 5);
      hotkey('toggle-mute'); const disabled = micStream.getAudioTracks().every(t => !t.enabled);
      await wait(300); analyser.getByteTimeDomainData(a); const silent = a.every(x => Math.abs(x-128) < 2);
      hotkey('toggle-mute');
      const stream = canvas.captureStream(30); stream.addTrack(dest.stream.getAudioTracks()[0]);
      const recording = new MediaRecorder(stream); const chunks=[];
      recording.ondataavailable = e => chunks.push(e.data);
      const done = new Promise(r => recording.onstop = r); recording.start(); await wait(1000); recording.stop(); await done;
      return { connected: vdoPeer.connectionState, width: camVideo.videoWidth, color, audible, disabled, silent,
        bytes: new Blob(chunks).size, audioTracks: stream.getAudioTracks().length, audioState: ac.state,
        trackMuted: micStream.getAudioTracks()[0].muted };
    })()`, true);
    assert.equal(result.connected, 'connected'); assert.equal(result.width, 640);
    assert(result.color[0] > 200 && result.color[1] < 30, 'phone video was not drawn');
    assert(result.audible, 'phone audio missing'); assert(result.disabled && result.silent, 'mute failed');
    assert(result.bytes > 1000 && result.audioTracks === 1, 'recording missing');
    await receiver.webContents.executeJavaScript(`
      fake.getTracks().forEach(t=>t.stop());
      c.getContext('2d').fillStyle = '#0000ff';
      const replacement = c.captureStream(30);
      const replacementAudio = audio.createMediaStreamDestination(); oscillator.connect(replacementAudio);
      replacement.addTrack(replacementAudio.stream.getAudioTracks()[0]);
      document.querySelector('video').srcObject = replacement;
    `);
    const recovered = await main.webContents.executeJavaScript(`(async () => {
      await new Promise(r=>setTimeout(r,2000));
      const color = Array.from(ctx.getImageData(100,100,1,1).data);
      const samples = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(samples);
      const recovered = color[2] > 200 && samples.some(x=>Math.abs(x-128)>5);
      clearMobile(); return {recovered, cleared:!vdoToken && !micStream && !camVideo && !vdoAudio.srcObject};
    })()`);
    assert(recovered.recovered && recovered.cleared, 'replacement or disconnect failed');
    console.log('VDO integration OK', JSON.stringify(result)); clearTimeout(timer); app.exit(0);
  } catch (e) { console.error(e); clearTimeout(timer); app.exit(1); }
});
