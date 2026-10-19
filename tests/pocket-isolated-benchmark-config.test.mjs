import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const wrapper=fileURLToPath(new URL('../scripts/verify-pocket-benchmark-isolated.sh',import.meta.url));
const keys=['OPENAI_ORG_ID','OPENAI_PROJECT_ID','POCKET_BENCHMARK_OPENAI_PROJECT_ID',
 'POCKET_BENCHMARK_CANDIDATE_SHA','OPENAI_POCKET_MODEL','OPENAI_POCKET_ANNOTATION_MODEL',
 'NEXT_PUBLIC_SUPABASE_URL','POCKET_BENCHMARK_ACCOUNTING_MODE','POCKET_BENCHMARK_PILOT_ENABLED',
 'POCKET_REAL_BENCHMARK_DISPATCH','POCKET_BENCHMARK_RUNTIME_METADATA_ENABLED','OPENAI_BASE_URL'];

function run(args,overrides={}) {
 const dir=mkdtempSync(join(tmpdir(),'monaco-isolated-'));
 try {
  // A fake node records only non-secret configuration: no provider call is possible.
  writeFileSync(join(dir,'node'),`#!${process.execPath}\nprocess.stdout.write(JSON.stringify({args:process.argv.slice(2),env:Object.fromEntries(${JSON.stringify(keys)}.map(k=>[k,process.env[k]]))}));`,{mode:0o700});
  return spawnSync('bash',[wrapper,...args],{encoding:'utf8',env:{PATH:dir+':'+process.env.PATH,...overrides}});
 } finally {rmSync(dir,{recursive:true,force:true});}
}

test('isolated configuration pins reviewed identity/models and forces paid holds without changing its parent',()=>{
 const before=process.env.OPENAI_POCKET_MODEL;
 const result=run(['--metadata-only'],{OPENAI_POCKET_MODEL:'gpt-5.6-sol',OPENAI_POCKET_ANNOTATION_MODEL:'gpt-5.6-terra',POCKET_BENCHMARK_PILOT_ENABLED:'true',POCKET_REAL_BENCHMARK_DISPATCH:'true'});
 assert.equal(result.status,0,result.stderr);
 const {env,args}=JSON.parse(result.stdout);
 assert.deepEqual(args,[fileURLToPath(new URL('../scripts/verify-pocket-benchmark-runtime.mjs',import.meta.url))]);
 assert.equal(env.OPENAI_ORG_ID,'org-5vLRRzXwcigUx96TVE0rI3RW');
 assert.equal(env.OPENAI_PROJECT_ID,'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI');
 assert.equal(env.POCKET_BENCHMARK_OPENAI_PROJECT_ID,env.OPENAI_PROJECT_ID);
 assert.equal(env.POCKET_BENCHMARK_CANDIDATE_SHA,'93f3fe282c6cab0196812aec989dddaa915bb986');
 assert.equal(env.OPENAI_POCKET_MODEL,'gpt-5-mini-2025-08-07');
 assert.equal(env.OPENAI_POCKET_ANNOTATION_MODEL,env.OPENAI_POCKET_MODEL);
 assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'https://pxlqvaddvghjjhenqmdh.supabase.co');
 assert.equal(env.POCKET_BENCHMARK_ACCOUNTING_MODE,'full-reservation-v2');
 assert.equal(env.POCKET_BENCHMARK_PILOT_ENABLED,'false');
 assert.equal(env.POCKET_REAL_BENCHMARK_DISPATCH,'false');
 assert.equal(env.POCKET_BENCHMARK_RUNTIME_METADATA_ENABLED,'true');
 assert.equal(process.env.OPENAI_POCKET_MODEL,before);
});

test('no arguments and every inference/unknown option stop before invoking node',()=>{
 for(const args of [[],['--enable-paid'],['--metadata-only','--enable-paid'],['--metadata-only','extra']]) {
  const result=run(args);
  assert.equal(result.status,2);
  assert.equal(result.stdout,'');
  assert.match(result.stderr,/paid dispatch stays disabled/);
 }
});

test('alternate API origin remains visible to the original fail-closed verifier',()=>{
 const result=run(['--metadata-only'],{OPENAI_BASE_URL:'https://invalid.example'});
 assert.equal(result.status,0,result.stderr);
 assert.equal(JSON.parse(result.stdout).env.OPENAI_BASE_URL,'https://invalid.example');
});

test('real verifier stops on missing access after applying the isolated model configuration',()=>{
 const result=spawnSync('bash',[wrapper,'--metadata-only'],{encoding:'utf8',env:{PATH:process.env.PATH}});
 assert.equal(result.status,1);
 assert.equal(result.stdout,'');
 assert.deepEqual(JSON.parse(result.stderr),{
  status:'BLOCKED',reason:'Existing isolated runtime and read-only administrator credentials are unavailable.',providerInferenceRequests:0
 });
});
