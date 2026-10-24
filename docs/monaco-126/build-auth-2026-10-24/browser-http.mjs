import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire('/workspace/scratch/35c5363ca2aa/build-auth-app/package.json'),{chromium}=require('@playwright/test');
export async function run({origin,cookie,fixtures,setCase,out}){
 const browser=await chromium.launch({headless:true,executablePath:'/tmp/pocket-image-browsers/chromium_headless_shell-1193/chrome-linux/headless_shell',args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:390,height:844},extraHTTPHeaders:{'x-forwarded-for':'192.0.2.250'}});
 const [name,value]=cookie('paid').split('=');await context.addCookies([{name,value,url:origin}]);
 const errors=[],external=[],results=[],checks=[];const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(u.hostname)||['data:','blob:'].includes(u.protocol))return route.continue();external.push(u.origin);return route.abort();});
 try{
 await page.goto(origin+'/pocket-next');
 for(let i=0;i<5;i++){
  const f=fixtures[i];await setCase(i);
  if(i)await page.getByLabel(new RegExp('^Add chart '+(i+1)+',')).setInputFiles(f.image);else await page.getByLabel('Add chart 1',{exact:true}).setInputFiles(f.image);
  await page.getByPlaceholder('e.g. US 500').waitFor();
  await page.getByPlaceholder('e.g. US 500').fill(f.confirmation.instrument);await page.getByPlaceholder('e.g. 30m').fill(f.confirmation.timeframe);await page.getByPlaceholder('e.g. 7658.01').fill(f.confirmation.currentPrice);
  await page.getByRole('checkbox',{name:'I can read the price scale and candles on this chart.'}).check();await page.getByRole('button',{name:'CONFIRM & LOCK CHART FACTS'}).click();
  await page.getByRole('checkbox',{name:/removed account|personal details|removed my name/i}).first().check();
  const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/pocket/analyse'));
  await page.getByRole('button',{name:/ANALYSE CHART/}).first().click();const response=await responsePromise;
  if(i===4){assert.equal(response.status(),429);checks.push('fifth scan denied by unchanged four-analysis window');assert.equal(await page.getByRole('region',{name:'Scanner claim validation'}).count(),0);await writeFile(out+'/clock-offset.txt','1860000');const retry=page.waitForResponse(r=>r.url().endsWith('/api/pocket/analyse'));await page.getByRole('button',{name:/ANALYSE CHART/}).first().click();assert.equal((await retry).status(),200);checks.push('fifth chart accepted only after isolated virtual budget window expiry');}else assert.equal(response.status(),200);
  await page.getByRole('region',{name:'Scanner claim validation'}).waitFor();await page.waitForTimeout(3500);
  results.push({case:f.case,status:await page.getByRole('region',{name:'Scanner claim validation'}).innerText(),lines:await page.locator('.psOriginalEvidence svg line').evaluateAll(xs=>xs.map(x=>Object.fromEntries(['x1','x2','y1','y2'].map(k=>[k,Number(x.getAttribute(k))]))))});
 }
 await page.getByRole('button',{name:/^Chart 2,/}).click();await page.waitForFunction(()=>document.querySelector('[aria-label="Scanner claim validation"]')?.textContent.includes('83986.9411'),null,{timeout:55000});assert.equal(await page.locator('.psOriginalEvidence svg line').count(),3);checks.push('switch retains d002 image-bound three price positions');
 await page.getByRole('button',{name:'Edit chart facts'}).click();assert.equal(await page.locator('.psOriginalEvidence svg line').count(),0);checks.push('unlock clears proof');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 }finally{await writeFile(out+'/BROWSER.json',JSON.stringify({results,checks,errors,external,scope:'Real next start production HTTP/auth and actual browser. Only upstream auth/entitlement/provider fixtures and local Node clock are controlled. Original four-request quota preserved.'},null,2)+'\n');await browser.close();}
}
