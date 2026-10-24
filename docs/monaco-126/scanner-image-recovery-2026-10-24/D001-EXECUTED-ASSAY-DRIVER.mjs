/** Real browser Canvas -> detector -> local OCR -> mounted source placement.
 * Optional retained inputs stay on localhost; no provider or external service.
 * Calibration truth is deliberately absent from the browser/runtime input. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

const root = process.cwd(), require = createRequire(import.meta.url);
const output = resolve(process.env.POCKET_IMAGE_RECOVERY_OUTPUT || 'qa/image-recovery/real-browser.json');
const retainedImage = process.env.POCKET_IMAGE_RECOVERY_IMAGE;
const retainedResponse = process.env.POCKET_IMAGE_RECOVERY_MAIN_RESPONSE;
assert.equal(Boolean(retainedImage), Boolean(retainedResponse), 'Retained image and MAIN response must be supplied together');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
let imageBytes, mainBytes, main, imageType;
if (retainedImage) {
  imageBytes = await readFile(retainedImage); mainBytes = await readFile(retainedResponse);
  const response = JSON.parse(mainBytes.toString('utf8'));
  assert.equal(response.status, 'completed');
  main = JSON.parse(response.output_text); imageType = 'image/png';
} else {
  const rows = [120, 232, 344, 456, 568, 680];
  const candles = [.3,.42,.25,.5,.65,.55,.7,.38,.58,.48,.33,.44].map((v,i) => {
    const x = 126 + i * 60, y = 120 + v * 560, fill = i % 2 ? '#14b991' : '#e14664';
    return `<path d="M${x} ${y-42}V${y+48}" stroke="${fill}" stroke-width="2"/><rect x="${x-6}" y="${y-14}" width="12" height="35" fill="${fill}"/>`;
  }).join('');
  imageBytes = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800"><rect width="1000" height="800" fill="#f5f5f5"/>${rows.map((y,i)=>`<path d="M80 ${y}H850" stroke="#cdcdcd"/><text x="864" y="${y+6}" font-size="18" font-family="Arial,sans-serif" fill="#191919">${(120-i*2).toFixed(2)}</text>`).join('')}<path d="M80 120V680M850 120V680" stroke="#cdcdcd"/>${candles}</svg>`);
  imageType = 'image/svg+xml';
  main = { timeframe:'1H', currentPrice:'115', evidenceQuality:{chartReadability:'CLEAR',instrumentConfidence:'HIGH',timeframeConfidence:'HIGH',scaleReadable:true,candlesReadable:true,limitations:[]},
    plotBounds:{left:70,top:100,right:100,bottom:20}, priceScaleAnchors:[{price:120,y:99},{price:110,y:1}],
    levels:[{kind:'support',label:'USER VERIFIED',price:'115',x:.2,x2:.8,y:.6,y2:.6},{kind:'resistance',label:'Candidate',price:'118',x:.2,x2:.8,y:.3,y2:.3}],patterns:[],fibLevels:[] };
  mainBytes = Buffer.from(JSON.stringify(main));
}
const entry = `
import React,{useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {calibratePocketAnalysis} from './app/api/pocket/analysis-calibration.ts';
import {collectSourcePriceCandidates} from './app/pocket/source-price-candidates.ts';
import {useOriginalChartMeasurement} from './app/pocket/use-original-chart-measurement.ts';
import {sourceLevelPlacement} from './app/pocket/source-placement.ts';
import {deriveLevelProvenance} from './app/pocket/level-provenance.ts';
import OriginalChartEvidence from './app/pocket/OriginalChartEvidence.tsx';
const started=performance.now();
window.mountMain=main=>{
 const candidates=collectSourcePriceCandidates(main);
 const report={...calibratePocketAnalysis(main),sourcePriceCandidates:candidates};
 function Assay(){
  const measurement=useOriginalChartMeasurement('/fixture',report,true);
  const placed=sourceLevelPlacement(measurement,'/fixture',report,true);
  useEffect(()=>{if(measurement)window.assay={
   dimensions:[measurement.width,measurement.height],legacyAxis:measurement.axis,pixelsNull:measurement.pixels===null,
   imageRecovery:measurement.imageRecovery??null,placement:placed,provenance:placed.levels.map(level=>deriveLevelProvenance(level,report.priceScaleAnchors?.length??0)),
   candidateCount:candidates.levels.length,calibratedLevelCount:report.levels?.length??0,calibratedScaleReadable:report.evidenceQuality?.scaleReadable,
   elapsedMs:performance.now()-started,
  };},[measurement]);
  return <>{['levels','patterns','liquidity'].map(layer=><OriginalChartEvidence key={layer} image='/fixture' report={report} identityConfirmed layer={layer} measurement={measurement}/>)}</>;
 }
 createRoot(document.getElementById('root')).render(<Assay/>);
};`;
const built = await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
const paths = ['app/api/pocket/analysis-calibration.ts','app/pocket/use-original-chart-measurement.ts','app/pocket/source-placement.ts','app/pocket/source-price-candidates.ts','app/pocket/image-plot-region.ts','app/pocket/image-axis-verification.ts','app/pocket/browser-image-axis-ocr.ts','app/pocket/level-provenance.ts','app/pocket/OriginalChartEvidence.tsx'];
const sourceHashes = Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(resolve(root,p)))])));
const server = createServer(async(req,res)=>{
  try {
    const path = new URL(req.url,'http://localhost').pathname;
    if(path==='/'){res.setHeader('content-type','text/html');return res.end('<meta charset="utf-8"><div id="root"></div><script src="/bundle.js"></script>');}
    if(path==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(built.outputFiles[0].contents);}
    if(path==='/fixture'){res.setHeader('content-type',imageType);return res.end(imageBytes);}
    if(path.startsWith('/ocr/')){
      const file=resolve(root,'public','.'+path);
      if(!file.startsWith(resolve(root,'public','ocr')+sep))throw new Error('Invalid path');
      res.setHeader('content-type',path.endsWith('.js')?'text/javascript':path.endsWith('.wasm')?'application/wasm':'application/octet-stream');
      return res.end(await readFile(file));
    }
    res.writeHead(404);res.end();
  }catch{res.writeHead(500);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser, result, browserVersion;
const errors=[],blockedExternalRequests=[];
try {
  browser=await chromium.launch({headless:true,...(process.env.POCKET_QA_BROWSER_EXECUTABLE_PATH?{executablePath:process.env.POCKET_QA_BROWSER_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
  browserVersion=browser.version();
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/*',route=>{
    const url=route.request().url();
    if(url.startsWith(origin+'/')||url.startsWith('data:'))return route.continue();
    blockedExternalRequests.push(url);return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);
  await page.evaluate(main=>window.mountMain(main),main);
  await page.waitForFunction(()=>window.assay!==undefined,null,{timeout:35_000});
  result=await page.evaluate(()=>({...window.assay,rendered:[...document.querySelectorAll('.psOriginalEvidence')].map(section=>({header:section.querySelector('strong')?.textContent,status:section.querySelector('[role=status]')?.textContent,lines:[...section.querySelectorAll('svg line')].map(line=>({x1:Number(line.getAttribute('x1')),x2:Number(line.getAttribute('x2')),y1:Number(line.getAttribute('y1')),y2:Number(line.getAttribute('y2'))})),polylines:section.querySelectorAll('polyline').length,rectangles:section.querySelectorAll('svg rect').length}))}));
  assert.deepEqual(errors,[]);assert.deepEqual(blockedExternalRequests,[]);
  assert.equal(result.imageRecovery?.axis?.status,'verified','Actual independent image OCR must verify');
  assert.ok(result.placement.levels.length>0,'Current source must receive measured candidates');
  assert.equal(result.pixelsNull,true);assert.equal(result.legacyAxis.status,'held');
  assert.equal(result.calibratedLevelCount,0);assert.equal(result.calibratedScaleReadable,false);
  assert.equal(result.rendered[0].lines.length,result.placement.levels.length);
  assert.ok(result.rendered.slice(1).every(view=>!view.lines.length&&!view.polylines&&!view.rectangles));
  assert.ok(result.provenance.every(p=>p.method==='AI_CANDIDATE'&&p.confidence==='LOW'&&p.precision==='POSITION_CHECKED'));
} catch(error) { errors.push(String(error?.stack||error));process.exitCode=1; }
finally {
  await browser?.close();await new Promise(r=>server.close(r));
  const receipt={kind:'MOUNTED_IMAGE_RECOVERY_REAL_BROWSER',status:process.exitCode?'HOLD':'PASS',observedAtUtc:new Date().toISOString(),input:retainedImage?'RETAINED_MAIN_REPLAY':'SYNTHETIC_ORIGINAL',imageSha256:hash(imageBytes),mainResponseSha256:hash(mainBytes),sourceHashes,node:process.version,playwright:require('@playwright/test/package.json').version,browser:browserVersion,result,errors,blockedExternalRequests,providerCalls:0,databaseCalls:0,limitations:['MAIN candidate replay through current calibration and mounted browser; no fresh provider/API request','Identity confirmation enabled for this controlled placement assay','No semantic support/resistance, pattern, liquidity, held-out corpus or physical-device latency acceptance','Independent one-pixel oracle comparison is separate and never supplied to the runtime']};
  await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({status:receipt.status,output,sha256:hash(JSON.stringify(receipt,null,2)+'\n'),levels:result?.placement?.levels.length,axis:result?.imageRecovery?.axis?.status,errors:errors.length,providerCalls:0}));
}
