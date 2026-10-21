import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PINS, validateSetupEvidence, inspectSetupLedger, readEvidenceFile } from '../scripts/pocket-monaco-setup-preflight.mjs';
import { createNeonSqlPort, neonConnectionOptions } from '../scripts/pocket-monaco-neon-port.ts';

const syntheticKey = 'synthetic-existing-key-for-offline-checks-only';
const syntheticPassword = 'synthetic-ledger-password-for-offline-checks-only';
const fingerprint = createHash('sha256').update(syntheticKey).digest('hex');
const sha = 'a'.repeat(40);
function fixture() {
  const config = {
    environment:PINS.environment, invocationBranch:PINS.branch, reviewer:'nashysaimarkets',
    administratorBypass:false, repositoryTokenPermissions:{contents:'read'},
    concurrency:{group:'monaco-first-six-existing-five-dollar-allowance',cancelInProgress:false,
      maxChartsInFlight:1,maxCallsInFlight:1},acceptedRunAttempt:1,realDispatchEnabled:false,
    planSha256:PINS.planSha256,
    ledger:{provider:'Neon',backendRef:PINS.backend,organisationId:PINS.organization,
      projectId:PINS.projectId,branchId:PINS.branchId,endpointHost:PINS.host,
      databaseName:PINS.database,runtimeRole:PINS.role,maximumNewMonthlyCostUsd:0,plan:'free'},
    secrets:{newOpenAIKeyAllowed:false,existingInferenceKeyTrackingId:PINS.keyTrackingId,
      existingInferenceProject:PINS.project,existingInferenceKeyEnvironmentSecret:'MONACO_FIRST_SIX_OPENAI_API_KEY',
      isolatedLedgerCredentialEnvironmentSecret:'MONACO_FIRST_SIX_LEDGER_KEY'},
  };
  const evidence = {
    existingCredentialBinding:{verified:true,environment:PINS.environment,sourceSha:sha,
      backendRef:PINS.backend,projectRef:PINS.project,keyTrackingId:PINS.keyTrackingId,
      keyFingerprintSha256:fingerprint,planSha256:PINS.planSha256,ledgerKey:'synthetic-existing-allowance',
      controlPlaneEvidenceSha256:'b'.repeat(64)},
    processorSecurityAcceptance:{securityApprovalRef:'synthetic-reviewed-record',onBehalfAccepted:true,
      retentionAccepted:true,trainingAccepted:true,territoryAccepted:true,privateArtifactsAccepted:true},
    authoritativeBudgetCarryIn:{evidenceComplete:true,aggregateCapMicroUsd:PINS.cap,
      historicalAccountingKeptSeparate:true,cashAllowanceApproved:true,
      spentMicroUsd:1000000,reservedMicroUsd:500000,unresolvedMicroUsd:250000},
  };
  const context = {repository:PINS.repository,event:'push',ref:'refs/heads/'+PINS.branch,
    runAttempt:'1',reviewedSourceSha:sha,sourceSha:sha,
    reviewedEvidenceSha:'d'.repeat(40),evidenceSha:'d'.repeat(40)};
  const calls = {create:0,connect:0,rpc:[],end:0,options:null};
  const dependencies = {
    connectionOptions:(_identity,password)=>({host:PINS.host,password,ssl:{rejectUnauthorized:true}}),
    createClient:options=>{calls.create++;calls.options=options;return {
      async connect(){calls.connect++;},async end(){calls.end++;},
    };},
    createPort:()=>({async rpc(name,args){calls.rpc.push({name,args});return {
      error:null,data:{binding_matches:true,setup_only:true,ledger_key:'synthetic-existing-allowance',
        prior_exposure_microusd:1750000,new_commitments_microusd:0,remaining_microusd:3250000},
    };}}),
  };
  return {config,evidence,context,credentials:{existingKey:syntheticKey,ledgerPassword:syntheticPassword},dependencies,calls};
}
async function run(f) { return inspectSetupLedger(f.config,f.evidence,f.context,f.credentials,f.dependencies); }

test('complete synthetic evidence binds the setup identity without dispatch authority',()=>{
  const f=fixture();const result=validateSetupEvidence(f.config,f.evidence,f.context);
  assert.equal(result.identity.sourceSha,sha);assert.equal(result.priorExposureMicroUsd,1750000);
  assert.equal(f.calls.create,0);assert.equal(result.dispatch,undefined);
});
test('missing or declared-but-unverified evidence never opens a connection',async()=>{
  for(const key of ['existingCredentialBinding','processorSecurityAcceptance','authoritativeBudgetCarryIn']){
    const f=fixture();f.evidence[key]=null;assert.equal((await run(f)).status,'HOLD');assert.equal(f.calls.create,0);
  }
  const f=fixture();f.evidence.existingCredentialBinding.verified=false;
  assert.equal((await run(f)).status,'HOLD');assert.equal(f.calls.create,0);
});
test('unknown, negative and fractional history is never treated as zero',async()=>{
  for(const amount of [null,undefined,-1,0.2,NaN,Infinity]){
    const f=fixture();f.evidence.authoritativeBudgetCarryIn.unresolvedMicroUsd=amount;
    assert.equal((await run(f)).status,'HOLD');assert.equal(f.calls.create,0);
  }
});
test('the original aggregate boundary accepts exactly 1917600 headroom and rejects one less',()=>{
  const f=fixture(),b=f.evidence.authoritativeBudgetCarryIn;
  b.spentMicroUsd=3082400;b.reservedMicroUsd=0;b.unresolvedMicroUsd=0;
  assert.doesNotThrow(()=>validateSetupEvidence(f.config,f.evidence,f.context));
  b.spentMicroUsd++;assert.throws(()=>validateSetupEvidence(f.config,f.evidence,f.context),/INSUFFICIENT/);
});
test('wrong repository, ref, event, attempt or source refuses before credential use',async()=>{
  for(const change of [{repository:'other/repo'},{ref:'refs/heads/main'},{event:'workflow_dispatch'},
    {runAttempt:'2'},{reviewedSourceSha:'UNBOUND'},{sourceSha:'c'.repeat(40)},
    {reviewedEvidenceSha:'UNBOUND'},{evidenceSha:'c'.repeat(40)}]){
    const f=fixture();Object.assign(f.context,change);
    assert.equal((await run(f)).status,'HOLD');assert.equal(f.calls.create,0);
  }
});
test('protected setup scope cannot enable bypass, wider token rights or dispatch',async()=>{
  for(const mutate of [
    f=>{f.config.administratorBypass=true;},f=>{f.config.repositoryTokenPermissions.id_token='write';},
    f=>{f.config.realDispatchEnabled=true;},f=>{f.config.ledger.runtimeRole='monaco_ledger_owner';},
    f=>{f.config.secrets.existingInferenceKeyTrackingId='metadata-only-key';},
  ]){
    const f=fixture();mutate(f);assert.equal((await run(f)).status,'HOLD');assert.equal(f.calls.create,0);
  }
});
test('processor and cash/history conditions remain required',async()=>{
  for(const mutate of [
    f=>{f.evidence.processorSecurityAcceptance.retentionAccepted=false;},
    f=>{f.evidence.processorSecurityAcceptance.privateArtifactsAccepted=false;},
    f=>{f.evidence.authoritativeBudgetCarryIn.historicalAccountingKeptSeparate=false;},
    f=>{f.evidence.authoritativeBudgetCarryIn.cashAllowanceApproved=false;},
  ]){
    const f=fixture();mutate(f);assert.equal((await run(f)).status,'HOLD');assert.equal(f.calls.create,0);
  }
});
test('wrong or absent existing key and ledger password are denied before connection',async()=>{
  for(const change of [{existingKey:'different-key'},{existingKey:undefined},{ledgerPassword:''}]){
    const f=fixture();Object.assign(f.credentials,change);
    assert.equal((await run(f)).status,'HOLD');assert.equal(f.calls.create,0);
  }
});
test('setup uses one non-mutating locking inspection and no provider or dispatch capability',async()=>{
  const f=fixture();const result=await run(f);
  assert.equal(result.status,'PASS');assert.equal(f.calls.connect,1);assert.equal(f.calls.end,1);
  assert.equal(f.calls.options.options,undefined);
  assert.equal(f.calls.options.ssl.rejectUnauthorized,true);
  assert.deepEqual(f.calls.rpc.map(x=>x.name),['inspect_monaco_isolated_runner']);
  assert.equal(result.providerInferenceRequests,0);assert.equal(result.providerMetadataRequests,0);
  assert.equal(result.realDispatchEnabled,false);
  assert.ok(!JSON.stringify(result).includes(syntheticKey));assert.ok(!JSON.stringify(result).includes(syntheticPassword));
});
test('driver errors containing credential values are discarded and never retried',async()=>{
  const f=fixture();f.dependencies.createClient=()=>{f.calls.create++;return {
    async connect(){f.calls.connect++;throw Error(syntheticKey+' '+syntheticPassword);},
    async end(){f.calls.end++;throw Error(syntheticPassword);},
  };};
  const result=await run(f);assert.equal(result.status,'HOLD');
  assert.equal(f.calls.connect,1);assert.equal(f.calls.end,1);assert.equal(f.calls.rpc.length,0);
  assert.ok(!JSON.stringify(result).includes(syntheticKey));assert.ok(!JSON.stringify(result).includes(syntheticPassword));
});
test('ledger mismatches and nonauthoritative balances cannot produce setup PASS',async()=>{
  for(const change of [{binding_matches:false},{setup_only:false},{ledger_key:'different'},
    {prior_exposure_microusd:0},{remaining_microusd:null},{remaining_microusd:3250001}]){
    const f=fixture(),port=f.dependencies.createPort();
    f.dependencies.createPort=()=>({async rpc(name,args){const result=await port.rpc(name,args);Object.assign(result.data,change);return result;}});
    assert.equal((await run(f)).status,'HOLD');assert.equal(f.calls.rpc.length,1);
  }
});
test('new ledger commitments can exhaust headroom even when prior carry-in qualified',async()=>{
  const f=fixture();f.dependencies.createPort=()=>({async rpc(){return {error:null,data:{
    binding_matches:true,setup_only:true,ledger_key:'synthetic-existing-allowance',
    prior_exposure_microusd:1750000,new_commitments_microusd:1332401,remaining_microusd:1917599,
  }};}});
  assert.equal((await run(f)).status,'HOLD');assert.equal(f.calls.connect,1);assert.equal(f.calls.end,1);
});
test('new preflight wires the unchanged Neon port to the actual inspection RPC shape',async()=>{
  const f=fixture();let observed;
  f.dependencies.connectionOptions=neonConnectionOptions;f.dependencies.createPort=createNeonSqlPort;
  f.dependencies.createClient=options=>{
    assert.equal(options.ssl.rejectUnauthorized,true);assert.equal(options.ssl.servername,PINS.host);
    assert.equal(options.user,PINS.role);assert.equal(options.options,undefined);
    return {async connect(){},async end(){},async query(sql,args){
      assert.equal(observed,undefined);observed={sql,args};
      return {rows:[{result:{ledger_key:'synthetic-existing-allowance',prior_exposure_microusd:1750000,
        new_commitments_microusd:0,remaining_microusd:3250000,financially_settled:false,
        real_dispatch_enabled:false,binding_matches:true,setup_only:true}}]};
    }};
  };
  assert.equal((await run(f)).status,'PASS');
  assert.equal(observed.sql,'select public.monaco_neon_rpc($1::jsonb,$2::jsonb,$3::text,$4::jsonb) as result');
  assert.equal(observed.args[2],'inspect_monaco_isolated_runner');
  assert.equal(JSON.parse(observed.args[1]).sourceSha,sha);
  assert.equal(JSON.parse(observed.args[3]).p_key,'synthetic-existing-allowance');
});
test('evidence reads reject absent paths, traversal and symlinks out of the reviewed tree',()=>{
  const root=mkdtempSync(join(tmpdir(),'monaco-setup-synthetic-'));
  try{
    const dir=join(root,'docs/monaco-126/isolated-runner');mkdirSync(dir,{recursive:true});
    writeFileSync(join(dir,'valid.json'),'{"synthetic":true}');
    assert.deepEqual(readEvidenceFile(root,'docs/monaco-126/isolated-runner/valid.json'),{synthetic:true});
    assert.throws(()=>readEvidenceFile(root,null));
    assert.throws(()=>readEvidenceFile(root,'docs/monaco-126/isolated-runner/../../outside.json'));
    symlinkSync('/dev/null',join(dir,'outside.json'));
    assert.throws(()=>readEvidenceFile(root,'docs/monaco-126/isolated-runner/outside.json'));
  }finally{rmSync(root,{recursive:true,force:true});}
});
test('prepared workflow has immutable-source HOLD and no alternative activation or provider step',()=>{
  const yml=readFileSync(new URL('../.github/workflows/monaco-first-six-setup.yml',import.meta.url),'utf8');
  assert.match(yml,/REVIEWED_SETUP_SOURCE_SHA: UNBOUND/);
  assert.match(yml,/REVIEWED_SETUP_EVIDENCE_SHA: UNBOUND/);
  assert.match(yml,/ref: \$\{\{ env\.REVIEWED_SETUP_SOURCE_SHA \}\}/);
  assert.match(yml,/environment: monaco-first-six-inference/);
  assert.match(yml,/persist-credentials: false/);assert.match(yml,/cancel-in-progress: false/);
  assert.doesNotMatch(yml,/workflow_dispatch:|schedule:|id-token:|upload-artifact@|actions\/cache@|ref: \$\{\{ github\.sha/);
  assert.ok(yml.indexOf('--check-config')<yml.indexOf('secrets.MONACO_FIRST_SIX_OPENAI_API_KEY'));
  assert.ok(yml.indexOf('git diff --exit-code HEAD')<yml.indexOf('secrets.MONACO_FIRST_SIX_OPENAI_API_KEY'));
});

