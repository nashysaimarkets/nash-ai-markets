import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {takePocketBudget,pocketBudgetHeaders,resetPocketBudgetsForTesting} from '../app/lib/server/pocket-request-budget.ts';
import {TORTURE_CASES,syntheticSvg,syntheticPrecisionCropSpec,buildTortureRequestPayload,scoreTortureAnalysis,summarizeTortureMeasurements,unwrapTortureAnalysis,aggregateSeparateTortureReports} from './support/pocket-image-torture.ts';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {tortureHttpFailure} from '../app/api/pocket/torture/http-failure.ts';
const require=createRequire(import.meta.url);const sharp=require('sharp');

test('one-case preview requests preserve distinct stable fixture rate-limit identities', async()=>{
 const route=await readFile(new URL('../app/api/pocket/torture/route.ts',import.meta.url),'utf8');
 const helper=route.slice(route.indexOf('async function makePrecisionCrop('),route.indexOf('type Counts='));
 const handler=route.slice(route.indexOf('export async function GET(')).replace('export async function','async function');
 const addresses:string[]=[];
 const bindings={sharp,syntheticPrecisionCropSpec,TORTURE_CASES,syntheticSvg,buildTortureRequestPayload,tortureHttpFailure,mayRunLiveTorture:()=>true,isBenchmarkPilotSpendHeld:()=>false,
  withPocketTestSpendScope:async(_id:string,run:()=>Promise<unknown>)=>({value:await run(),reconciliation:{reconciled:true,capExceeded:false,committedMicroUsd:1}}),
  recordPocketBenchmarkMeasurement:async()=>({ok:true}),releasePocketBenchmarkMeasurement:async()=>({released:false}),
  analyse:async(req:Request)=>{addresses.push(req.headers.get('x-forwarded-for')!);return Response.json({error:'No provider in this test'},{status:503});},
  summarizeTortureMeasurements:()=>({measurementComplete:false}),NextResponse:{json:(body:unknown)=>body}};
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const get=await new AsyncFunction(...Object.keys(bindings),stripTypeScriptTypes(helper+handler)+'\nreturn GET;')(...Object.values(bindings));
 const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV='preview';
 try{
  for(const sample of TORTURE_CASES)await get(new Request('https://preview.test/api/pocket/torture?run=1&case='+sample.id));
  assert.equal(new Set(addresses).size,6,'six separately selected fixtures must not share the first loop index');
  await get(new Request('https://preview.test/api/pocket/torture?run=1&case='+TORTURE_CASES[0]!.id));
  assert.equal(addresses[6],addresses[0],'retries must retain their per-case application allowance');
 }finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}
});

test('429 attribution requires the actual application marker; other failures remain unmeasured transport evidence',()=>{
 const local=tortureHttpFailure(new Response(null,{status:429,headers:{'x-pocket-rate-limit-source':'application','retry-after':'12','x-ratelimit-limit':'4','x-ratelimit-remaining':'0','x-ratelimit-reset':'999'}}));
 assert.deepEqual(local,{failureClass:'APPLICATION_RATE_LIMIT',retryAfter:'12',applicationRateLimit:{limit:'4',remaining:'0',reset:'999'}});
 assert.equal(tortureHttpFailure(new Response(null,{status:429})).failureClass,'UNATTRIBUTED_RATE_LIMIT');
 assert.equal(tortureHttpFailure(new Response(null,{status:503})).failureClass,'HTTP_ERROR');
});

test('fifth same-IP analysis is locally limited with explicit origin and retry evidence',()=>{
 resetPocketBudgetsForTesting();
 try{
  const request=new Request('https://preview.test/api/pocket/analyse',{headers:{'x-forwarded-for':'10.77.0.1'}});
  for(let i=0;i<4;i++)assert.equal(takePocketBudget(request,'analyse',1000).allowed,true);
  const denied=takePocketBudget(request,'analyse',1000);
  assert.equal(denied.allowed,false);assert.equal(denied.remaining,0);
  const headers=pocketBudgetHeaders(denied);
  assert.equal(headers['retry-after'],'1800');
  assert.equal(headers['x-pocket-rate-limit-source'],'application');
 }finally{resetPocketBudgetsForTesting();}
});

 test('actual preview handler distinguishes scored acceptance 422 from an unscored 422', async()=>{
 const route=await readFile(new URL('../app/api/pocket/torture/route.ts',import.meta.url),'utf8');
 const helper=route.slice(route.indexOf('async function makePrecisionCrop('),route.indexOf('type Counts='));
 const handler=route.slice(route.indexOf('export async function GET(')).replace('export async function','async function');
 let analysisStatus=200;
 const bindings={sharp,syntheticPrecisionCropSpec,TORTURE_CASES,syntheticSvg,buildTortureRequestPayload,tortureHttpFailure,scoreTortureAnalysis,summarizeTortureMeasurements,unwrapTortureAnalysis,
 mayRunLiveTorture:()=>true,isBenchmarkPilotSpendHeld:()=>false,withPocketTestSpendScope:async(_id:string,run:()=>Promise<unknown>)=>({value:await run(),reconciliation:{reconciled:true,capExceeded:false,committedMicroUsd:1}}),
 recordPocketBenchmarkMeasurement:async()=>({ok:true}),releasePocketBenchmarkMeasurement:async()=>({released:false}),
 analyse:async()=>Response.json(analysisStatus===200?{analysis:{levels:[],patterns:[],liquidity:{state:'NONE',event:'NONE',zones:[]}}}:{error:'Incomplete analysis'},{status:analysisStatus}),NextResponse:{json:Response.json}};
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const get=await new AsyncFunction(...Object.keys(bindings),stripTypeScriptTypes(helper+handler)+'\nreturn GET;')(...Object.values(bindings));
 const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV='preview';
 try{
  const request=()=>new Request('https://preview.test/api/pocket/torture?run=1&case=range-clear');
  const scoredResponse=await get(request());assert.equal(scoredResponse.status,422);
  const report=await scoredResponse.json();assert.equal(report.casePass,false);assert.equal(report.observations[0].scored,true);assert.equal(report.observations[0].httpStatus,200);assert.equal(report.observations[0].benchmarkHttpStatus,422);assert.equal(report.observations[0].analysisHttpStatus,200);
  const aggregate=aggregateSeparateTortureReports([report]);assert.equal(aggregate.measuredCases,1);assert.equal(aggregate.metrics.levels.fn,2);
  analysisStatus=422;const unscored=await (await get(request())).json();assert.equal(unscored.observations[0].scored,false);assert.equal(aggregateSeparateTortureReports([unscored]).measuredCases,0);
 }finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}
 });

test('preview preserves provider 429 and 503 diagnostics instead of rewriting them as benchmark 422', async()=>{
 const route=await readFile(new URL('../app/api/pocket/torture/route.ts',import.meta.url),'utf8');
 const helper=route.slice(route.indexOf('async function makePrecisionCrop('),route.indexOf('type Counts='));
 const handler=route.slice(route.indexOf('export async function GET(')).replace('export async function','async function');
 let analysisStatus=429;
 const bindings={sharp,syntheticPrecisionCropSpec,TORTURE_CASES,syntheticSvg,buildTortureRequestPayload,tortureHttpFailure,scoreTortureAnalysis,summarizeTortureMeasurements,unwrapTortureAnalysis,
 mayRunLiveTorture:()=>true,isBenchmarkPilotSpendHeld:()=>false,withPocketTestSpendScope:async(_id:string,run:()=>Promise<unknown>)=>({value:await run(),reconciliation:{reconciled:true,capExceeded:false,committedMicroUsd:1}}),
 recordPocketBenchmarkMeasurement:async()=>({ok:true}),releasePocketBenchmarkMeasurement:async()=>({released:false}),
 analyse:async()=>Response.json({error:analysisStatus===429?'Rate limited':'Unavailable'},{status:analysisStatus,headers:analysisStatus===429?{'x-pocket-rate-limit-source':'application'}:{}}),NextResponse:{json:Response.json}};
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
 const get=await new AsyncFunction(...Object.keys(bindings),stripTypeScriptTypes(helper+handler)+'\nreturn GET;')(...Object.values(bindings));
 const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV='preview';
 try{
  for(const status of [429,503]){
   analysisStatus=status;
   const response=await get(new Request('https://preview.test/api/pocket/torture?run=1&case=range-clear'));
   assert.equal(response.status,422);
   const report=await response.json();
   assert.equal(report.observations[0].scored,false);
   assert.equal(report.observations[0].httpStatus,status);
   assert.equal(report.observations[0].analysisHttpStatus,status);
   assert.equal(report.observations[0].benchmarkHttpStatus,422);
  }
 }finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old;}
});
