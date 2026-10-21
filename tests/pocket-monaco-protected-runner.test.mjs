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
  runProtectedFirstSix} from '../scripts/pocket-monaco-protected-runner.mjs';

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
  const config = {environment:PINS.environment,invocationBranch:PINS.branch,reviewer:'nashysaimarkets',
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
    spentMicroUsd:1000000,reservedMicroUsd:500000,unresolvedMicroUsd:250000}};
  const context = {repository:PINS.repository,event:'push',ref:'refs/heads/'+PINS.branch,
    runId:'123456789',runAttempt:'1',reviewedSourceSha:sourceSha,sourceSha,
    reviewedEvidenceSha:evidenceSha,evidenceSha};
  const calls = {events:[],receive:0,prepare:0,run:0,close:0,provider:0,uploads:[]};
  const f = {config,evidence,context,credentials:{existingKey:key,ledgerPassword:password},calls,
    balance:{binding_matches:true,setup_only:true,ledger_key:'synthetic-existing-allowance',
      prior_exposure_microusd:1750000,new_commitments_microusd:0,remaining_microusd:3250000}};
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
      return {status:'COMPLETED',transportSendAttempts:18,
        cases:ids.map(caseId => ({caseId,status:'DIAGNOSTIC_RETAINED'})),
        secret:key,privateResponse:'never in public summary'};
    }};
  };
  return f;
}
const run = f => runProtectedFirstSix(f,{prepareBootstrap:f.prepareBootstrap});

test('the composed one-shot path authenticates before encrypted delivery, pins SDK options and cleans private inputs',async()=>{
  const f=fixture(), result=await run(f);
  assert.equal(result.status,'COMPLETED');assert.equal(result.bootstrapInvocations,1);
  assert.equal(result.diagnosticCasesRetained,6);assert.equal(result.transportSendAttempts,18);
  assert.equal(result.financiallySettled,false);assert.equal(result.actualMicroUsd,null);
  assert.deepEqual(f.calls.events,['pg:create','pg:connect','pg:inspect','openai:create',
    'artifact:upload','input:receive','bootstrap:prepare','bootstrap:run']);
  assert.equal(f.calls.provider,0);assert.equal(f.calls.receive,1);assert.equal(f.calls.run,1);assert.equal(f.calls.close,1);
  assert.deepEqual(f.calls.openAIOptions,{apiKey:key,project:PINS.project,
    organization:'org-5vLRRzXwcigUx96TVE0rI3RW',baseURL:'https://api.openai.com/v1',
    maxRetries:0,timeout:60000,logLevel:'off'});
  assert.equal(f.calls.options.host,PINS.host);assert.equal(f.calls.options.user,PINS.role);
  assert.equal(f.calls.options.password,password);assert.equal(f.calls.options.ssl.rejectUnauthorized,true);
  assert.equal(f.calls.query.values[2],'inspect_monaco_isolated_runner');
  assert.equal(JSON.stringify(f.calls.query).includes(password),false);
  assert.deepEqual(f.calls.uploads[0].options,{retentionDays:1,compressionLevel:0});
  assert.equal(f.calls.receiveArgs.handoffArtifact.id,42);
  assert.equal(f.calls.receiveArgs.credentials,undefined);
  assert.equal(f.calls.bootstrapArgs.privateOutputDirectory,undefined);
  assert.equal(f.calls.bootstrapArgs.encryptedArtifacts.recipientPublicKeyPem,recipient.publicKeyPem);
  assert.equal(existsSync(f.calls.bootstrapArgs.inputPaths.packetDirectory),false);
  assert.equal(existsSync(f.calls.uploads[0].root),false);
  assert.equal(JSON.stringify(result).includes(key),false);
  assert.equal(JSON.stringify(result).includes('privateResponse'),false);
});

test('missing actual inference credential, metadata substitution or unknown budget stops before constructing a client',async()=>{
  for (const mutate of [f=>{f.credentials.existingKey=undefined;},
    f=>{f.credentials.existingKey='synthetic-metadata-only-key';},
    f=>{f.evidence.authoritativeBudgetCarryIn.unresolvedMicroUsd=null;},
    f=>{f.config.realDispatchEnabled=false;},
    f=>{f.evidence.existingCredentialBinding.verified=false;}]) {
    const f=fixture();mutate(f);const result=await run(f);
    assert.equal(result.status,'HOLD');assert.deepEqual(f.calls.events,[]);
    assert.equal(result.transportSendAttempts,0);assert.equal(f.calls.provider,0);
  }
});

test('unmounted or unbound input and output destinations stop before any external effect',async()=>{
  for (const mutate of [f=>{f.receiveInputOnce=undefined;},
    f=>{f.evidence.processorSecurityAcceptance.inputDelivery=undefined;},
    f=>{f.evidence.processorSecurityAcceptance.inputDelivery.maxWaitMs=300001;},
    f=>{f.evidence.processorSecurityAcceptance.privateArtifactLocation.recipientPublicKeySha256='e'.repeat(64);},
    f=>{f.context.runAttempt='2';}, f=>{f.context.runId='';},
    f=>{f.runtime.versions={...RUNTIME_PACKAGES,openai:'6.48.1'};}]) {
    const f=fixture();mutate(f);assert.equal((await run(f)).status,'HOLD');assert.deepEqual(f.calls.events,[]);
  }
});

test('real connection failure is sanitized and closes without input retrieval or execution',async()=>{
  const f=fixture();f.connectError=true;const result=await run(f);
  assert.equal(result.status,'HOLD');assert.equal(result.stage,'LEDGER_AUTHENTICATION');
  assert.equal(result.ledgerAuthenticationVerified,false);assert.equal(f.calls.close,1);
  assert.equal(f.calls.receive,0);assert.equal(f.calls.run,0);assert.equal(JSON.stringify(result).includes(key),false);
});

test('fixed ledger inspection refuses changed carry-in, missing binding and insufficient headroom',async()=>{
  for (const change of [{binding_matches:false},{prior_exposure_microusd:0},
    {remaining_microusd:null},{new_commitments_microusd:2000000,remaining_microusd:1250000}]) {
    const f=fixture();Object.assign(f.balance,change);const result=await run(f);
    assert.equal(result.status,'HOLD');assert.equal(f.calls.close,1);
    assert.equal(f.calls.receive,0);assert.equal(f.calls.uploads.length,0);assert.equal(f.calls.run,0);
  }
});

test('unacknowledged public handoff is never followed by input or a paid attempt',async()=>{
  for (const mutate of [f=>{f.uploadError=true;},f=>{f.uploadResult={id:42,size:100};}]) {
    const f=fixture();mutate(f);const result=await run(f);
    assert.equal(result.status,'HOLD');assert.equal(result.stage,'ENCRYPTED_INPUT');
    assert.equal(f.calls.uploads.length,1);assert.equal(f.calls.receive,0);assert.equal(f.calls.run,0);
    assert.equal(existsSync(f.calls.uploads[0].root),false);
  }
});

test('a ciphertext altered to name a different run is refused before bootstrap',async()=>{
  const f=fixture(), receive=f.receiveInputOnce;
  f.receiveInputOnce=async args=>{const envelope=JSON.parse((await receive(args)).toString());
    envelope.metadata.runId='987654321';return Buffer.from(JSON.stringify(envelope));};
  assert.equal((await run(f)).status,'HOLD');assert.equal(f.calls.receive,1);
  assert.equal(f.calls.prepare,0);assert.equal(f.calls.run,0);assert.equal(f.calls.close,1);
});

test('one bounded receiver times out; a late envelope cannot execute or request input again',async()=>{
  const f=fixture();f.evidence.processorSecurityAcceptance.inputDelivery.maxWaitMs=20;
  let late;f.receiveInputOnce=args=>{f.calls.receive++;f.calls.receiveArgs=args;
    return new Promise(resolve=>{late=resolve;});};
  const result=await run(f);assert.equal(result.status,'HOLD');assert.equal(f.calls.receive,1);
  assert.equal(f.calls.receiveArgs.signal.aborted,true);assert.equal(f.calls.prepare,0);
  late(Buffer.from('late invalid ciphertext'));await Promise.resolve();assert.equal(f.calls.run,0);
});

test('bootstrap refusal never invokes runOnce, and an exception after entry preserves uncertain exposure',async()=>{
  const refused=fixture();refused.prepareBootstrap=async()=>({status:'HOLD',runOnce(){throw Error('must not enter');}});
  const hold=await run(refused);assert.equal(hold.status,'HOLD');assert.equal(hold.bootstrapInvocations,0);
  assert.equal(hold.transportSendAttempts,0);
  const uncertain=fixture();uncertain.runError=true;const result=await run(uncertain);
  assert.equal(result.status,'UNCERTAIN');assert.equal(result.bootstrapInvocations,1);
  assert.equal(result.transportSendAttempts,null);assert.equal(uncertain.calls.run,1);
  assert.equal(JSON.stringify(result).includes(key),false);
});

test('a malformed completion cannot produce a successful public result',async()=>{
  const f=fixture();f.prepareBootstrap=async()=>({status:'PREPARED',async runOnce(){return {
    status:'COMPLETED',transportSendAttempts:null,cases:[],secret:key};}});
  const result=await run(f);assert.equal(result.status,'UNCERTAIN');
  assert.equal(result.transportSendAttempts,null);assert.equal(JSON.stringify(result).includes(key),false);
});

test('stdin accepts a single bounded byte envelope and removes listeners on stop',async()=>{
  const stream=new PassThrough(), controller=new AbortController(), receiver=createStdinEnvelopeReceiver(stream);
  const pending=receiver({signal:controller.signal,maxEnvelopeBytes:10});stream.end(Buffer.from('encrypted'));
  assert.equal((await pending).toString(),'encrypted');
  await assert.rejects(receiver({signal:controller.signal,maxEnvelopeBytes:10}));
  assert.equal(stream.listenerCount('data'),0);
  const oversized=new PassThrough(), receiveOversized=createStdinEnvelopeReceiver(oversized);
  const rejected=assert.rejects(receiveOversized({signal:controller.signal,maxEnvelopeBytes:2}));
  oversized.write(Buffer.from('three'));await rejected;assert.equal(oversized.listenerCount('data'),0);
  const idle=new PassThrough(), cancelled=new AbortController(), receiveIdle=createStdinEnvelopeReceiver(idle);
  const aborted=assert.rejects(receiveIdle({signal:cancelled.signal,maxEnvelopeBytes:10}));
  cancelled.abort();await aborted;assert.equal(idle.listenerCount('data'),0);
});

test('the runtime loader accepts import-only ESM, requires exact versions and rejects escaping package links',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'monaco-cli-runtime-test-'));
  const root=join(directory,'monaco-first-six-runtime');mkdirSync(root);
  writeFileSync(join(root,'package.json'),'{}');
  try {
    for (const [name,version] of Object.entries(RUNTIME_PACKAGES)) {
      const target=join(root,'node_modules',name);mkdirSync(target,{recursive:true});
      if (name === '@actions/artifact') {
        writeFileSync(join(target,'package.json'),JSON.stringify({name,version,type:'module',
          exports:{'.':{import:'./index.mjs'}}}));
        writeFileSync(join(target,'index.mjs'),'export class DefaultArtifactClient {}');
      } else {
        writeFileSync(join(target,'package.json'),JSON.stringify({name,version,main:'index.cjs'}));
        writeFileSync(join(target,'index.cjs'),`exports.${name==='openai'?'OpenAI':'Client'}=class {};`);
      }
    }
    assert.deepEqual((await loadPinnedRuntime(directory)).versions,RUNTIME_PACKAGES);
    const manifestPath=join(root,'node_modules/openai/package.json');
    writeFileSync(manifestPath,JSON.stringify({name:'openai',version:'6.48.1',main:'index.cjs'}));
    await assert.rejects(loadPinnedRuntime(directory));
    rmSync(join(root,'node_modules/openai'),{recursive:true});
    const outside=join(directory,'escaped-openai');mkdirSync(outside);
    writeFileSync(join(outside,'package.json'),JSON.stringify({version:'6.48.0',main:'index.cjs'}));
    symlinkSync(outside,join(root,'node_modules/openai'));
    await assert.rejects(loadPinnedRuntime(directory));
  } finally {rmSync(directory,{recursive:true,force:true});}
});
