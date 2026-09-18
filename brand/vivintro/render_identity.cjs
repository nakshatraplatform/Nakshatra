/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS renderer resolves optional tools from a caller-provided dependency directory */
const fs = require('node:fs/promises');
const path = require('node:path');
const deps = process.argv[2];
const sharp = require(require.resolve('sharp', { paths: [deps] }));
const { chromium } = require(require.resolve('playwright', { paths: [deps] }));
const root = __dirname;
const asset = name => path.join(root, 'assets', name);
function lum(hex) {
  const rgb = hex.match(/[a-f\d]{2}/gi).map(v => parseInt(v,16)/255).map(v => v<=0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4);
  return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
}
(async () => {
  for (const [input, output, size] of [
    ['app-icon.svg','app-icon-1024.png',1024],['app-icon.svg','app-icon-512.png',512],
    ['app-icon.svg','apple-touch-icon.png',180],['social-avatar.svg','social-avatar-512.png',512],
    ...[16,32,48].map(s => ['favicon.svg',`favicon-${s}.png`,s])
  ]) await sharp(await fs.readFile(asset(input))).resize(size,size).png().toFile(asset(output));
  const sizes=[16,32,48];
  const pngs=await Promise.all(sizes.map(s=>fs.readFile(asset(`favicon-${s}.png`))));
  const header=Buffer.alloc(6+16*sizes.length);
  header.writeUInt16LE(1,2);header.writeUInt16LE(sizes.length,4);
  let offset=header.length;
  sizes.forEach((s,i)=>{const pos=6+16*i;header[pos]=s;header[pos+1]=s;header.writeUInt16LE(1,pos+4);header.writeUInt16LE(32,pos+6);header.writeUInt32LE(pngs[i].length,pos+8);header.writeUInt32LE(offset,pos+12);offset+=pngs[i].length;});
  await fs.writeFile(asset('favicon.ico'),Buffer.concat([header,...pngs]));
  const pairs=[['Ink / paper','#162a33','#f8f6f0'],['Muted / paper','#627178','#f8f6f0'],['White / primary','#fffdf8','#174b55'],['Quiet teal / paper','#477b77','#f8f6f0'],['Gold / paper','#a86708','#f8f6f0'],['White / quiet teal','#fffdf8','#477b77'],['Dark ink / canvas','#edf2ef','#111b22'],['Dark muted / surface','#b0bfca','#1b2932'],['Dark teal / surface','#8fd4c8','#1b2932'],['Dark gold / surface','#e2c07a','#1b2932']];
  pairs.push(['Gold text / paper','#8f6628','#f8f6f0'],['Gold text / tint','#805c24','#eeece3'],['Teal text / paper','#315f5c','#f8f6f0'],['Muted text / tint','#58666d','#eeece3']);
  const report=pairs.map(([name,foreground,background])=>{const a=lum(foreground),b=lum(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);return {name,foreground,background,ratio:Number(ratio.toFixed(2)),normalTextPass:ratio>=4.5};});
  await fs.writeFile(path.join(root,'contrast-report.json'),JSON.stringify(report,null,2)+'\n');
  await fs.mkdir(path.join(root,'previews'),{recursive:true});
  const browser=await chromium.launch({channel:'msedge'});
  const checks=[];
  try {
    for(const width of [1440,768,440,375,320]){
      const page=await browser.newPage({viewport:{width,height:1000},deviceScaleFactor:1});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      const response=await page.goto('http://127.0.0.1:4178/',{waitUntil:'networkidle'});
      await page.evaluate(()=>document.fonts.ready);
      const result=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src),fontsLoaded:['Manrope','Playfair','Geist','Tenor'].map(n=>({name:n,loaded:document.fonts.check(`16px ${n}`)}))}));
      checks.push({...result,status:response.status(),errors});
      if(width===1440){await page.screenshot({path:path.join(root,'previews','brand-overview.png')});await page.screenshot({path:path.join(root,'previews','full-guide.png'),fullPage:true});for(const id of ['concepts','signature','applications'])await page.locator('#'+id).screenshot({path:path.join(root,'previews',id+'.png')});}
      if(width===440){await page.screenshot({path:path.join(root,'previews','mobile-guide.png'),fullPage:true});await page.screenshot({path:path.join(root,'previews','mobile-top.png')});}
      await page.close();
    }
    const page=await browser.newPage({viewport:{width:1200,height:1200},deviceScaleFactor:1});
    await page.goto('http://127.0.0.1:4178/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
    await page.addStyleTag({content:'.social-mock{width:1200px!important;height:1200px!important;border-radius:0!important;padding:90px!important}.social-mock>img{width:260px!important}.social-mock h3{font-size:110px!important;margin-top:150px!important}.social-mock>span{font-size:24px!important}.social-lines{width:600px!important;height:720px!important}'});
    await page.locator('.social-mock').screenshot({path:asset('social-post-1200.png')});
    await page.close();
  } finally {await browser.close();}
  await fs.writeFile(path.join(root,'verification.json'),JSON.stringify({contrast:report,viewports:checks},null,2)+'\n');
  console.log(JSON.stringify({contrast:report,viewports:checks},null,2));
  if(checks.some(c=>c.status!==200||c.scrollWidth>c.width||c.brokenImages.length||c.errors.length)) process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
