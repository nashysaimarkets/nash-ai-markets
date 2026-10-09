import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { createChartRequestEpoch } from '../app/pocket/chart-request-identity.ts';

const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
test('actual full-analysis transport is abortable and cancellation preserves the fact lock',async()=>{
 const client=await readFile(new URL('../app/pocket/PocketBullseye.tsx',import.meta.url),'utf8');
 const source=client.slice(client.indexOf('  async function requestPocketAnalysis('),client.indexOf('  async function analyse('));
 let started!:()=>void;const dispatched=new Promise<void>(resolve=>{started=resolve;});
 const analysisController={current:null as AbortController|null};
 const analysisEpoch={current:createChartRequestEpoch()};let signal:AbortSignal|undefined;const busy:boolean[]=[];
 const bindings={image:'A',analysisRequestActive:{current:false},analysisController,analysisEpoch,setBusy:(value:boolean)=>busy.push(value),intention:'UNSURE',preflightStatus:'LOCKED',preflightAllowsAnalysis:()=>true,chartConfirmation:{instrument:'US 500',timeframe:'5m',currentPrice:'100',contextMatch:'NOT_PROVIDED'},accuracyCorrection:null,analysisCacheKey:async()=> 'A',analysisCacheGet:async()=>null,hasVerifiedStructuralLevel:()=>false,createPrecisionReadingCrop:async()=>null,fetch:async(_url:string,options:{signal?:AbortSignal})=>{signal=options.signal;started();return new Promise((_resolve,reject)=>{signal?.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')),{once:true});});}};
 const request=await new AsyncFunction(...Object.keys(bindings),stripTypeScriptTypes(source)+'\nreturn requestPocketAnalysis;')(...Object.values(bindings));
 const pending=request(null);await dispatched;
 assert.ok(signal,'fetch needs an abort signal');
 const start=client.indexOf('  function cancelAnalysis(');assert.ok(start>0,'scan must expose cancellation');
 const cancelSource=client.slice(start,client.indexOf('  async function requestPocketAnalysis(',start));
 const cancel=new Function('analysisController','analysisEpoch','setBusy',stripTypeScriptTypes(cancelSource)+'\nreturn cancelAnalysis;')(analysisController,analysisEpoch,bindings.setBusy);
 cancel();await assert.rejects(pending,{name:'AbortError'});
 assert.equal(signal.aborted,true);assert.equal(bindings.preflightStatus,'LOCKED');assert.equal(bindings.analysisRequestActive.current,false);assert.equal(busy.at(-1),false);
});

test('actual chart replacement aborts the full scan transport and clears confirmation',async()=>{
 const client=await readFile(new URL('../app/pocket/PocketBullseye.tsx',import.meta.url),'utf8');
 const start=client.indexOf('  function invalidateChartWork(');
 const source=client.slice(start,client.indexOf('  async function loadFile(',start));
 const controller=new AbortController();const epoch=createChartRequestEpoch();const token=epoch.snapshot();
 const statuses:unknown[]=[];
 new Function('analysisController','analysisEpoch','setPreflightStatus','setChartConfirmation',stripTypeScriptTypes(source)+'\nreturn invalidateChartWork;')({current:controller},{current:epoch},(s:unknown)=>statuses.push(s),(c:unknown)=>statuses.push(c))();
 assert.equal(controller.signal.aborted,true);assert.equal(epoch.isCurrent(token),false);assert.deepEqual(statuses,['CHECKING',null]);
});
