// Rasterize the vector mark and pack a Windows icon at all taskbar sizes.
const {app,BrowserWindow} = require('electron');
const fs=require('fs'),path=require('path');
app.whenReady().then(async()=>{
 try{
  const window=new BrowserWindow({show:false,width:512,height:512,frame:false,useContentSize:true,transparent:true,webPreferences:{backgroundThrottling:false}});
  const svg=fs.readFileSync(path.join(__dirname,'brand.svg'),'utf8');
  await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(`<style>html,body{margin:0;width:512px;height:512px;background:transparent;overflow:hidden}svg{display:block}</style>${svg}`));
  await new Promise(resolve=>setTimeout(resolve,400));
  const artwork=await window.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname,'icon.png'),artwork.resize({width:512,height:512}).toPNG());
  const sizes=[16,24,32,48,64,128,256];const images=sizes.map(size=>artwork.resize({width:size,height:size,quality:'best'}).toPNG());
  const directory=Buffer.alloc(6+16*sizes.length);directory.writeUInt16LE(1,2);directory.writeUInt16LE(sizes.length,4);let offset=directory.length;
  sizes.forEach((size,i)=>{const at=6+i*16;directory[at]=directory[at+1]=size===256?0:size;directory.writeUInt16LE(1,at+4);directory.writeUInt16LE(32,at+6);directory.writeUInt32LE(images[i].length,at+8);directory.writeUInt32LE(offset,at+12);offset+=images[i].length;});
  fs.writeFileSync(path.join(__dirname,'icon.ico'),Buffer.concat([directory,...images]));console.log('Icon generated: SVG, PNG, ICO (7 sizes).');app.quit();
 }catch(e){console.error(e);app.exit(1);}
});
