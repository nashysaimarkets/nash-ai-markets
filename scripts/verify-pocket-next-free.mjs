// Free redesign checks: every API request is mocked or aborted before dispatch.
import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
const source=await readFile(new URL('../app/pocket-next/PocketNext.tsx',import.meta.url),'utf8');
const demoSource=source.slice(source.indexOf('const DEMO_ANALYSIS:'),source.indexOf('\nfunction statusOf('));
const successfulReport={...Function(stripTypeScriptTypes(demoSource)+';return DEMO_ANALYSIS;')(),instrument:'US 500',timeframe:'5m'};
const origin=process.argv[2];
if(!origin || !(/^https:\/\/[^/]+\.vercel\.app$/.test(origin)||/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)))throw new Error('Supply the verified immutable Vercel preview origin or isolated local browser fixture.');
const proxyAddress=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
const proxy=proxyAddress&&!origin.startsWith('http://127.0.0.1:')?new URL(proxyAddress):null;
const browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(proxy?{proxy:{server:proxy.origin,username:decodeURIComponent(proxy.username),password:decodeURIComponent(proxy.password)}}:{})});
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,ignoreHTTPSErrors:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let analysisCalls=0,preflightCalls=0,pending=false,success=false,release=()=>{},expectedPrice="6725.50";
const facts={status:'READY',instrument:'US 500',instrumentConfidence:'HIGH',timeframe:'5m',timeframeConfidence:'HIGH',currentPrice:'6725.50',currentPriceConfidence:'HIGH',priceScaleVisible:true,candlesReadable:true,enoughHistory:true,sameInstrument:true,issues:[],guidance:'Clear'};
await page.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname;
 if(path==='/api/pocket/preflight'){preflightCalls++;return route.fulfill({status:200,json:{preflight:facts}});}
 if(path==='/api/pocket/analyse'){
  analysisCalls++;const body=route.request().postDataJSON();
  assert.equal(body.chartConfirmation.instrument,'US 500');assert.equal(body.chartConfirmation.timeframe,'5m');assert.equal(body.chartConfirmation.currentPrice,expectedPrice);
  const crop=Buffer.from(body.precisionImage.split(',')[1],'base64');const meta=await sharp(crop).metadata();assert.equal(meta.width,1400);assert.equal(meta.height,765);
  if(pending)await new Promise(resolve=>{release=resolve;});
  return route.fulfill(success?{status:200,json:{analysis:successfulReport}}:{status:503,json:{error:'Mock analysis only — no provider request'}});
 }
 return route.abort();
});
const buffer=await sharp({create:{width:900,height:600,channels:3,background:'#123456'}}).png().toBuffer();
const upload=async(name)=>{await page.locator('.pnDrop input').setInputFiles({name,mimeType:'image/png',buffer});await page.locator('.psPreflight input').first().waitFor();};
const lock=async()=>{await page.getByLabel('I can read the price scale and candles on this chart.').check();await page.getByRole('button',{name:'CONFIRM & LOCK CHART FACTS'}).click();};
const run=()=>page.locator('.pnRun');const results=[];
try{
 assert.equal((await page.goto(origin+'/pocket-next',{timeout:30000})).status(),200);
 await page.locator('.pnPrivacy input').check();await upload('A.png');
 assert.equal(await run().isEnabled(),false);await lock();assert.equal(await run().isEnabled(),true);
 results.push('image-bound preflight and confirmation PASS');
 await run().click();await page.getByRole('alert').filter({hasText:'Mock analysis only'}).waitFor();assert.equal(analysisCalls,1);
 results.push('confirmed payload and safe mock failure PASS');
 pending=true;await run().click();await expect.poll(()=>analysisCalls).toBe(2);await page.getByRole('button',{name:'CANCEL ANALYSIS'}).click();release();
 await expect(run()).toBeEnabled();await expect(page.locator('.pnError')).toHaveCount(0);
 results.push('in-flight cancellation preserves confirmation PASS');
 await run().click();await expect.poll(()=>analysisCalls).toBe(3);await upload('B.png');release();
 await expect(run()).toBeDisabled();await expect(page.locator('.pnError')).toHaveCount(0);
 results.push('replacement clears lock and rejects stale failure PASS');
 pending=false;success=true;await lock();const before=preflightCalls;await run().click();await page.locator('.psPreflight[data-locked="true"]').waitFor({timeout:5000});assert.equal(preflightCalls,before,'accepted report must retain image-bound facts without a second preflight');await page.getByRole('heading',{name:'Your next steps'}).waitFor({timeout:5000});
 results.push('successful mocked analysis preserves locked source and exposes workflows PASS');
 await page.getByRole('button',{name:'Edit chart facts'}).click();
 await expect(page.locator('.pnResultApp')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Your next steps'})).toHaveCount(0);
 await page.locator('.psPreflight input').first().waitFor();
 expectedPrice='6726.25';await page.getByPlaceholder('e.g. 7658.01').fill(expectedPrice);
 await lock();await expect(page.locator('.pnResultApp')).toHaveCount(0);
 pending=true;await run().click();await expect.poll(()=>analysisCalls).toBe(5);
 await page.getByRole('button',{name:'CANCEL ANALYSIS'}).click();release();
 await expect(run()).toBeEnabled();await expect(page.locator('.pnResultApp')).toHaveCount(0);
 pending=false;await run().click();await page.getByRole('button',{name:'Edit chart facts'}).waitFor();
 results.push('fact edits remove cached report; reconfirmation and cancelled late response cannot restore it PASS');
 expectedPrice='6725.50';await page.locator('.pnChartAdd input').first().setInputFiles({name:'Independent.png',mimeType:'image/png',buffer});
 await page.locator('.psPreflight input').first().waitFor();await lock();await run().click();await page.getByRole('button',{name:'Edit chart facts'}).waitFor();
 await page.locator('.pnChartSwitcher button').filter({hasText:'MAIN'}).click();
 await page.getByRole('button',{name:'Edit chart facts'}).click();await expect(page.locator('.pnResultApp')).toHaveCount(0);
 await page.getByRole('button',{name:'CHART 2',exact:true}).click();await page.getByRole('heading',{name:'Your next steps'}).waitFor();
 await page.locator('.pnChartSwitcher button').filter({hasText:'MAIN'}).click();await expect(page.locator('.pnResultApp')).toHaveCount(0);
 results.push('editing one slot preserves independent report while the edited slot remains invalidated PASS');
 // Return to the retained report to exercise the normal reset control.
 await page.getByRole('button',{name:'CHART 2',exact:true}).click();
 await page.getByRole('button',{name:'NEW ANALYSIS'}).click();
 await page.getByRole('button',{name:'OPEN NO-CREDIT INTERFACE DEMO'}).click();
 await page.getByRole('button',{name:'NEW ANALYSIS'}).waitFor();
 for(const tab of ['Levels','Patterns','Liquidity','Risk'])await page.getByRole('button',{name:new RegExp(tab)}).first().click();
 assert.equal(analysisCalls,7);assert.deepEqual(errors,[]);
 const overflow=await page.evaluate(()=>({viewport:innerWidth,body:document.body.scrollWidth}));assert.ok(overflow.body<=overflow.viewport);
 results.push('synthetic demo tabs and mobile layout PASS');
 await page.getByRole('button',{name:'NEW ANALYSIS'}).click();assert.equal(await run().isEnabled(),false);
 results.push('reset clears report and image PASS');
 console.log(JSON.stringify({results,analysisCalls,preflightCalls,providerCalls:0,jsErrors:errors,overflow,browser:'Chromium emulated mobile; no physical iPhone or paid scanner evidence'},null,2));
}catch(error){console.log(JSON.stringify({results,error:error.message,analysisCalls,preflightCalls,jsErrors:errors}));throw error;}
finally{await browser.close();}
