import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { AsyncLocalStorage } from 'node:async_hooks';

// Execute the actual scope/admission and access-guard source. Only database,
// account authentication and configuration are synthetic; no provider exists.
async function harness(claim: Record<string,unknown>) {
  const provider=await readFile(new URL('../app/api/pocket/torture/provider-spend.ts',import.meta.url),'utf8');
  const scopeSource=provider.slice(provider.indexOf('export async function withPocketTestSpendScope'),provider.indexOf('\nasync function benchmarkAdmin'))
    .replace('export async function','async function')
    .replace('await import("../../../../utils/supabase/admin.ts")','await loadAdmin()');
  const projectSource=provider.slice(provider.indexOf('export function pocketTestProviderProject()'),provider.indexOf('\nfunction completeProviderUsage'))
    .replace('export function','function');
  const guard=await readFile(new URL('../app/lib/server/pocket-scan-access.ts',import.meta.url),'utf8');
  const guardSource=guard.slice(guard.indexOf('export async function requirePocketScanAccess(')).replaceAll('export async function','async function');
  const calls: string[]=[];
  const config:Record<string,string>={POCKET_BENCHMARK_LEDGER_KEY:'qa-ledger',POCKET_BENCHMARK_OPENAI_PROJECT_ID:'proj_qa',POCKET_BENCHMARK_APPROVAL_REF:'qa-only',POCKET_BENCHMARK_CANDIDATE_SHA:'b'.repeat(40)};
  const bindings={
    scopes:new AsyncLocalStorage(),isBenchmarkPilotSpendHeld:()=>false,
    required:(key:string)=>config[key],parsePocketBenchmarkConfiguration:()=>({bounds:{},plan:{main:{},primary_precision:{},rescue_precision:{}}}),
    loadAdmin:async()=>({createAdminClient:()=>({})}),
    invoke:async(_client:unknown,name:string)=>{calls.push(name);return name==='claim_pocket_benchmark_case'?claim:name==='assert_pocket_benchmark_case_reconciled'?{reconciled:false,cap_exceeded:false,committed_microusd:300}:{};},
    checkPocketScanAccess:async()=>Response.json({code:'POCKET_LOGIN_REQUIRED'},{status:401}),
  };
  const factory=new Function(...Object.keys(bindings),stripTypeScriptTypes(scopeSource+projectSource+guardSource)+'\nreturn {withPocketTestSpendScope,pocketTestProviderProject,requirePocketScanAccess};');
  return {...factory(...Object.values(bindings)),calls};
}

test('only a successful non-idempotent durable claim creates benchmark access; client headers cannot',async()=>{
 const h=await harness({allowed:true,status:'reserved',idempotent:false});
 const spoofed=new Request('https://preview.invalid/api/pocket/analyse',{headers:{'x-pocket-benchmark':'true','x-pocket-project':'proj_qa','x-pocket-test':'true','x-pocket-apple-transaction':'fake'}});
 assert.equal((await h.requirePocketScanAccess(spoofed)).status,401);
 let unblock!:()=>void;
 const hold=new Promise<void>(resolve=>{unblock=resolve;});
 let started!:()=>void;
 const entered=new Promise<void>(resolve=>{started=resolve;});
 const scope=h.withPocketTestSpendScope('range-clear',async()=>{
  assert.equal(h.pocketTestProviderProject(),'proj_qa');
  assert.equal(await h.requirePocketScanAccess(spoofed),null);
  started();await hold;
  assert.equal(await h.requirePocketScanAccess(),null);
  return 'no-provider';
 });
 await entered;
 assert.equal(h.pocketTestProviderProject(),undefined,'parallel customer must not inherit scope');
 assert.equal((await h.requirePocketScanAccess(spoofed)).status,401);
 unblock();const result=await scope;
 assert.equal(result.value,'no-provider');assert.equal(result.reconciliation.reconciled,false);
 assert.equal(h.pocketTestProviderProject(),undefined);
 assert.equal((await h.requirePocketScanAccess(spoofed)).status,401);
 assert.equal(h.calls.filter((x:string)=>x==='void_pocket_benchmark_call').length,3);
});

test('denied, repeated, malformed and errored claims never enter benchmark access',async()=>{
 for(const claim of [{allowed:false,status:'reserved',idempotent:false},{allowed:true,status:'reserved',idempotent:true},{allowed:true,status:'submitted',idempotent:false},{allowed:true,status:'reserved'}]){
  const h=await harness(claim);let runs=0;
  await assert.rejects(()=>h.withPocketTestSpendScope('range-clear',async()=>{runs++;}),/claim|reservation/i);
  assert.equal(runs,0);assert.equal(h.pocketTestProviderProject(),undefined);
 }
 const h=await harness({allowed:true,status:'reserved',idempotent:false});
 await assert.rejects(()=>h.withPocketTestSpendScope('range-clear',async()=>{throw new Error('uncertain outcome');}),/uncertain outcome/);
 assert.equal(h.pocketTestProviderProject(),undefined);
 assert.equal(h.calls.filter((x:string)=>x==='void_pocket_benchmark_call').length,0,'uncertain charge reserves must remain');
});
