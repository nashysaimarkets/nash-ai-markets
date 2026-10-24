/** Actual React/browser lifecycle integration. Only the OCR transport is controlled. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const sourceRoot=resolve(process.env.POCKET_QA_SOURCE_ROOT || process.cwd());
const require=createRequire(sourceRoot+'/package.json');
const entry=resolve(process.env.POCKET_QA_BROWSER_ENTRY || sourceRoot+'/tests/support/pocket-source-placement-browser.tsx');
const output=resolve(process.env.POCKET_QA_BROWSER_OUT || sourceRoot+'/qa/scanner-repair/source-placement-browser.json');
const {build}=await import(process.env.POCKET_QA_ESBUILD_MODULE || pathToFileURL(require.resolve('esbuild')).href);
const {chromium}=await import(process.env.POCKET_QA_PLAYWRIGHT_MODULE || pathToFileURL(require.resolve('playwright')).href);
const built=await build({
 stdin:{contents:await readFile(entry,'utf8'),loader:'tsx',resolveDir:sourceRoot+'/tests/support',sourcefile:'pocket-source-placement-browser.tsx'},
 bundle:true,write:false,format:'iife',platform:'browser',target:'es2022',jsx:'automatic',
 nodePaths:[sourceRoot+'/node_modules'],loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent',
 plugins:[{name:'controlled-ocr-boundary',setup(b){
  b.onResolve({filter:/browser-axis-ocr$/},()=>({path:'controlled-ocr',namespace:'review'}));
  b.onLoad({filter:/.*/,namespace:'review'},()=>({contents:`
    window.__ocr=[];
    export function verifyOriginalAxis(image,bounds,rows,model,signal){
      return new Promise((resolve,reject)=>window.__ocr.push({src:image.src,bounds,rows,model,signal,resolve,reject}));
    }`,loader:'js'}));
 }}],
});
const sourceFiles=['app/pocket/OriginalChartEvidence.tsx','app/pocket/use-original-chart-measurement.ts','app/pocket/source-placement.ts','app/pocket/original-pixel-levels.ts'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async p=>[p,createHash('sha256').update(await readFile(sourceRoot+'/'+p)).digest('hex')])));
const sourceBuild={sourceHashes,controlledBoundary:'browser-axis-ocr',bundleBytes:built.outputFiles[0].contents.length,providerCalls:0};
const bundle=built.outputFiles[0].contents;
const html='<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/measurement-bundle.js"></script></body></html>';
if(process.env.POCKET_QA_BROWSER_COMPILE_ONLY==='1'){ console.log(JSON.stringify({status:'COMPILED_BROWSER_UNRUN',...sourceBuild})); process.exit(0); }
const server=createServer((req,res)=>{
  if(req.url==='/measurement-bundle.js'){res.writeHead(200,{'content-type':'text/javascript'});res.end(bundle);}
  else if(req.url==='/'){res.writeHead(200,{'content-type':'text/html'});res.end(html);}
  else{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
const checks=[],errors=[],blockedExternalRequests=[];
const check=async(name,fn)=>{await fn();checks.push({name,status:'PASS'});};
try {
  browser=await chromium.launch({headless:true,...(process.env.POCKET_QA_BROWSER_EXECUTABLE_PATH?{executablePath:process.env.POCKET_QA_BROWSER_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
    const url=route.request().url();
    if(url.startsWith(origin+'/')||url.startsWith('data:'))return route.continue();
    blockedExternalRequests.push(url);return route.abort();
  });
  await page.goto(origin,{waitUntil:'load'});
  const calls=()=>page.evaluate(()=>window.__ocr.length);
  const waitCalls=async n=>{await page.waitForFunction(n=>window.__ocr.length===n,n);assert.equal(await calls(),n);};
  const count=async n=>{await page.waitForFunction(n=>document.querySelector('#placement')?.getAttribute('data-count')===String(n),n);};
  const lines=()=>page.locator('svg line').count();
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await check('pending independent source read holds numeric placements and both consumers',async()=>{
    await waitCalls(1);await count(0);assert.equal(await lines(),0);
    assert.equal(await page.locator('.psOriginalEvidence').count(),2);
  });
  await check('one measured result supplies two SVG consumers at corrected original pixel row',async()=>{
    await page.evaluate(()=>window.review.resolve(0));await count(1);
    assert.equal(await calls(),1);assert.equal(await lines(),2);
    assert.deepEqual(await page.locator('svg line').evaluateAll(items=>items.map(x=>[x.getAttribute('y1'),x.getAttribute('y2')])),[['650','650'],['650','650']]);
    assert.equal(await page.locator('#placement').getAttribute('data-y'),'65');
  });
  await check('identity revocation synchronously removes previous verified placement',async()=>{
    const immediate=await page.evaluate(()=>{window.review.replace({identity:false});return {count:document.querySelector('#placement').getAttribute('data-count'),lines:document.querySelectorAll('svg line').length};});
    assert.deepEqual(immediate,{count:'0',lines:0});assert.equal(await calls(),1);
  });
  await check('same image/report reconfirmation waits for a fresh bound result',async()=>{
    await page.evaluate(()=>window.review.replace({identity:true}));await waitCalls(2);await count(0);
    await page.evaluate(()=>window.review.resolve(1));await count(1);
  });
  await check('new confirmation object invalidates otherwise unchanged report binding',async()=>{
    await page.evaluate(()=>window.review.reconfirm());await waitCalls(3);await count(0);
  });
  await check('replaced report ignores late completed response even when transport ignores abort',async()=>{
    await page.evaluate(()=>window.review.replaceReport());await waitCalls(4);await count(0);
    assert.equal(await page.evaluate(()=>window.__ocr[2].signal.aborted),true);
    await page.evaluate(()=>window.review.resolve(2));await settle();await count(0);assert.equal(await lines(),0);
    await page.evaluate(()=>window.review.resolve(3));await count(1);
  });
  await check('image A to B to A cannot resurrect prior image-A measurement',async()=>{
    await page.evaluate(()=>window.review.replace({image:window.review.imageB}));await waitCalls(5);await count(0);
    await page.evaluate(()=>window.review.replace({image:window.review.imageA}));await waitCalls(6);await count(0);
    await page.evaluate(()=>window.review.resolve(4));await settle();await count(0);assert.equal(await lines(),0);
    await page.evaluate(()=>window.review.resolve(5));await count(1);
  });
  await check('explicit held OCR response keeps all source placement withheld',async()=>{
    await page.evaluate(()=>window.review.replaceReport());await waitCalls(7);
    await page.evaluate(()=>window.review.resolve(6,'held'));await count(0);
    await page.waitForFunction(()=>document.querySelector('#placement').textContent.includes('CONTROLLED OCR HOLD'));
    assert.equal(await lines(),0);
  });
  await check('reader rejection remains held and never reuses prior verified coordinates',async()=>{
    await page.evaluate(()=>window.review.replaceReport());await waitCalls(8);
    await page.evaluate(()=>window.review.reject(7));await count(0);
    await page.waitForFunction(()=>document.querySelector('#placement').textContent.includes('reader unavailable'));
    assert.equal(await lines(),0);
  });
  await check('shared view removal does not trigger another OCR read or clear valid parent evidence',async()=>{
    await page.evaluate(()=>window.review.replaceReport());await waitCalls(9);
    await page.evaluate(()=>window.review.resolve(8));await count(1);
    await page.evaluate(()=>window.review.replace({consumers:1}));await count(1);
    assert.equal(await calls(),9);assert.equal(await lines(),1);
  });
  await check('unmount aborts pending OCR and suppresses its later completion',async()=>{
    await page.evaluate(()=>window.review.replaceReport());await waitCalls(10);
    await page.evaluate(()=>window.review.unmount());
    assert.equal(await page.evaluate(()=>window.__ocr[9].signal.aborted),true);
    await page.evaluate(()=>window.review.resolve(9));await settle();
    assert.equal(await page.locator('#root').textContent(),'');
  });
  await check('no browser exceptions, external network requests, or provider calls',async()=>{
    assert.deepEqual(errors,[]);assert.deepEqual(blockedExternalRequests,[]);
  });
} catch(error) {
  errors.push(String(error?.stack||error));
  process.exitCode=1;
} finally {
  await browser?.close();await new Promise(resolve=>server.close(resolve));
  const receipt={kind:'INDEPENDENT_SOURCE_PLACEMENT_BROWSER_REVIEW',status:process.exitCode?'FAIL':'PASS',observedAtUtc:new Date().toISOString(),checks,errors,blockedExternalRequests,sourceBuild,providerCalls:0,databaseCalls:0,privateChartReads:0,limitations:['Synthetic local raster and controlled OCR boundary; no real OCR/scanner accuracy or latency acceptance']};
  await mkdir(dirname(output),{recursive:true}); await writeFile(output,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt));
}
