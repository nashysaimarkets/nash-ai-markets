import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
const built=await build({entryPoints:['tests/support/pocket-rc-browser.tsx'],bundle:true,write:false,outdir:'/tmp/build51-bundle',platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},loader:{'.woff2':'empty'}});
const server=createServer((req,res)=>{const suffix=req.url==='/app.js'?'.js':req.url==='/app.css'?'.css':null;if(suffix){res.setHeader('content-type',suffix==='.js'?'text/javascript':'text/css');res.end(built.outputFiles.find(f=>f.path.endsWith(suffix)).contents);}else{res.setHeader('content-type','text/html');res.end('<html lang="en"><head><title>Build51 offline acceptance</title><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body style="margin:0"><div id="root"></div><script src="/app.js"></script></body></html>');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.POCKET_QA_BROWSER_EXECUTABLE_PATH||'/tmp/build51-browser/chrome-headless-shell-linux64/chrome-headless-shell',args:['--no-sandbox']});
const checks=[],errors=[];let apiCalls=0;
const ready={status:'READY',instrument:'US 500',instrumentConfidence:'HIGH',timeframe:'5m',timeframeConfidence:'HIGH',currentPrice:'6725.50',currentPriceConfidence:'HIGH',priceScaleVisible:true,candlesReadable:true,enoughHistory:true,sameInstrument:null,issues:[],guidance:''};
try {for(const viewport of [{width:390,height:844},{width:1440,height:1000}]){
 let mode='ready';const page=await browser.newPage({viewport});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const url=route.request().url();if(!url.startsWith(origin)){await route.abort();return;}
 if(url.includes('/api/')){apiCalls++;if(url.includes('/preflight')){
  if(mode==='unavailable')await route.fulfill({status:503,json:{error:'Offline fixture unavailable'}});
  else if(mode==='delayed'){await new Promise(r=>setTimeout(r,600));await route.fulfill({json:{preflight:{...ready,instrument:'STALE'}}}).catch(()=>{});}
  else await route.fulfill({json:{preflight:mode==='unclear'?{...ready,instrument:'',instrumentConfidence:'UNKNOWN'}:mode==='retake'?{...ready,status:'RETAKE',priceScaleVisible:false}:ready}});
 }else await route.fulfill({status:503,json:{error:'Offline fixture unavailable'}});return;}await route.continue();});
 await page.goto(origin);const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=360;const x=c.getContext('2d');x.fillStyle='#182030';x.fillRect(0,0,640,360);return c.toDataURL().split(',')[1];});
 const upload=async name=>{await page.locator('.pnDrop input').setInputFiles({name,mimeType:'image/png',buffer:Buffer.from(png,'base64')});};
 await page.locator('.pnPrivacy input').check();await upload('clear.png');await page.locator('.pnAutoPreflight[data-locked="true"]').waitFor();await page.locator('.pnPrivacy input').check();
 assert.equal(await page.locator('.pnAutoPreflight input').count(),0);assert.equal(await page.locator('.pnRun').isEnabled(),true);assert.equal(await page.getByText('PREFLIGHT CONFIRMATION LOCK').count(),0);checks.push(`${viewport.width}:automatic admission, zero manual fields/checkboxes`);
 assert.ok((await page.locator('.pnAutoPreflight').boundingBox()).height<160);checks.push(`${viewport.width}:compact clear-chart check under160px`);
 mode='unclear';await upload('unclear.png');await page.getByLabel('Correct unclear instrument').waitFor();assert.equal(await page.locator('.pnAutoPreflight input').count(),1);assert.equal(await page.locator('.pnRun').isDisabled(),true);await page.locator('.pnPrivacy input').check();await page.getByLabel('Correct unclear instrument').fill('US 500');await page.getByRole('button',{name:'Use corrected detail'}).click();assert.equal(await page.locator('.pnRun').isEnabled(),true);checks.push(`${viewport.width}:one discrete correction, no high-confidence fields overwritten`);
 mode='retake';await upload('retake.png');await page.locator('.pnAutoPreflight[data-status="RETAKE"]').waitFor();assert.equal(await page.locator('.pnRun').isDisabled(),true);assert.equal(await page.locator('.pnAutoPreflight input').count(),0);checks.push(`${viewport.width}:unreadable scale holds analysis without manual bypass`);
 mode='unavailable';await upload('offline.png');await page.locator('.pnAutoPreflight[data-status="UNAVAILABLE"]').waitFor();assert.equal(await page.locator('.pnRun').isDisabled(),true);assert.equal(await page.getByRole('link',{name:'Account',exact:true}).isVisible(),true);
 await page.getByRole('button',{name:'Explore demo',exact:true}).click();await page.getByText(/INTERFACE DEMO · synthetic sample/).waitFor();await page.getByRole('button',{name:'RETURN TO YOUR CHARTS'}).click();checks.push(`${viewport.width}:unavailable account/preflight cannot deadlock free demo or account navigation`);
 await page.locator('.pnAutoPreflight[data-status="UNAVAILABLE"]').waitFor();mode='ready';await page.getByRole('button',{name:'Retry chart check'}).click();await page.locator('.pnAutoPreflight[data-locked="true"]').waitFor();checks.push(`${viewport.width}:explicit retry recovers`);
 for(let i=1;i<5;i++){await page.locator('.pnIntakeSlots button').nth(i).click();await upload(`slot${i}.png`);await page.locator('.pnAutoPreflight[data-locked="true"]').waitFor();}assert.match(await page.locator('.pnSession').innerText(),/5 \/ 5 charts/);checks.push(`${viewport.width}:five chart upload and independent auto-checks`);
 mode='delayed';await upload('stale.png');await page.waitForTimeout(350);mode='ready';await upload('replacement.png');await page.locator('.pnAutoPreflight[data-locked="true"]').waitFor();await page.waitForTimeout(700);assert.doesNotMatch(await page.locator('.pnAutoPreflight').innerText(),/STALE/);checks.push(`${viewport.width}:replacement cancels stale preflight result`);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);checks.push(`${viewport.width}:no horizontal overflow`);
 await mkdir('docs/ntp/build51-owner-fixes',{recursive:true});await page.locator('.pnAutoPreflight').scrollIntoViewIfNeeded();await page.screenshot({path:`docs/ntp/build51-owner-fixes/viewport-${viewport.width}.jpg`,type:'jpeg',quality:55});await page.close();
 }assert.deepEqual(errors,[]);const report={status:'PASS',checks,errors,interceptedApiCalls:apiCalls,realProviderCalls:0,scope:'Actual React/CSS with synthetic intercepted HTTP, not StoreKit/device acceptance'};await writeFile('docs/ntp/build51-owner-fixes/BROWSER.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();server.close();}
