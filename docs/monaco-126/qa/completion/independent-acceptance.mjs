import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {pathToFileURL} from 'node:url';
const scanner=process.argv[3]??process.cwd();
const nativeRoot=process.argv[2]??process.cwd();
const {readVisibleRsi}=await import(pathToFileURL(`${scanner}/app/pocket/indicator-reading.ts`));
const {calculateRiskDesk}=await import(pathToFileURL(`${scanner}/app/pocket/pocket-risk-desk.ts`));
const {calculateRTargets}=await import(pathToFileURL(`${scanner}/app/pocket/pocket-chart-toolkit.ts`));
const {calibratePocketAnalysis}=await import(pathToFileURL(`${scanner}/app/api/pocket/analysis-calibration.ts`));
let passed=0,failed=0;const cases=[];
async function check(name,fn){try{await fn();passed++;cases.push({name,status:'PASS'});}catch(e){failed++;cases.push({name,status:'FAIL',error:e.message});}}
await check('RSI explicit valid numeric extremes',()=>{for(const [v,expected]of [['RSI:0',0],['RSI(14):100',100],['RSI is at .05',.05],['RSI: +61.5',61.5]])assert.equal(readVisibleRsi(v),expected);});
await check('RSI negative/uncertain/conflicting data rejected',()=>{for(const v of ['RSI14','RSI:101','RSI:-5','RSI:65%','No readable RSI:65','RSI:1e2','RSI:65/70','RSI:65; RSI:35'])assert.equal(readVisibleRsi(v),null,v);});
await check('RSI alternative or historical readings cannot become current values',()=>{for(const v of ['RSI:65 or 35','Previous RSI:65','Yesterday RSI:65'])assert.equal(readVisibleRsi(v),null,v);});
await check('risk math remains finite for ordinary and extreme inputs',()=>{const good=calculateRiskDesk({accountValue:'10,000',riskPercent:'0.5',stopDistance:'12.5',valuePerPoint:'2'});assert.deepEqual([good.cashRisk,good.riskPerUnit,good.units],[50,25,2]);for(const n of ['1'+'0'.repeat(308),'0.'+'0'.repeat(320)+'1']){const r=calculateRiskDesk({accountValue:n,riskPercent:'100',stopDistance:n,valuePerPoint:n});for(const v of Object.values(r))assert.ok(v===null||Number.isFinite(v));}});
await check('short targets never contain nonpositive or nonfinite numbers',()=>{for(const [e,s] of [['100','101'],['100','190'],['100','200'],['1','1000']]){const v=calculateRTargets(e,s,'SHORT');if(v)assert.ok(v.targets.every(t=>Number.isFinite(t.price)&&t.price>0));}});
function patterns(name,ys){return calibratePocketAnalysis({evidenceQuality:{chartReadability:'CLEAR',candlesReadable:true,instrumentConfidence:'HIGH',timeframeConfidence:'HIGH',scaleReadable:false},patterns:[{name,status:'FORMING',confidence:'MEDIUM',evidence:'Visible path',confirmation:'Break',invalidation:'Invalid',geometry:{points:ys.map((y,i)=>({x:10+i*10,y}))}}]}).patterns;}
await check('named reversals preserve mirrored positive paths and reject monotonic paths',()=>{for(const [name,good]of [['HEAD & SHOULDERS',[30,60,10,60,30]],['INVERSE H&S',[60,30,90,30,60]],['DOUBLE TOP',[30,60,30]],['DOUBLE BOTTOM',[60,30,60]]]){assert.equal(patterns(name,good).length,1);assert.equal(patterns(name,[20,40,60,80,90]).length,0);}});
const flush=()=>new Promise(r=>setImmediate(r));
await check('actual native bridge must not verify an initially inactive application',async()=>{
const src=readFileSync(`${nativeRoot}/app/pocket/apple-storekit.ts`,'utf8');const start=src.indexOf('export async function subscribeAppleAccessChanges'),end=src.indexOf('/** Every billed route',start);const code=stripTypeScriptTypes(src.slice(start,end).replace(/^export /,''));
let notify;let getStateCalls=0;const results=[];const status={isNative:true,entitled:true,freeUseConsumed:true,productId:'p',displayName:'Pocket',displayPrice:'£4.99'};
const native={addListener:async(_,cb)=>{notify=cb;return{remove:async()=>{}};},getStatus:async()=>status};
const App={addListener:async()=>({remove:async()=>{}}),getState:async()=>{getStateCalls++;return{isActive:false};}};
const subscribe=new Function('native','App','verifyStatus','isAppleNativeApp','webStatus','APPLE_MONTHLY_PRODUCT_ID',code+';return subscribeAppleAccessChanges;')(native,App,async s=>s,()=>true,{...status,entitled:false},'p');
const handle=await subscribe((s,p)=>results.push({s,p}));notify(status);await flush();assert.ok(getStateCalls>0,'initial App.getState observation required');assert.equal(results.some(r=>r.p==='VERIFIED'),false);await handle.remove();});
process.stdout.write(JSON.stringify({passed,failed,cases},null,2)+'\n');process.exitCode=failed?1:0;
