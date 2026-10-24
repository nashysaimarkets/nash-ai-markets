/** Synthetic offline authority/materialization controls. No returned SQL is
 * executed or retained as an operational grant. Actual SQL tests are separate. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,readFileSync,copyFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {P,HERE,EXECUTION,ACCEPTED,sha,boundInputs,buildRecoveryProposal,buildRecoveryGrant,ownerApprovalPrompt,ownerAmendmentBody} from '../recovery-builder.mjs';
import {prepareOperationalVariants,validateFinalRecoveryLedger,buildRecoveryActivation} from '../recovery-operations.mjs';
const bytes=v=>Buffer.from(JSON.stringify(v));
const NOW=Date.parse('2026-10-24T17:00:00Z');
const proposal=buildRecoveryProposal(),bound=boundInputs();
function fixture(){
 const ownerDecision={decision:'APPROVED',requestText:ownerApprovalPrompt(proposal.proposalSha256),ownerResponseText:'Yes',recordedAt:'2026-10-24T16:58:00Z'};
 const body=ownerAmendmentBody({proposalSha256:proposal.proposalSha256,approvalRequestSha256:sha(ownerDecision.requestText),ownerResponseSha256:sha(ownerDecision.ownerResponseText)});
 const ownerComment={id:99999999999,html_url:'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-99999999999',user:{login:'nashysaimarkets'},body,created_at:'2026-10-24T16:59:00Z'};
 const reviewEvidence={decision:'ACCEPTED',proposalSha256:proposal.proposalSha256,installSqlSha256:sha(proposal.installSql),rpcAfterSha256:proposal.rpcAfterSha256};
 const pendingEvidence={observedAt:'2026-10-24T16:59:30Z',
  run:JSON.parse(readFileSync(join(EXECUTION,'d002-preparation/OFFICIAL-PENDING-RUN.json'))),
  jobs:JSON.parse(readFileSync(join(EXECUTION,'d002-preparation/OFFICIAL-PENDING-JOBS.json'))),
  environments:JSON.parse(readFileSync(join(EXECUTION,'d002-preparation/OFFICIAL-PENDING-ENVIRONMENT.json')))};
 const carryIn={observedAt:'2026-10-24T16:59:30Z',databaseName:'monaco_ledger',sessionUser:'monaco_ledger_owner',currentUser:'monaco_ledger_owner',
  scope:bound.scope,permit:bound.permit,recoveryPrior:bound.prior,originalHistorySha256:P.originalHistory,
  scopeCount:1,permitCount:2,claimCount:1,accountCount:1,submissionCount:3,receiptCount:3,stopCount:0,
  claim:null,account:null,submissions:[],receipts:[],stops:[],revocations:[],
  evaluationHeldMicroUsd:330000,originalHeldMicroUsd:1506400,aggregateCapMicroUsd:5000000,
  unreceiptedSubmissionCount:0,unaccountedClaimCount:0,runner:{canLogin:false,sessions:0},runnerRestricted:true,
  recoveryInstalled:false,originalRpcBodySha256:P.originalRpc};
 return {ownerComment,ownerDecision,reviewEvidence,pendingEvidence,carryIn,validUntil:'2026-10-24T17:45:00Z'};
}
function build(f=fixture()){
 return buildRecoveryGrant({ownerCommentBytes:bytes(f.ownerComment),ownerDecisionBytes:bytes(f.ownerDecision),reviewEvidenceBytes:bytes(f.reviewEvidence),
  pendingEvidenceBytes:bytes(f.pendingEvidence),carryInBytes:bytes(f.carryIn),validUntil:f.validUntil,now:NOW},proposal);
}
function observed(r){
 const f=fixture(),l={...r.manifest.lease,granted_at:'2026-10-24T17:00:00.000123+00:00'};
 const helpers=Object.fromEntries(Object.entries(proposal.manifest.helperBodies).map(([name,h])=>[name,{bodySha256:h,owner:'monaco_ledger_owner',securityDefiner:true,
  settings:['search_path=pg_catalog, private','TimeZone=UTC'],acl:'{monaco_ledger_owner=X/monaco_ledger_owner}'}]));
 return {...f.carryIn,observedAt:'2026-10-24T17:00:01Z',executionLease:{row:l,sha256:'c'.repeat(64),count:1,active:true,
  rpcBodySha256:proposal.rpcAfterSha256,owner:'monaco_ledger_owner',securityDefiner:true,
  settings:['search_path=pg_catalog, private'],acl:'{monaco_ledger_owner=X/monaco_ledger_owner,monaco_ledger_runner=X/monaco_ledger_owner}',helpers}};
}
test('RPC amendment changes exactly one expression and binds the observed original attributes',()=>{
 assert.equal(proposal.rpcBeforeSha256,P.originalRpc);
 assert.equal(proposal.rpcAfter.replace('(p.valid_until<=clock_timestamp() AND NOT coalesce(private.monaco_scanner_eval_v2_unused_lease_active(p),false))','p.valid_until<=clock_timestamp()'),proposal.rpcBefore);
 const o=JSON.parse(readFileSync(join(EXECUTION,'d002-preparation/INSTALLED-ORIGINAL-RPC-OBSERVATION.json')));
 for(const m of [v=>v.body+=' ',v=>v.owner='postgres',v=>v.security_definer=false,v=>v.acl=null,v=>v.settings=[]]){
  const x=structuredClone(o);m(x);assert.throws(()=>buildRecoveryProposal({installedObservation:x}));
 }
});
test('missing, old, proposed, denied, or mismatched owner authority cannot materialize a grant',()=>{
 for(const m of [f=>f.ownerDecision.decision='HOLD',f=>f.ownerDecision.ownerResponseText='No',f=>delete f.ownerDecision.requestText,
  f=>f.ownerComment.body=f.ownerComment.body.replace('decision: APPROVED','decision: PROPOSED'),
  f=>f.ownerComment.body=f.ownerComment.body.replace('decision: APPROVED','decision: REJECTED'),
  f=>f.ownerComment.body+='\nHOLD pending owner',f=>f.ownerComment.html_url=P.oldRef,
  f=>f.ownerComment.created_at=null,f=>f.ownerDecision.recordedAt=null,
  f=>f.ownerDecision.requestText+=' changed',f=>f.ownerDecision.requestText=`Do you want to REJECT ${proposal.proposalSha256} for v2-d002 / run 40105387615 / job 120905891814 / attempt 1?`,f=>f.ownerComment.user.login='other']){
  const f=fixture();m(f);assert.throws(()=>build(f));
 }
 assert.throws(()=>buildRecoveryGrant({ownerCommentBytes:bytes({status:'HOLD'})},proposal));
});
test('synthetic complete material uses one atomic install and grant with original permit untouched',()=>{
 const r=build();assert.match(r.combinedSql,/^-- NEW PROTOCOL AMENDMENT[^]*\nBEGIN;/);
 assert.equal((r.combinedSql.match(/\nCOMMIT;/g)??[]).length,1);
 assert.match(r.combinedSql,/CREATE OR REPLACE FUNCTION public\.monaco_scanner_evaluation_v2_rpc/);
 assert.match(r.combinedSql,/INSERT INTO private\.monaco_scanner_eval_v2_unused_leases/);
 assert.equal(/^\s*(ALTER ROLE|UPDATE private\.monaco_scanner_eval_v2_permits|DELETE FROM|TRUNCATE|.*DISABLE TRIGGER)/m.test(r.combinedSql),false);
 assert.equal(r.manifest.lease.original_permit.valid_until,'2026-10-24T15:50:00+00:00');
 assert.equal(r.manifest.lease.original_permit.admitted_at,'2026-10-24T15:07:25.068435+00:00');
 assert.equal(r.manifest.activation,'HOLD_UNTIL_COMMITTED_LEASE_INDEPENDENTLY_OBSERVED');
});
test('wrong or stale official/ledger evidence fails before materialization',()=>{
 for(const m of [f=>f.pendingEvidence.run.status='in_progress',f=>f.pendingEvidence.jobs.jobs[0].id=1,
  f=>f.pendingEvidence.jobs.jobs[0].steps=[{}],f=>f.pendingEvidence.environments[0].reviewers=[],
  f=>f.pendingEvidence.observedAt='2026-10-24T16:40:00Z',f=>f.carryIn.runner.canLogin=true,
  f=>f.carryIn.claim={},f=>f.carryIn.recoveryInstalled=true,f=>f.carryIn.permit={...f.carryIn.permit,valid_until:'2026-10-24T17:50:00Z'},
  f=>f.reviewEvidence.proposalSha256='0'.repeat(64)]){const f=fixture();m(f);assert.throws(()=>build(f));}
});
test('lease bounds reject expiry, insufficient login room and more than sixty minutes',()=>{
 for(const validUntil of [null,'infinity','2026-10-24T16:59:00Z','2026-10-24T17:20:00Z','2026-10-24T18:00:00.001Z']){
  const f=fixture();f.validUntil=validUntil;assert.throws(()=>build(f));
 }
});
test('final result audit uses microsecond claim/submission bounds and permits late bookkeeping',()=>{
 const r=build(),committed=observed(r),ledger=structuredClone(committed);
 ledger.claim={claimed_at:'2026-10-24T17:00:00.000123+00:00'};
 ledger.submissions=[{submitted_at:'2026-10-24T17:01:00Z'},{submitted_at:'2026-10-24T17:02:00Z'}];
 ledger.receipts=[{receipted_at:'2026-10-25T19:00:00Z'}];ledger.account={accounted_at:'2026-10-25T19:00:01Z'};
 ledger.executionLease.active=false;
 assert.equal(validateFinalRecoveryLedger(ledger,committed,r.manifest,proposal).originalPermitValidUntil,'2026-10-24T15:50:00+00:00');
 for(const m of [v=>v.claim.claimed_at='2026-10-24T17:00:00.000122+00:00',
  v=>v.submissions[0].submitted_at='2026-10-24T17:45:00Z',v=>v.executionLease.row.valid_until='2026-10-24T18:00:00Z',
  v=>v.executionLease.helpers.monaco_scanner_eval_v2_unused_lease_active.bodySha256='f'.repeat(64)]){
  const v=structuredClone(ledger);m(v);assert.throws(()=>validateFinalRecoveryLedger(v,committed,r.manifest,proposal));
 }
});
test('new activation retains original history guards and substitutes only the verified lease deadline',()=>{
 const r=build(),post=observed(r),dir=mkdtempSync(join(tmpdir(),'pocket-recovery-synthetic-material-'));
 try{
  const grantManifestPath=join(dir,'SYNTHETIC-GRANT.json'),postLeaseObservationPath=join(dir,'SYNTHETIC-POST.json');
  writeFileSync(grantManifestPath,bytes(r.manifest));writeFileSync(postLeaseObservationPath,bytes(post));
  const sql=buildRecoveryActivation({grantManifestPath,postLeaseObservationPath,now:NOW+2000});
  assert.match(sql,/p\.valid_until IS DISTINCT FROM '2026-10-24T15:50:00.000Z'/);
  assert.match(sql,/login_deadline>=l\.valid_until/);assert.doesNotMatch(sql,/login_deadline>=p\.valid_until/);
  assert.match(sql,/Retained d001 receipts changed/);assert.match(sql,/private\.monaco_scanner_eval_v2_unused_lease_active\(p\)/);
  assert.equal((sql.match(/ALTER ROLE/g)??[]).length,1);
  assert.throws(()=>buildRecoveryActivation({grantManifestPath,postLeaseObservationPath,now:NOW+30*60000}));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('generated root-only opener performs lease audit before reading the private key',()=>{
 const o=prepareOperationalVariants(proposal),source=o['ROOT-ONLY-DECRYPT-RECOVERED-v2-d002.mjs'];
 assert.ok(source.indexOf('validateFinalRecoveryLedger(ledger,')<source.indexOf('keyBytes=bytes(resolve(keyPath)'));
 assert.match(source,/recoveryProtocol:recoveryAudit/);assert.match(source,/openEvaluationArtifact/);
 assert.match(o['POST-LEASE-OBSERVATION.sql'],/'executionLease'/);assert.match(o['PRE-GRANT-OBSERVATION.sql'],/'recoveryInstalled'/);
 assert.equal(JSON.parse(o['OWNER-DECISION.HOLD.json']).decision,'HOLD');
});
test('tampered recovery module initializer is refused before import or any private-key read',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pocket-recovery-tamper-control-')),ops=prepareOperationalVariants(proposal);
 const opener=join(dir,'root-opener.mjs'),moduleDir=join(dir,'modules'),art=join(dir,'artifacts');
 mkdirSync(moduleDir);mkdirSync(art);writeFileSync(opener,ops['ROOT-ONLY-DECRYPT-RECOVERED-v2-d002.mjs']);
 for(const f of ['lease-schema.sql','recovery-builder.mjs'])copyFileSync(join(HERE,f),join(moduleDir,f));
 writeFileSync(join(moduleDir,'recovery-operations.mjs'),'globalThis.__pocketRecoveryTamperedModuleRan = true;');
 const ledger=join(dir,'ledger.json');writeFileSync(ledger,'{}');
 const oldArgs=process.argv,oldExit=process.exitCode,oldWrite=process.stderr.write;
 const names=['POCKET_RECOVERY_SOURCE_ROOT','POCKET_RECOVERY_EXECUTION_ROOT','POCKET_RECOVERY_ACCEPTED_ROOT'];
 const oldEnv=Object.fromEntries(names.map(k=>[k,process.env[k]]));let errors='';
 try{
  process.env.POCKET_RECOVERY_SOURCE_ROOT=moduleDir;process.env.POCKET_RECOVERY_EXECUTION_ROOT=EXECUTION;process.env.POCKET_RECOVERY_ACCEPTED_ROOT=ACCEPTED;
  process.argv=[process.execPath,opener,ledger,art,join(dir,'NONEXISTENT_PRIVATE_KEY_MUST_NOT_BE_READ'),join(dir,'out'),join(dir,'grant.json'),join(dir,'post.json')];
  process.stderr.write=function(chunk){errors+=String(chunk);return true;};
  await import(pathToFileURL(opener).href);
  assert.equal(globalThis.__pocketRecoveryTamperedModuleRan,undefined);
  assert.equal(process.exitCode,1);
  assert.equal(JSON.parse(errors).stage,'RECOVERY_SOURCE_PREIMAGE');
 }finally{
  process.argv=oldArgs;process.exitCode=oldExit;process.stderr.write=oldWrite;
  for(const k of names)oldEnv[k]===undefined?delete process.env[k]:process.env[k]=oldEnv[k];
  delete globalThis.__pocketRecoveryTamperedModuleRan;rmSync(dir,{recursive:true,force:true});
 }
});
