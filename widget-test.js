// Exercise the floating controls against the real application and recording IPC.
const {app,BrowserWindow,ipcMain} = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const output = path.join(__dirname,'test-output');
fs.mkdirSync(path.join(output,'widget-profile-'+process.pid),{recursive:true});
app.setPath('userData',path.join(output,'widget-profile-'+process.pid));
app.setPath('sessionData',path.join(output,'widget-profile-'+process.pid));
const wait = ms => new Promise(r=>setTimeout(r,ms));
require('./main');
ipcMain.removeHandler('show-file'); ipcMain.handle('show-file',()=>{});
const timeout = setTimeout(()=>{console.error('Widget test timeout');app.quit();process.exitCode=1;},90000);
app.whenReady().then(async()=>{
  try {
    let widget, main;
    for(let i=0;i<100;i++) {
      widget = BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/widget.html'));
      main = BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));
      if(widget && main && !widget.webContents.isLoading()) break;
      await wait(100);
    }
    assert(widget && main,'windows missing');
    await main.webContents.executeJavaScript(`
      cfg.mode='cam'; cfg.cam='synthetic'; cfg.mic='synthetic'; cfg.countdown=0; cfg.dir=${JSON.stringify(output)};
      $('cam').add(new Option('Cámara de prueba','synthetic'));$('cam').value='synthetic';
      $('mic').add(new Option('Audio de prueba','synthetic'));$('mic').value='synthetic';
      stop(camVideo); const fakeCanvas=document.createElement('canvas'); fakeCanvas.width=640;fakeCanvas.height=360;
      const fakeCtx=fakeCanvas.getContext('2d');fakeCtx.fillStyle='#5275ff';
      setInterval(()=>fakeCtx.fillRect(0,0,640,360),33); camVideo=vid(fakeCanvas.captureStream(30));
      graph(); const tone=ac.createOscillator();const toneOut=ac.createMediaStreamDestination();tone.connect(toneOut);tone.start();
      micStream=toneOut.stream;micNode=ac.createMediaStreamSource(micStream);micNode.connect(dest);
      fitCanvas();ui();
    `,true);
    await wait(500);
    assert(await main.webContents.executeJavaScript(`api.invoke('open-widget',true).then(()=>true)`));
    assert(!main.isVisible(),'compact mode did not hide main app');
    const click = id=>widget.webContents.executeJavaScript(`document.getElementById('${id}').click()`,true);
    const state = ()=>main.webContents.executeJavaScript('state');
    const waitState = async expected=>{for(let i=0;i<100;i++){if(await state()===expected)return;await wait(100);}throw new Error('State did not become '+expected);};
    await click('settings');await wait(350);
    assert(widget.getBounds().height>104,'settings did not expand');
    const keys=await widget.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[data-k]'),e=>e.dataset.k)`);
    for(const key of ['mode','src','cam','mic','camShow','mirror','size','shape','border','res','fps','bg','sysAudio','clean','autoZoom','autoLevel','autoSecs','ripple','countdown'])assert(keys.includes(key),'missing widget setting '+key);
    await widget.webContents.executeJavaScript(`$('mobileInput').value='https://invalid.test/?view=x';$('mobileConnect').click()`,true);await wait(300);
    assert(await main.webContents.executeJavaScript(`$('vdoStatus').textContent.startsWith('Error:')`),'widget did not route mobile connection');
    await widget.webContents.executeJavaScript(`const mirror=document.querySelector('[data-k="mirror"]');mirror.checked=true;mirror.onchange();`,true);await wait(300);
    assert(await main.webContents.executeJavaScript('cfg.mirror'),'widget settings not shared');
    fs.writeFileSync(path.join(output,'widget-settings.png'),(await widget.webContents.capturePage()).toPNG());
    await click('cameraToggle');await wait(300);assert(!await main.webContents.executeJavaScript('cfg.camShow'),'camera toggle failed');
    assert(await main.webContents.executeJavaScript(`ctx.getImageData(100,100,1,1).data[2]===0`),'camera toggle did not hide recorded video');
    await click('cameraToggle');await click('zoom');await wait(300);assert(await main.webContents.executeJavaScript('zoom.ts>1'),'zoom failed');
    await widget.webContents.executeJavaScript(`document.querySelector('[data-action="zoom-out"]').click()`,true);await wait(200);assert.equal(await main.webContents.executeJavaScript('zoom.ts'),1);
    await click('settings');await wait(200);
    await click('record');await waitState('rec');await wait(1100);
    assert.equal(await widget.webContents.executeJavaScript(`document.getElementById('record').textContent`),'Parar');
    await click('pause');await waitState('paused');await wait(300);
    const frozen = await widget.webContents.executeJavaScript(`document.getElementById('timer').textContent`);
    await wait(1100);assert.equal(await widget.webContents.executeJavaScript(`document.getElementById('timer').textContent`),frozen,'paused timer advanced');
    await click('mic');await wait(300);assert(await main.webContents.executeJavaScript('muted'),'mute failed');
    await click('pause');await waitState('rec');await wait(300);
    fs.writeFileSync(path.join(output,'widget.png'),(await widget.webContents.capturePage()).toPNG());
    const fits=await widget.webContents.executeJavaScript(`document.getElementById('hide').getBoundingClientRect().right <= innerWidth`);
    assert(fits,'widget controls overflow');
    await click('record');await waitState('idle');
    let info=await main.webContents.executeJavaScript(`api.invoke('transcription-status')`);
    for(let i=0;i<4&&!info.ready;i++){await wait(500);info=await main.webContents.executeJavaScript(`api.invoke('transcription-status')`);}
    assert(fs.statSync(info.file).size>1000,'widget did not save recording');
    await click('prompter');await wait(400);assert(BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().endsWith('/teleprompter.html')),'teleprompter failed');
    const before=fs.readdirSync(output).filter(f=>/^loom-.*\.(mp4|webm)$/.test(f)).length;
    await click('record');await waitState('rec');await wait(400);await click('discard');await waitState('idle');
    assert.equal(fs.readdirSync(output).filter(f=>/^loom-.*\.(mp4|webm)$/.test(f)).length,before,'discard left a recording');
    await click('transcript');await wait(700);
    assert(!main.isVisible(),'widget transcription unexpectedly opened main app');
    assert(await widget.webContents.executeJavaScript(`!document.getElementById('transcriptPane').hidden`));
    assert(info.ready && info.settings.engine==='speaches','Speaches not ready: '+info.error);
    await click('transcribeLast');
    for(let i=0;i<600;i++){if(await widget.webContents.executeJavaScript(`!document.getElementById('openTxt').disabled`))break;await wait(100);}
    assert(await widget.webContents.executeJavaScript(`!document.getElementById('openTxt').disabled`),'widget transcription failed: '+await widget.webContents.executeJavaScript(`document.getElementById('transcriptStatus').textContent`));
    fs.writeFileSync(path.join(output,'widget-transcript.png'),(await widget.webContents.capturePage()).toPNG());
    await click('openApp');assert(main.isVisible(),'open app failed');
    fs.writeFileSync(path.join(output,'app.png'),(await main.webContents.capturePage()).toPNG());
    const vdoPanel=await main.webContents.executeJavaScript(`!!document.getElementById('vdoConnect')`);assert(vdoPanel);
    console.log('Widget integration OK: shared settings, camera toggle, zoom/reset, record, pause/resume, mute, timer, saved video, transcription inside widget, layout.');
    clearTimeout(timeout);app.quit();
  } catch(e){console.error(e);clearTimeout(timeout);process.exitCode=1;app.quit();}
});
