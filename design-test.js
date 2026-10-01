// Check the studio navigation and layout using the real application windows.
const {app,BrowserWindow} = require('electron');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const output = path.join(__dirname,'test-output');
const profile = path.join(output,'design-profile-'+process.pid);
fs.mkdirSync(profile,{recursive:true});
app.setPath('userData',profile);app.setPath('sessionData',profile);
require('./main');
const wait = ms=>new Promise(r=>setTimeout(r,ms));
const timer = setTimeout(()=>{console.error('Design test timeout');app.exit(1);},30000);
app.whenReady().then(async()=>{
  try {
    let main;
    for(let i=0;i<100;i++){
      main=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));
      if(main&&!main.webContents.isLoading())break;
      await wait(100);
    }
    assert(main,'studio did not open');
    assert.equal(app.getName(),'Prisma');assert.equal(app.getPath('userData'),profile);
    // Let the initial asynchronous capture finish before displaying the empty studio.
    for(let i=0;i<100;i++){
      if(await main.webContents.executeJavaScript(`!!screenVideo?.videoWidth`))break;
      await wait(100);
    }
    await main.webContents.executeJavaScript(`
      stop(screenVideo);stop(camVideo);screenVideo=camVideo=null;
      micStream?.getTracks().forEach(t=>t.stop());micNode?.disconnect();micStream=null;
      cfg.mode='both';cfg.cam=cfg.mic='';muted=false;
      document.querySelector('[data-k="mode"]').value='both';$('cam').value=$('mic').value='';
      ui();fitCanvas();
    `);
    const execute = code=>main.webContents.executeJavaScript(code,true);
    for(const panel of ['appearance','advanced','sources']){
      await execute(`document.querySelector('[data-panel="${panel}"]').click()`);
      const active=await execute(`Array.from(document.querySelectorAll('[data-group]')).filter(e=>!e.hidden).map(e=>e.dataset.group)`);
      assert(active.length&&active.every(p=>p===panel),'settings tab failed: '+panel);
    }
    await execute(`$('navHelp').click()`);
    assert(await execute(`!$('helpPanel').hidden && $('navHelp').getAttribute('aria-current')==='page'`));
    await execute(`$('navTranscript').click()`);await wait(300);
    assert(await execute(`!$('transcriptionPanel').hidden && $('helpPanel').hidden`));
    await execute(`$('closeTranscript').click();$('navMobile').click()`);await wait(500);
    assert(await execute(`$('transcriptionPanel').hidden && !$('vdoPanel').hidden && $('navMobile').getAttribute('aria-current')==='page'`));
    await execute(`$('navRecord').click();selectSettings('sources')`);
    for(const size of [[940,620],[1280,860]]){
      main.setSize(...size);await wait(400);
      const layout=await execute(`(()=>{
        const r=$('rec').getBoundingClientRect(),bar=document.querySelector('.row').getBoundingClientRect(),c=canvas.getBoundingClientRect();
        return {width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,
          recVisible:r.top>=0&&r.bottom<=innerHeight,barFits:bar.right<=innerWidth,
          controlsFit:Array.from(document.querySelectorAll('.row button')).every(e=>e.getBoundingClientRect().right<=bar.right),
          aspectError:Math.abs(c.width/c.height-canvas.width/canvas.height),canvasFits:c.bottom<=bar.top};
      })()`);
      assert(layout.pageWidth<=layout.width,'page overflow: '+JSON.stringify(layout));
      assert(layout.recVisible&&layout.barFits&&layout.controlsFit&&layout.canvasFits,'controls or preview clipped: '+JSON.stringify(layout));
      assert(layout.aspectError<.02,'preview aspect changed');
      if(size[0]===940)fs.writeFileSync(path.join(output,'prisma-compact.png'),(await main.webContents.capturePage()).toPNG());
    }
    fs.writeFileSync(path.join(output,'prisma-studio.png'),(await main.webContents.capturePage()).toPNG());
    console.log('Prisma design OK: branding, isolated preferences, tabs, navigation, 940/1280 layouts, preview proportions.');
    clearTimeout(timer);app.quit();
  }catch(e){console.error(e);clearTimeout(timer);app.exit(1);}
});
