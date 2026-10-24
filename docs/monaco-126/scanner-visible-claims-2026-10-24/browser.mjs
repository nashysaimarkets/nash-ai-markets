import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root='/workspace/scratch/35c5363ca2aa/claims-app',out='/workspace/scratch/35c5363ca2aa/claims-evidence';
const require=createRequire(root+'/package.json'),{build}=require('esbuild'),{chromium}=require('@playwright/test');
const {calibratePocketAnalysis}=await import(pathToFileURL(root+'/app/api/pocket/analysis-calibration.ts'));
const {collectSourcePriceCandidates}=await import(pathToFileURL(root+'/app/pocket/source-price-candidates.ts'));
const {prepareScannerReport}=await import(pathToFileURL(root+'/app/pocket/scanner-claims.ts'));
const fixtures=JSON.parse(await readFile(out+'/fixtures.json','utf8'));
for(const f of fixtures)f.report=prepareScannerReport({...calibratePocketAnalysis({...f.main,currentPrice:f.confirmation.currentPrice}),sourcePriceCandidates:collectSourcePriceCandidates(f.main)});
// d002 full retained merge/calibration replay from accepted earlier browser result.
fixtures[1].report=prepareScannerReport(JSON.parse(await readFile('/workspace/scratch/35c5363ca2aa/d002-offline-evidence/BROWSER.json','utf8')).result.report);
const cssImports=[...((await readFile(root+'/app/pocket/page.tsx','utf8')).matchAll(/import "(.*?\.css)"/g))].map(m=>'import '+JSON.stringify('./app/pocket/'+m[1].slice(2))+';').join('\n');
const entry=cssImports+`import './app/globals.css';import React from 'react';import {createRoot} from 'react-dom/client';import PocketNext from './app/pocket-next/PocketNext.tsx';import PocketBullseye from './app/pocket/PocketBullseye.tsx';import './app/pocket-next/pocket-next.css';
const macro={status:'UNAVAILABLE',events:[],observations:[],limitations:[],releases:[]};createRoot(document.getElementById('root')).render(location.pathname==='/legacy'?<PocketBullseye macroContext={macro}/>:<PocketNext/>);`;
const built=await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',outdir:'/virtual',external:['/brand/*'],define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'actual-global-css',setup(b){b.onLoad({filter:/app\/globals\.css$/},async a=>({contents:(await require('postcss')([require('@tailwindcss/postcss')({base:root})]).process(await readFile(a.path,'utf8'),{from:a.path})).css,loader:'css',resolveDir:root+'/app'}));}},{name:'offline-native-boundary',setup(b){b.onResolve({filter:/^@capacitor\/(core|app)$/},a=>({path:a.path,namespace:'offline-native'}));b.onLoad({filter:/.*/,namespace:'offline-native'},()=>({contents:`export const Capacitor={isNativePlatform:()=>false,getPlatform:()=>'web'};export const registerPlugin=()=>({});export const App={getState:async()=>({isActive:true}),addListener:async()=>({remove:()=>{}})};`,loader:'js'}));}}]});
let nextResponse=0,mode='normal',pending=null;const requests=[],errors=[],external=[],results=[],lifecycle=[];
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(built.outputFiles.find(f=>f.path.endsWith('.js')).contents);}
 if(url.pathname==='/bundle.css'){res.setHeader('content-type','text/css');return res.end(built.outputFiles.find(f=>f.path.endsWith('.css'))?.contents??'');}
 if(url.pathname.startsWith('/ocr/')){const name=url.pathname;if(name.includes('..'))throw Error('path');res.setHeader('content-type',name.endsWith('.js')?'text/javascript':name.endsWith('.wasm')?'application/wasm':'application/octet-stream');return res.end(await readFile(root+'/public'+name));}
 if(url.pathname.startsWith('/api/')){
  requests.push(url.pathname);res.setHeader('content-type','application/json');
  if(url.pathname==='/api/pocket/analyse'){
   const f=fixtures[nextResponse];if(mode==='pending'){pending=res;return;}
   return res.end(JSON.stringify({analysis:mode==='malformed'?{status:'incomplete',levels:[]}:f.report}));
  }
  res.statusCode=503;return res.end(JSON.stringify({error:'Offline test: manual chart confirmation required'}));
 }
 res.setHeader('content-type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/bundle.css"><div id="root"></div><script src="/bundle.js"></script>');
}catch(e){res.statusCode=500;res.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:'/tmp/pocket-image-browsers/chromium_headless_shell-1193/chrome-linux/headless_shell',args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:390,height:844}});await context.route('**/*',route=>{const u=route.request().url();if(u.startsWith(origin+'/')||u.startsWith('data:')||u.startsWith('blob:'))return route.continue();external.push(u);return route.abort();});
const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(origin);console.log('READY',await page.locator('input[type=file]').evaluateAll(xs=>xs.map(x=>x.getAttribute('aria-label'))));
 await writeFile(out+'/INITIAL-DOM.txt',await page.locator('body').innerText());
 // Workflow actions appended below; use real uploads, manual facts and local response transport.
 for(let i=0;i<5;i++){
  nextResponse=i;const f=fixtures[i];
  if(i) await page.getByLabel(new RegExp('^Add chart '+(i+1)+',')).setInputFiles(f.image);
  else await page.locator('input[type=file]').first().setInputFiles(f.image);
  await page.getByPlaceholder('e.g. US 500').fill(f.confirmation.instrument);
  await page.getByPlaceholder('e.g. 30m').fill(f.confirmation.timeframe);
  await page.getByPlaceholder('e.g. 7658.01').fill(f.confirmation.currentPrice);
  await page.getByRole('checkbox',{name:'I can read the price scale and candles on this chart.'}).check();
  await page.getByRole('button',{name:'CONFIRM & LOCK CHART FACTS'}).click();
  const privacy=page.getByRole('checkbox',{name:/removed account|personal details|removed my name/i});if(await privacy.count())await privacy.first().check();

  await page.getByRole('button',{name:/ANALYSE THIS CHART|ANALYSE CHART|RUN ANALYSIS|CHALLENGE MY SETUP/i}).first().click();
  await page.getByRole('region',{name:'Scanner claim validation'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Scanner claim validation"]')?.textContent.includes('PRICE POSITIONS CHECKED')||document.querySelector('[aria-label="Scanner claim validation"]')?.textContent.includes('PRICE CHECK HOLD'),null,{timeout:55000});
  await page.waitForTimeout(3500);
  results.push({case:f.case,status:await page.getByRole('region',{name:'Scanner claim validation'}).innerText(),lines:await page.locator('.psOriginalEvidence svg line').evaluateAll(xs=>xs.map(x=>Object.fromEntries(['x1','x2','y1','y2'].map(k=>[k,Number(x.getAttribute(k))]))))});
 }

 // Switching must bind proof to the active source; unlocking revokes proof.
 await page.getByRole('button',{name:/^Chart 2,/}).click();
 await page.waitForFunction(()=>document.querySelector('[aria-label="Scanner claim validation"]')?.textContent.includes('83986.9411'),null,{timeout:55000});
 assert.equal(await page.locator('.psOriginalEvidence svg line').count(),3);
 lifecycle.push('switch restores chart2 own three lines');
 await page.getByRole('button',{name:'Edit chart facts'}).click();
 assert.equal(await page.locator('.psOriginalEvidence svg line').count(),0);
 assert.equal(await page.getByRole('region',{name:'Scanner claim validation'}).count(),0);
 lifecycle.push('unlock revokes proof');
 await page.getByLabel('Replace chart 2',{exact:true}).setInputFiles(fixtures[4].image);
 await page.getByPlaceholder('e.g. US 500').fill(fixtures[4].confirmation.instrument);
 await page.getByPlaceholder('e.g. 30m').fill(fixtures[4].confirmation.timeframe);
 await page.getByPlaceholder('e.g. 7658.01').fill(fixtures[4].confirmation.currentPrice);
 await page.getByRole('checkbox',{name:'I can read the price scale and candles on this chart.'}).check();
 await page.getByRole('button',{name:'CONFIRM & LOCK CHART FACTS'}).click();
 assert.equal(await page.getByRole('region',{name:'Scanner claim validation'}).count(),0);
 lifecycle.push('replacement clears old report');
 await page.getByRole('checkbox',{name:/removed account|personal details|removed my name/i}).first().check();
 mode='malformed';
 await page.getByRole('button',{name:/ANALYSE CHART 2/}).click();
 await page.getByText('Scanner result HOLD: incomplete or malformed report. No result was accepted.').waitFor();
 assert.equal(await page.getByRole('region',{name:'Scanner claim validation'}).count(),0);
 lifecycle.push('malformed response rejected in actual UI');
 mode='pending';
 await page.getByRole('button',{name:/ANALYSE CHART 2/}).click();
 await page.getByRole('button',{name:/CANCEL CHART 2/}).click();
 if(pending){pending.end(JSON.stringify({analysis:fixtures[1].report}));pending=null;}
 await page.waitForTimeout(100);
 assert.equal(await page.getByRole('region',{name:'Scanner claim validation'}).count(),0);
 lifecycle.push('cancelled response cannot revive old proof');
 mode='normal';nextResponse=1;
 await page.goto(origin+'/legacy');
 await page.locator('input[type=file]').first().setInputFiles(fixtures[1].image);
 await page.getByPlaceholder('e.g. US 500').fill(fixtures[1].confirmation.instrument);
 await page.getByPlaceholder('e.g. 30m').fill(fixtures[1].confirmation.timeframe);
 await page.getByPlaceholder('e.g. 7658.01').fill(fixtures[1].confirmation.currentPrice);
 await page.getByRole('checkbox',{name:'I can read the price scale and candles on this chart.'}).check();
 await page.getByRole('button',{name:'CONFIRM & LOCK CHART FACTS'}).click();
 await page.getByRole('checkbox',{name:/removed account|personal details|removed my name/i}).first().check();
 await page.getByRole('button',{name:/CHALLENGE MY SETUP/}).click();
 await page.getByRole('region',{name:'Scanner claim validation'}).waitFor();
 await page.waitForFunction(()=>document.querySelector('[aria-label="Scanner claim validation"]')?.textContent.includes('83986.9411'),null,{timeout:55000});
 assert.match(await page.getByRole('region',{name:'Scanner claim validation'}).innerText(),/ANALYSIS UNVERIFIED/);
 lifecycle.push('customer legacy UI retained d002 renders unverified with checked placement');
 await page.screenshot({path:out+'/legacy-claims.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
}catch(e){errors.push(String(e.stack??e));console.log('FAILED',errors.at(-1));console.log('DOM',(await page.locator('body').innerText()).slice(-5500));process.exitCode=1;}
finally{await writeFile(out+'/BROWSER.json',JSON.stringify({status:process.exitCode?'FAIL':'PASS',results,lifecycle,errors,external,requests,providerCalls:0,scope:'Actual UI components/local transport, native plugin boundary stub; not production HTTP/auth or paid execution'},null,2)+'\n');await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
