// Free browser checks: EVERY API request is intercepted or aborted. Never exercise paid providers.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('@playwright/test'); const sharp=require('sharp');
const proxyAddress=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
const proxyUrl=proxyAddress ? new URL(proxyAddress) : null;
if (!process.argv[2] || !/^https:\/\/[^/]+\.vercel\.app$/.test(process.argv[2])) throw new Error('Supply the verified immutable Vercel preview origin.');
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(proxyUrl ? {proxy:{server:proxyUrl.origin,username:decodeURIComponent(proxyUrl.username),password:decodeURIComponent(proxyUrl.password)}} : {})});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,ignoreHTTPSErrors:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let mode='ready', sameInstrument=true, analysisCalls=0, preflightCalls=0;let releaseAnalysis=()=>{};
const facts={status:'READY',instrument:'US 500',instrumentConfidence:'HIGH',timeframe:'5m',timeframeConfidence:'HIGH',currentPrice:'6725.50',currentPriceConfidence:'HIGH',priceScaleVisible:true,candlesReadable:true,enoughHistory:true,sameInstrument:true,issues:[],guidance:'Clear'};
await page.route('**/api/**',async r=>{
 const path=new URL(r.request().url()).pathname;
 if(path==='/api/pocket/preflight'){preflightCalls++;return r.fulfill({status:mode==='unavailable'?503:200,json:mode==='unavailable'?{error:'Mock preflight unavailable'}:{preflight:{...facts,sameInstrument,priceScaleVisible:mode!=='unreadable'}}});}
 if(path==='/api/pocket/analyse'){analysisCalls++;if(mode==='pending') await new Promise(resolve=>{releaseAnalysis=resolve;});return r.fulfill({status:503,json:{error:'Mock analysis only — no provider request'}});}
 return r.abort();
});
const img=await sharp({create:{width:900,height:600,channels:3,background:'#123456'}}).png().toBuffer();
const upload=async(name='A.png')=>{await page.getByLabel('Load chart photo, screenshot or camera roll image').setInputFiles({name,mimeType:'image/png',buffer:img});await page.locator('.psPreflight input').first().waitFor();};
const button=()=>page.getByRole('button',{name:'CONFIRM & LOCK CHART FACTS'});
const scale=()=>page.getByLabel('I can read the price scale and candles on this chart.');
const analyse=()=>page.locator('.psAnalyse');
const results=[];let last=performance.now();
const checkpoint=(check)=>{const now=performance.now();results.push({check,durationMs:Math.round(now-last)});last=now;};
try{
 const response=await page.goto(process.argv[2]+'/pocket',{timeout:30000});assert.equal(response.status(),200);
 await page.getByRole('heading',{name:'One chart. One honest challenge.'}).waitFor();
 await page.locator('.psPrivacy input').check();
 await upload(); assert.equal(await button().isEnabled(),false);await scale().check();await button().click();assert.equal(await analyse().isEnabled(),true);checkpoint('primary upload and visible-axis lock PASS');
 await upload('B.png'); assert.equal(await button().isEnabled(),false);assert.equal(await scale().isChecked(),false);assert.equal(await analyse().isEnabled(),false);checkpoint('replacement clears confirmation PASS');
 sameInstrument=false;await page.getByLabel('Add optional higher-timeframe chart').setInputFiles({name:'context.png',mimeType:'image/png',buffer:img});await page.getByText('MISMATCH',{exact:true}).waitFor();await scale().check();assert.equal(await button().isEnabled(),false);assert.equal(await analyse().isEnabled(),false);checkpoint('context mismatch blocks lock and analysis PASS');
 await page.getByRole('button',{name:'REMOVE',exact:true}).click();sameInstrument=null;await page.getByLabel('Add optional higher-timeframe chart').setInputFiles({name:'uncertain.png',mimeType:'image/png',buffer:img});await page.getByText('UNCONFIRMED',{exact:true}).waitFor();await scale().check();assert.equal(await button().isEnabled(),false);await page.getByLabel('I checked that both charts show the same instrument.').check();await button().click();await page.getByText('TRADER CONFIRMED',{exact:true}).waitFor();checkpoint('unknown context needs explicit acknowledgement PASS');
 await page.getByRole('button',{name:'REMOVE',exact:true}).click();mode='unavailable';await upload('C.png');await page.getByText('Mock preflight unavailable Confirm the chart facts manually before analysis.').waitFor();assert.equal(await analyse().isEnabled(),false);await page.getByPlaceholder('e.g. US 500').fill('US 500');await page.getByPlaceholder('e.g. 30m').fill('5m');await page.getByPlaceholder('e.g. 7658.01').fill('1..2');await scale().check();assert.equal(await button().isEnabled(),false);await page.getByPlaceholder('e.g. 7658.01').fill('6725.50');await button().click();assert.equal(await analyse().isEnabled(),true);checkpoint('503 manual fallback and invalid-price rejection PASS');
 await analyse().click();await page.getByRole('alert').waitFor();assert.equal(analysisCalls,1);checkpoint('mock analysis dispatch and safe error PASS');
 mode='unreadable';await upload('D.png');await scale().check();assert.equal(await button().isEnabled(),false);checkpoint('missing price scale blocks lock PASS');
 mode='pending';await upload('E.png');await scale().check();await button().click();await analyse().click();await page.getByRole('button',{name:'CANCEL ANALYSIS'}).waitFor();await page.getByRole('button',{name:'CANCEL ANALYSIS'}).click();await page.waitForFunction(()=>!document.querySelector('.psAnalyse').disabled);releaseAnalysis();await page.waitForTimeout(150);assert.equal(await page.locator('.psMessage').count(),0);assert.equal(await page.locator('.psPreflight').getAttribute('data-locked'),'true');checkpoint('cancel aborts delayed mock and preserves lock PASS');
 await analyse().click();await page.getByRole('button',{name:'CANCEL ANALYSIS'}).waitFor();await upload('F.png');releaseAnalysis();await page.waitForTimeout(150);assert.equal(await page.locator('.psMessage').count(),0);assert.equal(await analyse().isEnabled(),false);assert.equal(await page.locator('.psUpload small').innerText(),'F.png');checkpoint('replacement aborts delayed mock and ignores stale error PASS');
 assert.equal(analysisCalls,3);assert.deepEqual(errors,[]);
 const overflow=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth}));
 console.log(JSON.stringify({results,analysisCalls,preflightCalls,providerCalls:0,jsErrors:errors,overflow,browser:'Chromium emulated mobile 390x844; no physical device or real subscription test'},null,2));
}catch(e){console.log(JSON.stringify({results,error:e.message,analysisCalls,preflightCalls,jsErrors:errors}));throw e;}finally{await browser.close();}
