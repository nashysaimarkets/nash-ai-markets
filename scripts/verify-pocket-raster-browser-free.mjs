// No provider/network services: real PNG -> customer Canvas JPEG crop -> local grid/OCR verification.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {build} from 'esbuild';
import sharp from 'sharp';
import {chromium} from '@playwright/test';
import {TORTURE_CASES,syntheticSvg,SYNTHETIC_PRICE_AXIS} from '../tests/support/pocket-image-torture.ts';
const root=process.cwd();
// Execute the actual customer implementation, rather than the Sharp approximation.
const source=await readFile('app/pocket/PocketBullseye.tsx','utf8');
const crop=source.slice(source.indexOf('function createPrecisionReadingCrop('),source.indexOf('\nfunction numericLevel('));
assert.ok(crop.startsWith('function createPrecisionReadingCrop('));
const bundle=await build({stdin:{contents:`import {chartGridRows} from './app/pocket/chart-grid-rows.ts';
import {verifyAxisWords} from './app/pocket/axis-verification.ts';
import {verifyOriginalAxis} from './app/pocket/browser-axis-ocr.ts';
${crop}\nwindow.fixtureTools={chartGridRows,verifyAxisWords,verifyOriginalAxis,createPrecisionReadingCrop};`,resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'browser',format:'iife'});
const png=await sharp(Buffer.from(syntheticSvg(TORTURE_CASES[0]))).png().toBuffer();
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/'){res.setHeader('content-type','text/html');return res.end('<script src="/bundle.js"></script>');}
  if(path==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(bundle.outputFiles[0].contents);}
  if(path==='/fixture.png'){res.setHeader('content-type','image/png');return res.end(png);}
  if(path.startsWith('/ocr/')){
   const file=resolve(root,'public','.'+path);if(!file.startsWith(resolve(root,'public','ocr')+sep))throw new Error('invalid path');
   res.setHeader('content-type',path.endsWith('.js')?'text/javascript':path.endsWith('.wasm')?'application/wasm':'application/octet-stream');return res.end(await readFile(file));
  }
  res.writeHead(404);res.end();
 }catch{res.writeHead(500);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const requests=[];const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>{if(!route.request().url().startsWith(origin+'/')){requests.push(route.request().url());return route.abort();}return route.continue();});
try{
 await page.goto(origin);
 const results=await page.evaluate(async(axis)=>{
  const {chartGridRows,verifyAxisWords,verifyOriginalAxis,createPrecisionReadingCrop}=window.fixtureTools;
  const load=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src;});
  const original=await load('/fixture.png');
  const raster=im=>{const canvas=document.createElement('canvas');canvas.width=im.naturalWidth;canvas.height=im.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height);};
  const bounds={left:70/9,right:820/9,top:10,bottom:520/6};
  const words=axis.map(a=>({text:String(a.price),confidence:95,x:832,y:a.y,width:32,height:14}));
  const model=axis.map(a=>({price:a.price,y:a.y/6}));
  const grid=chartGridRows(raster(original),bounds).map(y=>y*6);
  const verified=verifyAxisWords(words,grid,model,600);
  const data=await createPrecisionReadingCrop('/fixture.png');
  const precision=await load(data);const scale=precision.naturalWidth/900;
  const cropBounds={...bounds,top:(60-36)/492*100,bottom:(520-36)/492*100};
  const cropGrid=chartGridRows(raster(precision),cropBounds).map(y=>y*precision.naturalHeight/100);
  const cropWords=words.map(w=>({...w,x:w.x*scale,y:(w.y-36)*precision.naturalHeight/492,width:w.width*scale,height:w.height*scale}));
  const cropVerified=verifyAxisWords(cropWords,cropGrid,model,precision.naturalHeight);
  // Pixel negatives: deliberately misaligned labels, blurred grid and erased scale.
  const misaligned=verifyAxisWords(words.map(w=>({...w,y:w.y+15})),grid,model,600);
  const blurredCanvas=document.createElement('canvas');blurredCanvas.width=900;blurredCanvas.height=600;const blurCtx=blurredCanvas.getContext('2d');blurCtx.filter='blur(6px)';blurCtx.drawImage(original,0,0);
  const blurredGrid=chartGridRows(blurCtx.getImageData(0,0,900,600),bounds).map(y=>y*6);
  const blurred=verifyAxisWords(words,blurredGrid,model,600);
  const missing=verifyAxisWords([],grid,model,600);
  const ocr=await verifyOriginalAxis(original,bounds,grid.map(y=>y/6),model,new AbortController().signal);
  const cropOcr=await verifyOriginalAxis(precision,cropBounds,cropGrid.map(y=>y/precision.naturalHeight*100),model,new AbortController().signal);
  const missingCanvas=document.createElement('canvas');missingCanvas.width=900;missingCanvas.height=600;
  const missingCtx=missingCanvas.getContext('2d');missingCtx.drawImage(original,0,0);missingCtx.fillStyle='white';missingCtx.fillRect(825,0,75,600);
  const erased=await load(missingCanvas.toDataURL('image/png'));
  const missingOcr=await verifyOriginalAxis(erased,bounds,grid.map(y=>y/6),model,new AbortController().signal);
  return {verified,cropVerified,misaligned,blurred,missing,ocr,cropOcr,missingOcr,grid,cropGrid,cropDimensions:[precision.naturalWidth,precision.naturalHeight]};
 },SYNTHETIC_PRICE_AXIS);
 console.log(JSON.stringify({results,externalRequests:requests,jsErrors:errors,providerCalls:0},null,2));
 assert.equal(results.verified.status,'verified','actual synthetic PNG grid must align with visible labels');
 assert.equal(results.cropVerified.status,'verified','actual customer JPEG crop must preserve verified grid/scale alignment');
 for(const k of ['misaligned','blurred','missing'])assert.equal(results[k].status,'held',k+' must fail closed');
 assert.equal(results.ocr.status,'verified','real browser OCR must independently read fixture prices');
 assert.equal(results.cropOcr.status,'verified','real browser OCR must read customer JPEG crop prices');
 assert.equal(results.missingOcr.status,'held','erased scale pixels must fail closed in the real OCR reader');
 assert.deepEqual(results.cropDimensions,[1400,765]);assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
