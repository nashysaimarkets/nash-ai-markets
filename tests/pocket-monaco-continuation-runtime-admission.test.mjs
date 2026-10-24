/** Offline authenticated-composition tests using synthetic clients and input. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {PINS} from '../scripts/pocket-monaco-setup-preflight.mjs';
import {generateRecipientKeyPair, sealInputBundle} from '../scripts/pocket-monaco-confidential-transport.mjs';
import {packFirstSixBundle} from '../scripts/pocket-monaco-first-six-bundle.mjs';
import {createStdinEnvelopeReceiver, loadPinnedRuntime, RUNTIME_PACKAGES,
  runProtectedFirstSix,runProtectedContinuation,loadProtectedRunnerInputs} from '../scripts/pocket-monaco-protected-runner.mjs';
import {CONTINUATION,CONTINUATION_IDS,validateContinuationEvidence} from '../scripts/pocket-monaco-continuation-admission.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const key = 'synthetic-existing-inference-credential-for-offline-test';
const password = 'synthetic-ledger-password-for-offline-test';
const sourceSha = 'a'.repeat(40), evidenceSha = 'b'.repeat(40);
const recipient = generateRecipientKeyPair();
const bytes = Buffer.from('synthetic-private-input-only'), h = hash(bytes);
const ids = ['d001','d002','d003','d004','d005','d006'];
const manifest = {cases:ids.map(caseId => ({caseId,inputPath:'shared.bin',inputSha256:h,
  imagePath:'shared.bin',rasterSha256:h,barsPath:'shared.bin',barsSha256:h,
  sourcePath:'shared.bin',sourceZipSha256:h,licencePath:'shared.bin',licenceSha256:h,
  calibrationPath:'shared.bin',calibrationSha256:h}))};
const requests = {calls:ids.flatMap(caseId => ['main','primary_precision','rescue_precision'].map(slot =>
  ({caseId,slot,inputSha256:h,path:'synthetic.json',envelopeFileSha256:h})))};
const bundle = packFirstSixBundle([
  {path:'packet/BENCHMARK50.json',bytes:Buffer.from(JSON.stringify(manifest))},
  {path:'packet/request-previews/REQUEST-PREVIEWS.json',bytes:Buffer.from(JSON.stringify(requests))},
  {path:'packet/shared.bin',bytes}, {path:'packet/request-previews/synthetic.json',bytes},
  {path:'objective-reference.json',bytes}, {path:'protocol.json',bytes},
]);

function fixture() {
  const config = {executionMode:CONTINUATION.mode,environment:PINS.environment,invocationBranch:PINS.branch,reviewer:'nashysaimarkets',
    administratorBypass:false,repositoryTokenPermissions:{contents:'read'},
    concurrency:{group:'monaco-first-six-existing-five-dollar-allowance',cancelInProgress:false,
      maxChartsInFlight:1,maxCallsInFlight:1},acceptedRunAttempt:1,realDispatchEnabled:true,
    paidScopeReceipt:PINS.paidScopeReceipt,planSha256:PINS.planSha256,
    ledger:{provider:'Neon',backendRef:PINS.backend,organisationId:PINS.organization,
      projectId:PINS.projectId,branchId:PINS.branchId,endpointHost:PINS.host,
      databaseName:PINS.database,runtimeRole:PINS.role,maximumNewMonthlyCostUsd:0,plan:'free'},
    secrets:{newOpenAIKeyAllowed:false,existingInferenceKeyTrackingId:PINS.keyTrackingId,
      existingInferenceProject:PINS.project,existingInferenceKeyEnvironmentSecret:'MONACO_FIRST_SIX_OPENAI_API_KEY',
      isolatedLedgerCredentialEnvironmentSecret:'MONACO_FIRST_SIX_LEDGER_KEY'}};
  const evidence = {existingCredentialBinding:{verified:true,environment:PINS.environment,sourceSha,
    backendRef:PINS.backend,projectRef:PINS.project,keyTrackingId:PINS.keyTrackingId,
    keyFingerprintSha256:hash(key),planSha256:PINS.planSha256,ledgerKey:'synthetic-existing-allowance',
    controlPlaneEvidenceSha256:'c'.repeat(64)},
  processorSecurityAcceptance:{securityApprovalRef:'synthetic-reviewed-approval',onBehalfAccepted:true,
    retentionAccepted:true,trainingAccepted:true,territoryAccepted:true,privateArtifactsAccepted:true,
    inputDelivery:{kind:'MONACO_RUN_BOUND_ENCRYPTED_INPUT_V1',bundleSha256:bundle.sha256,
      maxWaitMs:2000,acceptanceRef:'synthetic-reviewed-input-delivery'},
    privateArtifactLocation:{kind:'GITHUB_ACTIONS_ENCRYPTED_ARTIFACTS_V1',repository:PINS.repository,
      recipientPublicKeyPem:recipient.publicKeyPem,recipientPublicKeySha256:recipient.publicKeySha256,
      retentionDays:7,acceptanceRef:'synthetic-reviewed-private-retention'}},
  authoritativeBudgetCarryIn:{evidenceComplete:true,aggregateCapMicroUsd:PINS.cap,
    historicalAccountingKeptSeparate:true,cashAllowanceApproved:true,
    spentMicroUsd:0,reservedMicroUsd:0,unresolvedMicroUsd:0},
  continuationAdmission:{...Object.fromEntries(Object.entries(CONTINUATION).filter(([k])=>k!=='mode')),
    remainingCaseIds:[...CONTINUATION_IDS],originalCaseImmutable:true}};
  const context = {repository:PINS.repository,event:'push',ref:'refs/heads/'+PINS.branch,
    runId:'123456789',runAttempt:'1',reviewedSourceSha:sourceSha,sourceSha,
    reviewedEvidenceSha:evidenceSha,evidenceSha};
  const calls = {events:[],receive:0,prepare:0,run:0,close:0,provider:0,uploads:[]};
  const f = {config,evidence,context,credentials:{existingKey:key,ledgerPassword:password},calls,
    balance:{binding_matches:true,setup_only:true,ledger_key:'synthetic-existing-allowance',
      prior_exposure_microusd:0,new_commitments_microusd:216800,remaining_microusd:4783200,
      continuation_allowed:true,continuation_case_ids:[...CONTINUATION_IDS],
      predecessor_source_sha:CONTINUATION.originalSourceSha,predecessor_run_id:CONTINUATION.originalRunId,
      prior_receipt_sha256:CONTINUATION.priorReceiptSha256,continuation_source_sha:sourceSha,
      continuation_run_id:context.runId,continuation_evidence_sha:evidenceSha,
      continuation_valid_until:'2030-01-01T00:00:00Z',continuation_previous_commitments_microusd:216800}};
  class Client extends EventEmitter {
    constructor(options) {super(); calls.options=options; calls.events.push('pg:create');}
    async connect() {calls.events.push('pg:connect'); if (f.connectError) throw Error(key+password);}
    async query(text,values) {
      calls.events.push('pg:inspect'); calls.query={text,values};
      return {rows:[{result:f.balance}]};
    }
    async end() {calls.close++;}
  }
  class OpenAI {
    constructor(options) {
      calls.events.push('openai:create');calls.openAIOptions=options;Object.assign(this,options);
      this.responses={create(){calls.provider++;throw Error('No provider calls in synthetic tests');}};
    }
  }
  class ArtifactClient {
    async uploadArtifact(name,files,root,options) {
      calls.events.push('artifact:upload');
      calls.uploads.push({name,files,root,options,publicHandoff:JSON.parse(readFileSync(files[0],'utf8'))});
      if (f.uploadError) throw Error('private-driver-error '+key);
      return f.uploadResult ?? {id:42,size:100,digest:'d'.repeat(64)};
    }
  }
  f.runtime={versions:RUNTIME_PACKAGES,Client,OpenAI,ArtifactClient};
  f.receiveInputOnce = async args => {
    calls.events.push('input:receive');calls.receive++;calls.receiveArgs=args;
    return sealInputBundle({publicHandoff:args.publicHandoff,run:args.run,
      bytes:bundle.bytes,expectedBundleSha256:bundle.sha256});
  };
  f.prepareBootstrap = async args => {
    calls.events.push('bootstrap:prepare');calls.prepare++;calls.bootstrapArgs=args;
    assert.equal(readFileSync(join(args.inputPaths.packetDirectory,'shared.bin'),'utf8'),bytes.toString());
    return {status:'PREPARED',async runOnce({signal}) {
      calls.events.push('bootstrap:run');calls.run++;assert.equal(signal.aborted,false);
      if (f.runError) throw Error('secret raw response '+key);
      return f.runResult ?? {status:'COMPLETED',transportSendAttempts:15,
        cases:CONTINUATION_IDS.map(caseId => ({caseId,status:'DIAGNOSTIC_RETAINED'})),
        secret:key,privateResponse:'never in public summary'};
    }};
  };
  return f;
}
const run = f => runProtectedContinuation(f,{prepareBootstrap:f.prepareBootstrap});


test('successor authenticates honest new source/run identity and reports only five newly retained cases',async()=>{
 const f=fixture(),r=await run(f);
 assert.equal(r.status,'COMPLETED');assert.equal(r.kind,'MONACO_PROTECTED_FIRST_FIVE_CONTINUATION_RUN');
 assert.equal(r.diagnosticCasesRetained,5);assert.equal(r.previousCasesAttempted,1);
 assert.equal(r.transportSendAttempts,15);assert.equal(r.combinedTransportSendAttempts,17);
 assert.equal(r.predecessorRunId,CONTINUATION.originalRunId);assert.equal(r.actualMicroUsd,null);
 const queried=JSON.parse(f.calls.query.values[1]);
 assert.equal(queried.sourceSha,sourceSha);assert.equal(queried.continuation.originalSourceSha,CONTINUATION.originalSourceSha);
 assert.equal(queried.continuation.runId,f.context.runId);assert.equal(queried.continuation.evidenceSha,evidenceSha);
 assert.equal(Object.keys(queried).length,8);assert.equal(f.calls.provider,0);assert.equal(f.calls.run,1);assert.equal(f.calls.close,1);
 assert.equal(f.calls.options.ssl.rejectUnauthorized,true);assert.equal(f.calls.openAIOptions.maxRetries,0);
 assert.equal(existsSync(f.calls.bootstrapArgs.inputPaths.packetDirectory),false);
 assert.equal(JSON.stringify(r).includes(key),false);assert.equal(JSON.stringify(r).includes('privateResponse'),false);
});
test('old and successor entry modes cannot be silently interchanged',async()=>{
 const f=fixture();assert.equal((await runProtectedFirstSix(f,{prepareBootstrap:f.prepareBootstrap})).status,'HOLD');
 assert.deepEqual(f.calls.events,[]);
 delete f.config.executionMode;assert.equal((await run(f)).status,'HOLD');assert.deepEqual(f.calls.events,[]);
});
test('changed predecessor/case/exposure evidence or source identity is refused before clients',async()=>{
 for(const mutate of [f=>f.evidence.continuationAdmission.priorReceiptSha256='0'.repeat(64),
  f=>f.evidence.continuationAdmission.remainingCaseIds.unshift('d001'),
  f=>f.evidence.continuationAdmission.maximumAdditionalSends=16,
  f=>f.evidence.continuationAdmission.originalCaseImmutable=false,
  f=>f.context.runAttempt='2',f=>f.context.runId=CONTINUATION.originalRunId,
  f=>{f.context.sourceSha=CONTINUATION.originalSourceSha;f.context.reviewedSourceSha=CONTINUATION.originalSourceSha;f.evidence.existingCredentialBinding.sourceSha=CONTINUATION.originalSourceSha;}]){
  const f=fixture();mutate(f);assert.equal((await run(f)).status,'HOLD');assert.deepEqual(f.calls.events,[]);
 }
});
test('actual SQL continuation binding and unused successor balance are required before encrypted handoff',async()=>{
 for(const mutate of [b=>delete b.continuation_allowed,b=>b.continuation_source_sha='f'.repeat(40),
  b=>b.continuation_run_id='2',b=>b.prior_receipt_sha256='f'.repeat(64),
  b=>{b.new_commitments_microusd++;b.remaining_microusd--; }]){
  const f=fixture();mutate(f.balance);const r=await run(f);
  assert.equal(r.status,'HOLD');assert.equal(r.ledgerAuthenticationVerified,false);assert.equal(f.calls.close,1);
  assert.equal(f.calls.receive,0);assert.equal(f.calls.events.includes('openai:create'),false);assert.equal(f.calls.provider,0);
 }
});
test('a six-case or excess-send synthetic completion cannot be reported as successor success',async()=>{
 for(const bad of [{status:'COMPLETED',transportSendAttempts:15,cases:ids.map(caseId=>({caseId,status:'DIAGNOSTIC_RETAINED'}))},
  {status:'COMPLETED',transportSendAttempts:16,cases:CONTINUATION_IDS.map(caseId=>({caseId,status:'DIAGNOSTIC_RETAINED'}))}]){
  const f=fixture();f.runResult=bad;assert.equal((await run(f)).status,'UNCERTAIN');assert.equal(f.calls.provider,0);
 }
});
test('input loader requires the exact additional continuation evidence path and preserves actual run context',()=>{
 const f=fixture(),workspace=mkdtempSync(join(tmpdir(),'monaco-continuation-evidence-'));
 try {
  const base=join(workspace,'runner-evidence','docs/monaco-126/isolated-runner');mkdirSync(base,{recursive:true});
  const refs=Object.fromEntries(Object.keys(f.evidence).map(k=>[k,`docs/monaco-126/isolated-runner/${k}.json`]));
  f.config.requiredEvidence=refs;writeFileSync(join(base,'SETUP-CONFIG.json'),JSON.stringify(f.config));
  for(const [k,v]of Object.entries(f.evidence))writeFileSync(join(base,k+'.json'),JSON.stringify(v));
  const env={GITHUB_WORKSPACE:workspace,GITHUB_REPOSITORY:PINS.repository,GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/'+PINS.branch,
   GITHUB_RUN_ID:f.context.runId,GITHUB_RUN_ATTEMPT:'1',REVIEWED_SETUP_SOURCE_SHA:sourceSha,CHECKED_OUT_SOURCE_SHA:sourceSha,
   REVIEWED_SETUP_EVIDENCE_SHA:evidenceSha,CHECKED_OUT_EVIDENCE_SHA:evidenceSha};
  const loaded=loadProtectedRunnerInputs(env);assert.deepEqual(loaded.evidence.continuationAdmission,f.evidence.continuationAdmission);
  assert.equal(validateContinuationEvidence(loaded.config,loaded.evidence,loaded.context).identity.continuation.runId,f.context.runId);
  rmSync(join(base,'continuationAdmission.json'));assert.throws(()=>loadProtectedRunnerInputs(env));
 } finally {rmSync(workspace,{recursive:true,force:true});}
});
