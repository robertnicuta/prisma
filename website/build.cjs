const fs=require('node:fs');const path=require('node:path');
const output=path.resolve(__dirname,'dist');
if(output!==path.join(__dirname,'dist')||!output.startsWith(__dirname+path.sep))throw new Error('Invalid public output path');
// Only generated public output is cleared. Vercel state lives in website/.vercel.
fs.rmSync(output,{recursive:true,force:true});fs.mkdirSync(output,{recursive:true});
for(const filename of ['index.html','styles.css','tour.css','app.js','tour.js','tour-position.js','LICENSE.txt'])fs.copyFileSync(path.join(__dirname,filename),path.join(output,filename));
fs.mkdirSync(path.join(output,'assets','screenshots'),{recursive:true});fs.copyFileSync(path.join(__dirname,'assets','prisma.svg'),path.join(output,'assets','prisma.svg'));
for(const filename of fs.readdirSync(path.join(__dirname,'assets','screenshots')).filter(name=>name.endsWith('.png')))fs.copyFileSync(path.join(__dirname,'assets','screenshots',filename),path.join(output,'assets','screenshots',filename));
console.log('Prisma website built: dist/ · 10 screenshots · guided tour');
