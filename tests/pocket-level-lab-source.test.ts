import assert from 'node:assert/strict';import test from 'node:test';import {readFile} from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';
import {validateLevelLabConfirmation,canOverlayLevelLab} from '../app/pocket/level-lab-source.ts';
const facts={instrument:'US 500',timeframe:'5m',currentPrice:'100',contextMatch:'NOT_PROVIDED' as const};
const report={instrument:'US 500',timeframe:'5m',currentPrice:'100',evidenceQuality:{chartReadability:'CLEAR',scaleReadable:true,candlesReadable:true,instrumentConfidence:'HIGH',timeframeConfidence:'HIGH'},levels:[]};
test('actual independent level handler rejects malformed source facts before budget/provider',async()=>{
 const source=await readFile(new URL('../app/api/pocket/levels/route.ts',import.meta.url),'utf8');
 const post=source.slice(source.indexOf('export async function POST(')).replace('export async function','async function');const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 for(const change of [{currentPrice:'1..2'},{instrument:''},{contextMatch:'MATCHED'}]){
  let touches=0;const bindings={requirePocketScanAccess:async()=>null,validateLevelLabConfirmation,NextResponse:{json:Response.json},MAX_DATA_URL_LENGTH:11_000_000,takePocketBudget:()=>{touches++;return {allowed:false};},pocketBudgetHeaders:()=>({}),createOpenAIClient:()=>{throw new Error('Provider must not be reached');}};
  const handler=await new AsyncFunction(...Object.keys(bindings),stripTypeScriptTypes(post)+'\nreturn POST;')(...Object.values(bindings));
  const response=await handler(new Request('https://preview.test/api/pocket/levels',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image:'data:image/png;base64,AAAA',chartConfirmation:{...facts,...change}})}));
  assert.equal(response.status,400);assert.equal(touches,0);
 }
});
test('separate source report must match locked instrument, timeframe and exact price; model-only identity is held',()=>{
 assert.equal(canOverlayLevelLab(report,facts),true);
 for(const change of [{instrument:'Apple'},{timeframe:'4h'},{currentPrice:'101'},{evidenceQuality:{...report.evidenceQuality,instrumentConfidence:'UNKNOWN'}},{evidenceQuality:{...report.evidenceQuality,scaleReadable:false}}])assert.equal(canOverlayLevelLab({...report,...change},facts),false);
 assert.equal(canOverlayLevelLab(report,null),false);assert.equal(canOverlayLevelLab({...report,instrument:undefined},facts),false);
});

test('actual customer Level Lab keeps a different photo report separate from the primary chart',async()=>{
 const source=await readFile(new URL('../app/pocket/PocketBullseye.tsx',import.meta.url),'utf8');
 const start=source.indexOf('  async function rescanLevelsOnly(');const body=source.slice(start,source.indexOf('  async function reanalyseResult(',start));
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;let primaryWrites=0;let separate:unknown=null;
 const result={...report,plotBounds:{left:5,right:90,top:10,bottom:90},priceScaleAnchors:[{price:110,y:20},{price:100,y:50},{price:90,y:80}],levels:[{kind:'support',price:'95',label:'B source',x:5,x2:90,y:65,y2:65}],levelStory:'B source only'};
 const no=()=>{};const epoch={snapshot:()=>0,isCurrent:()=>true};
 const bindings={analysis:{instrument:'PRIMARY A'},levelLabImage:'B',levelLabRequestActive:{current:false},levelLabController:{current:null},levelLabPreflightStatus:'LOCKED',levelLabConfirmation:facts,preflightAllowsAnalysis:(status:string)=>status==='LOCKED',analysisEpoch:{current:epoch},levelLabUploadEpoch:{current:epoch},setLevelLabStatus:no,setLevelLabError:no,setBattlefieldChart:no,createPrecisionReadingCrop:async()=>null,pocketAuthenticatedFetch:async()=>Response.json({levels:result}),setAnalysis:()=>{primaryWrites++;},setLevelLabResult:(value:unknown)=>{separate=value;},clampY:(value:number)=>value};
 const handler=await new AsyncFunction(...Object.keys(bindings),stripTypeScriptTypes(body)+'\nreturn rescanLevelsOnly;')(...Object.values(bindings));
 await handler();assert.equal(primaryWrites,0,'a separate Level Lab photograph must not rewrite the primary report/overlay');assert.deepEqual(separate,result);
});
