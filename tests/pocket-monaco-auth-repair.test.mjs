/** Regression tests use exact NONSECRET evidence and synthetic credentials/SQL/TLS.
 * No real password, network, hosted database, provider SDK or paid request. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {TLSSocket} from 'node:tls';
import {authenticateStoredCredentials} from '../scripts/pocket-monaco-credential-auth.mjs';
import {NEON_AUTH_PINS, NEON_AUTH_CATALOG_SQL} from '../scripts/pocket-monaco-neon-auth-probe.mjs';
import {neonConnectionOptions, createNeonSqlPort} from '../scripts/pocket-monaco-neon-port.ts';
import {PINS, inspectSetupLedger} from '../scripts/pocket-monaco-setup-preflight.mjs';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const readEvidence = name => readFileSync(new URL('../docs/monaco-126/isolated-runner/'+name, import.meta.url));
const KEY = 'sk-proj-' + 'synthetic_only_'.repeat(8);
const flags = ['can_login','limited_role','no_memberships','database_connect',
  'database_no_create_or_temp','public_usage','public_no_create','private_schemas_denied',
  'rpc_shape','rpc_execute','other_entrypoints_denied','private_tables_denied',
  'private_sequences_denied','expected_tables_rls','immutable_guards_present'];
const row = () => ({database_name:NEON_AUTH_PINS.databaseName,current_role:NEON_AUTH_PINS.roleName,
  session_role:NEON_AUTH_PINS.roleName,tls_active:false,...Object.fromEntries(flags.map(f=>[f,true]))});
function fixture(t, length=16) {
  const socket = new TLSSocket(); // Synthetic socket state only, never connect.
  Object.assign(socket, {authorized:true,servername:NEON_AUTH_PINS.endpointHost});
  t.after(()=>socket.destroy());
  const password = ('npg_'+'uN1tTe5tQxYz'.repeat(90)).slice(0,length);
  const seen = {keyReads:0,passwordReads:0,creates:0,connects:0,queries:0,closes:0};
  const identityBytes = readEvidence('NEON-IDENTITY-EVIDENCE.json');
  const storageBytes = readEvidence('INFERENCE-CREDENTIAL-STORAGE-RECEIPT.json');
  const context = {repository:NEON_AUTH_PINS.repository,ref:'refs/heads/'+PINS.branch,
    event:'push',attempt:'1',runId:'synthetic-only',sourceSha:'a'.repeat(40),reviewedSourceSha:'a'.repeat(40),
    reviewedIdentityEvidenceSha256:hash(identityBytes),reviewedStorageSha256:hash(storageBytes)};
  const client = {connection:{stream:socket}, async connect(){seen.connects++;},
    async query(sql){seen.queries++;assert.equal(sql,NEON_AUTH_CATALOG_SQL);return {rows:[row()]};},
    async end(){seen.closes++;}};
  const args = {context,identityBytes,storageBytes,readInferenceKey(){seen.keyReads++;return KEY;},
    readLedgerPassword(){seen.passwordReads++;return password;},
    createClient(options){seen.creates++;seen.options=options;return client;}};
  return {args, seen, client, socket, password};
}
function assertNoValues(result, password) {
  const text = JSON.stringify(result);
  assert.ok(!text.includes(KEY));if(password?.length>8)assert.ok(!text.includes(password));
  assert.equal(result.providerRequests,0);assert.equal(result.databaseWrites,0);assert.equal(result.paidDispatchEnabled,false);
}
function neonIdentity() {return {organizationId:PINS.organization,projectId:PINS.projectId,branchId:PINS.branchId,
  endpointHost:PINS.host,databaseName:PINS.database,roleName:PINS.role,controlPlaneEvidenceSha256:'b'.repeat(64)};}
function setupFixture(length) {
  const config={environment:PINS.environment,invocationBranch:PINS.branch,reviewer:'nashysaimarkets',administratorBypass:false,
    repositoryTokenPermissions:{contents:'read'},concurrency:{group:'monaco-first-six-existing-five-dollar-allowance',
      cancelInProgress:false,maxChartsInFlight:1,maxCallsInFlight:1},acceptedRunAttempt:1,realDispatchEnabled:false,
    planSha256:PINS.planSha256,ledger:{provider:'Neon',backendRef:PINS.backend,organisationId:PINS.organization,
      projectId:PINS.projectId,branchId:PINS.branchId,endpointHost:PINS.host,databaseName:PINS.database,
      runtimeRole:PINS.role,maximumNewMonthlyCostUsd:0,plan:'free'},secrets:{newOpenAIKeyAllowed:false,
      existingInferenceKeyEnvironmentSecret:'MONACO_FIRST_SIX_OPENAI_API_KEY',isolatedLedgerCredentialEnvironmentSecret:'MONACO_FIRST_SIX_LEDGER_KEY',
      existingInferenceKeyTrackingId:PINS.keyTrackingId,existingInferenceProject:PINS.project}};
  const evidence={existingCredentialBinding:{verified:true,environment:PINS.environment,sourceSha:'a'.repeat(40),
      backendRef:PINS.backend,projectRef:PINS.project,keyTrackingId:PINS.keyTrackingId,keyFingerprintSha256:hash(KEY),
      planSha256:PINS.planSha256,ledgerKey:'synthetic-existing-allowance',controlPlaneEvidenceSha256:'b'.repeat(64)},
    processorSecurityAcceptance:{securityApprovalRef:'synthetic-only',onBehalfAccepted:true,retentionAccepted:true,
      trainingAccepted:true,territoryAccepted:true,privateArtifactsAccepted:true},authoritativeBudgetCarryIn:{
      evidenceComplete:true,aggregateCapMicroUsd:PINS.cap,historicalAccountingKeptSeparate:true,cashAllowanceApproved:true,
      spentMicroUsd:1000000,reservedMicroUsd:500000,unresolvedMicroUsd:250000}};
  const context={repository:PINS.repository,event:'push',ref:'refs/heads/'+PINS.branch,runAttempt:'1',
    sourceSha:'a'.repeat(40),reviewedSourceSha:'a'.repeat(40),evidenceSha:'d'.repeat(40),reviewedEvidenceSha:'d'.repeat(40)};
  const credentials={existingKey:KEY,ledgerPassword:('npg_'+'uN1tTe5tQxYz'.repeat(3)).slice(0,length)};
  const seen={creates:0,queries:0,closes:0};
  const dependencies={connectionOptions:neonConnectionOptions,createPort:createNeonSqlPort,createClient(options){
    seen.creates++;assert.equal(options.password,credentials.ledgerPassword);assert.equal(options.ssl.rejectUnauthorized,true);
    return {async connect(){},async end(){seen.closes++;},async query(sql,values){seen.queries++;
      assert.equal(values[2],'inspect_monaco_isolated_runner');return {rows:[{result:{binding_matches:true,setup_only:true,
        ledger_key:'synthetic-existing-allowance',prior_exposure_microusd:1750000,new_commitments_microusd:0,remaining_microusd:3250000}}]};}};}};
  return {config,evidence,context,credentials,dependencies,seen};
}
const inspect = f => inspectSetupLedger(f.config,f.evidence,f.context,f.credentials,f.dependencies);

test('exact evidence pins equal the failed workflow pins; no checksum workaround',()=>{
 assert.equal(hash(readEvidence('NEON-IDENTITY-EVIDENCE.json')),'32c788992c1909a8c704e35744f94ebb6df82fd121cff4878653a1d1da03dfc1');
 assert.equal(hash(readEvidence('INFERENCE-CREDENTIAL-STORAGE-RECEIPT.json')),'0d8800d8b052454e2ce1a5b72addb3c059c4b8895fb0757942f7bd6294d854c8');
});
for(const length of [12,16,23,24])test(`protected authentication accepts supported ${length}-character input only after actual probe guards`,async t=>{
 const f=fixture(t,length), result=await authenticateStoredCredentials(f.args);
 assert.equal(result.status,'PASS');assert.equal(f.seen.connects,1);assert.equal(f.seen.queries,1);assert.equal(f.seen.closes,1);
 assert.equal(result.ledgerAuthentication.clientTlsVerified,true);assert.equal(result.providerAuthenticationVerified,false);
 assert.equal(f.seen.options.ssl.rejectUnauthorized,true);assert.equal(f.seen.options.ssl.servername,PINS.host);
 assert.equal(f.seen.options.user,PINS.role);assert.equal(f.seen.options.options,'-c default_transaction_read_only=on');
 assertNoValues(result,f.password);
});
for(const length of [12,16,23,24])test(`same ${length}-character credential works through actual SQL transport and setup preflight`,async()=>{
 const f=setupFixture(length),result=await inspect(f);assert.equal(result.status,'PASS');
 assert.equal(f.seen.queries,1);assert.equal(f.seen.closes,1);assert.equal(result.realDispatchEnabled,false);
 assert.equal(result.providerInferenceRequests,0);assert.ok(!JSON.stringify(result).includes(f.credentials.ledgerPassword));
});
test('missing, non-string and below-minimum password is rejected without creating a client',async t=>{
 for(const value of [undefined,null,'',11,'too-short','x'.repeat(11)]){
  const f=fixture(t);f.args.readLedgerPassword=()=>value;const result=await authenticateStoredCredentials(f.args);
  assert.equal(result.status,'HOLD');assert.equal(result.failedCheck,'LEDGER_PASSWORD_INPUT');assert.equal(f.seen.creates,0);
  assert.throws(()=>neonConnectionOptions(neonIdentity(),value));const s=setupFixture(16);s.credentials.ledgerPassword=value;
  assert.equal((await inspect(s)).status,'HOLD');assert.equal(s.seen.creates,0);assertNoValues(result,f.password);
 }
});
test('bad invocation/source/storage/key gets only a fixed redacted stage',async t=>{
 for(const [mutate,stage] of [
  [f=>{f.args.context.ref='refs/heads/main';},'INVOCATION'],
  [f=>{f.args.context.sourceSha='b'.repeat(40);},'SOURCE'],
  [f=>{f.args.context.reviewedStorageSha256='b'.repeat(64);},'STORAGE_EVIDENCE'],
  [f=>{f.args.readInferenceKey=()=>'';},'INFERENCE_KEY_INPUT']]){
  const f=fixture(t);mutate(f);const r=await authenticateStoredCredentials(f.args);assert.equal(r.failedCheck,stage);
  assert.equal(f.seen.creates,0);assertNoValues(r,f.password);
 }
});
test('wrong ledger identity evidence fails before reading the database password',async t=>{
 const f=fixture(t);f.args.context.reviewedIdentityEvidenceSha256='c'.repeat(64);
 const r=await authenticateStoredCredentials(f.args);assert.equal(r.status,'HOLD');assert.equal(r.failedCheck,'LEDGER_IDENTITY');
 assert.equal(f.seen.passwordReads,0);assert.equal(f.seen.creates,0);assertNoValues(r,f.password);
});
test('connection exceptions are identified without printing codes, messages, stacks or secrets and without retry',async t=>{
 const f=fixture(t,24);f.client.connect=async()=>{f.seen.connects++;throw Object.assign(Error(KEY+' '+f.password),{code:f.password});};
 const r=await authenticateStoredCredentials(f.args);assert.equal(r.status,'HOLD');assert.equal(r.failedCheck,'LEDGER_CONNECTION');
 assert.equal(f.seen.connects,1);assert.equal(f.seen.queries,0);assert.equal(f.seen.closes,1);assertNoValues(r,f.password);
});
test('a valid short credential still cannot bypass certificate or hostname verification',async t=>{
 for(const mutate of [f=>{f.socket.authorized=false;},f=>{f.socket.servername='wrong.neon.tech';},
  f=>{f.client.connection.stream={encrypted:true,authorized:true,servername:PINS.host};}]){
  const f=fixture(t);mutate(f);const r=await authenticateStoredCredentials(f.args);
  assert.equal(r.status,'HOLD');assert.equal(r.failedCheck,'LEDGER_TLS');assert.equal(f.seen.queries,0);assert.equal(f.seen.closes,1);
 }
});
test('all fifteen privilege guards remain mandatory for a valid short credential',async t=>{
 for(const flag of flags){const f=fixture(t);f.client.query=async()=>({rows:[{...row(),[flag]:false}]});
  const r=await authenticateStoredCredentials(f.args);assert.equal(r.status,'HOLD',flag);assert.equal(r.failedCheck,'LEDGER_CATALOG',flag);}
});
test('SQL errors and invalid roles cannot be confused with invalid credential format',async t=>{
 const f=fixture(t);f.client.query=async()=>{throw Error(f.password);};
 const r=await authenticateStoredCredentials(f.args);assert.equal(r.failedCheck,'LEDGER_QUERY');assertNoValues(r,f.password);
 const g=fixture(t);g.client.query=async()=>({rows:[{...row(),session_role:'monaco_ledger_owner'}]});
 assert.equal((await authenticateStoredCredentials(g.args)).failedCheck,'LEDGER_CATALOG');
});
test('caller mutation during the awaited probe cannot rewrite the admitted source or receipt digest',async t=>{
 const f=fixture(t,24),originalConnect=f.client.connect;
 f.client.connect=async()=>{f.args.context.sourceSha='b'.repeat(40);f.args.storageBytes.fill(0);await originalConnect();};
 const r=await authenticateStoredCredentials(f.args);assert.equal(r.status,'PASS');assert.equal(r.sourceSha,'a'.repeat(40));
 assert.equal(r.storageEvidenceSha256,'0d8800d8b052454e2ce1a5b72addb3c059c4b8895fb0757942f7bd6294d854c8');
});
test('a hostile probe cannot smuggle an error string into the public stage',async t=>{
 const f=fixture(t);f.args.probe=async()=>({status:'HOLD',failedCheck:KEY+f.password});
 const r=await authenticateStoredCredentials(f.args);assert.equal(r.failedCheck,'LEDGER_AUTHENTICATION');assertNoValues(r,f.password);
});
test('short-credential compatibility never bypasses unknown budget, wrong key binding or processor acceptance',async()=>{
 for(const mutate of [f=>{f.evidence.authoritativeBudgetCarryIn.spentMicroUsd=null;},
  f=>{f.evidence.authoritativeBudgetCarryIn.unresolvedMicroUsd=4000000;},
  f=>{f.evidence.existingCredentialBinding.keyFingerprintSha256='c'.repeat(64);},
  f=>{f.evidence.processorSecurityAcceptance.trainingAccepted=false;}]){
  const f=setupFixture(16);mutate(f);assert.equal((await inspect(f)).status,'HOLD');assert.equal(f.seen.creates,0);
 }
});
