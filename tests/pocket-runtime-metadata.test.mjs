import test from 'node:test';
import assert from 'node:assert/strict';
import {checkRuntimeEnvironment,validateRuntimeMetadata,verifyPocketBenchmarkRuntime} from '../app/api/pocket/torture/runtime-metadata.mjs';
const env={POCKET_BENCHMARK_RUNTIME_METADATA_ENABLED:'true',
 POCKET_BENCHMARK_OPENAI_PROJECT_ID:'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI',
 POCKET_BENCHMARK_CANDIDATE_SHA:'a'.repeat(40),
 NEXT_PUBLIC_SUPABASE_URL:'https://pxlqvaddvghjjhenqmdh.supabase.co',
 OPENAI_POCKET_MODEL:'gpt-5-mini-2025-08-07',OPENAI_POCKET_ANNOTATION_MODEL:'gpt-5-mini-2025-08-07',
 OPENAI_API_KEY:['sk','proj','SYNTHETIC','TEST','ONLY','aBgA'].join('-'),OPENAI_ADMIN_KEY:'SYNTHETIC-ADMIN-NOT-A-CREDENTIAL'};
const project={id:env.POCKET_BENCHMARK_OPENAI_PROJECT_ID,status:'active'};
const key={object:'organization.project.api_key',id:'key_EjND5GXtuqF2K0hp',owner_project_access:'active',redacted_value:'sk-...aBgA'};
const keys={has_more:false,data:[key]};
const model={id:env.OPENAI_POCKET_MODEL,object:'model'};
const run=(e=env,p=project,k=keys,m=model)=>validateRuntimeMetadata(e,p,k,m,1792425600000);
test('metadata review emits a fingerprint and explicit non-settlement, never credentials',()=>{
 const r=run();assert.equal(r.financiallySettled,false);assert.match(r.keyFingerprintSha256,/^[a-f0-9]{64}$/);
 assert.equal(r.keyTrackingVerification,'UNIQUE_REDACTED_METADATA_AND_PROJECT_AUTHORIZATION');
 const output=JSON.stringify(r);assert.ok(!output.includes(env.OPENAI_API_KEY));assert.ok(!output.includes(env.OPENAI_ADMIN_KEY));
});
for(const [name,change] of Object.entries({disabled:{POCKET_BENCHMARK_RUNTIME_METADATA_ENABLED:'false'},
 production:{NEXT_PUBLIC_SUPABASE_URL:'https://opmgzchnmcgnsfwpmysc.supabase.co'},
 injection:{NEXT_PUBLIC_SUPABASE_URL:'https://pxlqvaddvghjjhenqmdh.supabase.co.evil.example/'},
 alias:{OPENAI_POCKET_MODEL:'gpt-5-mini'},otherProject:{POCKET_BENCHMARK_OPENAI_PROJECT_ID:'proj_other'},
 missingAdmin:{OPENAI_ADMIN_KEY:''},missingRuntime:{OPENAI_API_KEY:''},legacyKey:{OPENAI_API_KEY:['sk','org','SYNTHETIC','aBgA'].join('-')},
 query:{NEXT_PUBLIC_SUPABASE_URL:'https://pxlqvaddvghjjhenqmdh.supabase.co/?x=1'},
 wrongSha:{POCKET_BENCHMARK_CANDIDATE_SHA:'main'},foreignEndpoint:{OPENAI_BASE_URL:'https://example.invalid/v1'},foreignOrg:{OPENAI_ORG_ID:'org-other'}}))
 test('rejects '+name+' before network',()=>assert.throws(()=>checkRuntimeEnvironment({...env,...change})));
for(const [name,p,k,m] of [
 ['wrong project',{...project,id:'proj_other'},keys,model],
 ['archived',{...project,status:'archived'},keys,model],
 ['wrong key',project,{has_more:false,data:[{...key,id:'key_other'}]},model],
 ['revoked owner',project,{has_more:false,data:[{...key,owner_project_access:'inactive'}]},model],
 ['ambiguous mask',project,{has_more:false,data:[key,{...key,id:'key_second'}]},model],
 ['pagination incomplete',project,{...keys,has_more:true},model],
 ['expired',project,{has_more:false,data:[{...key,expires_at:1}]},model],
 ['mismatched secret',project,{has_more:false,data:[{...key,redacted_value:'sk-...zzzz'}]},model],
 ['different model',project,keys,{...model,id:'gpt-5-mini'}]
])test('metadata rejects '+name,()=>assert.throws(()=>run(env,p,k,m)));

test('live verifier transport is fixed-origin GET-only and emits no credentials',async()=>{
 const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));
 const originalFetch=globalThis.fetch;let calls=[];
 try {
  Object.assign(process.env,env);
  globalThis.fetch=async(url,options)=>{
   calls.push({url,method:options.method});
   assert.ok(url.startsWith('https://api.openai.com/v1/'));assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
   const isModel=url.includes('/models/');
   if(isModel)assert.equal(options.headers['OpenAI-Project'],env.POCKET_BENCHMARK_OPENAI_PROJECT_ID);
   const body=isModel?model:url.includes('/api_keys?')?keys:project;
   return {ok:true,text:async()=>JSON.stringify(body),headers:new Headers({'x-request-id':'qa-metadata-only'})};
  };
  const r=await verifyPocketBenchmarkRuntime();assert.equal(calls.length,3);
  assert.ok(!JSON.stringify(r).includes(env.OPENAI_API_KEY));assert.equal(r.financiallySettled,false);
 } finally {
  globalThis.fetch=originalFetch;
  for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 }
});
test('transport failures never return provider body or credential-bearing errors',async()=>{
 const previous=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]]));const originalFetch=globalThis.fetch;
 try {
  Object.assign(process.env,env);globalThis.fetch=async()=>{throw Error(env.OPENAI_API_KEY+' '+env.OPENAI_ADMIN_KEY);};
  await assert.rejects(verifyPocketBenchmarkRuntime(),error=>!error.message.includes(env.OPENAI_API_KEY)&&!error.message.includes(env.OPENAI_ADMIN_KEY));
 } finally {
  globalThis.fetch=originalFetch;for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 }
});
