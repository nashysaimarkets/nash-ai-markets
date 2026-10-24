/** Offline preparation only. No credentials, database, network or provider call.
 * Appends a single source/run-bound continuation without modifying old rows.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const CONTINUATION_PINS=Object.freeze({
 originalSourceSha:'9e82c6d25dcb7f589e2328b2efc7910033d8fcdc',originalRunId:'40083992183',
 originalEvidenceSha:'4ebb6a4023d7a01ca5188d54f592264acf48644b',
 originalBindingEvidenceSha256:'e4d5484e473dd4ac0884816e652f549d04127426a07056738d744a92fa50902e',
 planSha256:'9490af55e554f84d63d7afc1fe2442298afd6cdbe8f356d6d8d0517504420ff0',
 ledgerKey:'monaco-first-six-aggregate',candidateSha:'f5e820b0bd7bf095153e31d692a10fb3640ba16e',
 backendRef:'neon:bitter-grass-28096464/br-aged-mode-zaa9u7lr/monaco_ledger',
 projectRef:'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI',keyTrackingId:'key_aD5pc20EZBLGECNC',
 keyFingerprintSha256:'107e0cb3265e15aa25e3fa49c91512096f84b43d5fa834761c73c3cce2c99d0e',
 controlPlaneSha256:'32c788992c1909a8c704e35744f94ebb6df82fd121cff4878653a1d1da03dfc1',
 remainingCaseIds:Object.freeze(['d002','d003','d004','d005','d006']),
});
const P=CONTINUATION_PINS;
const hash=x=>createHash('sha256').update(x).digest('hex');
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const need=(x,message)=>{if(!x)throw Error(message);};
const q=x=>{need(typeof x==='string'&&!x.includes('\0'),'SQL string required');return "'"+x.replaceAll("'","''")+"'";};
const num=x=>typeof x==='number'?x:typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)?Number(x):NaN;
const idsEqual=x=>JSON.stringify(x)===JSON.stringify(P.remainingCaseIds);

export function validateContinuationEvidence(e){
 need(e?.kind==='MONACO_FIRST_SIX_CONTINUATION_V1'&&e.originalSourceSha===P.originalSourceSha
  &&e.originalRunId===P.originalRunId&&idsEqual(e.remainingCaseIds)&&digest(e.priorReceiptSha256)
  &&e.priorCommittedMicroUsd===216800&&e.previousTransportSendAttempts===2
  &&e.maximumAdditionalSends===15&&e.maximumAdditionalExposureMicroUsd===1598000
  &&e.maximumCombinedSends===17&&e.maximumCombinedExposureMicroUsd===1814800
  &&e.originalCaseImmutable===true,'Exact unchanged remaining-case scope required');
 return e;
}

export function buildContinuationAdmission({binding,bindingEvidenceSha256,evidence,authorizationEvidenceSha256,
 evidenceSha,runId,carryIn,planBytes}){
 validateContinuationEvidence(evidence);
 need(binding?.verified===true&&sha(binding.sourceSha)&&binding.sourceSha!==P.originalSourceSha
  &&binding.environment==='monaco-first-six-inference'&&binding.ledgerKey===P.ledgerKey
  &&binding.backendRef===P.backendRef&&binding.projectRef===P.projectRef
  &&binding.keyTrackingId===P.keyTrackingId&&binding.keyFingerprintSha256===P.keyFingerprintSha256
  &&binding.planSha256===P.planSha256&&binding.controlPlaneEvidenceSha256===P.controlPlaneSha256,
  'Reviewed actual successor source and existing credential binding required');
 need(sha(evidenceSha)&&digest(bindingEvidenceSha256)&&digest(authorizationEvidenceSha256)
  &&typeof runId==='string'&&/^[1-9][0-9]{0,19}$/.test(runId)&&runId!==P.originalRunId,
  'Actual reviewed evidence and distinct pending run required');
 const prior=Array.isArray(carryIn)&&carryIn.length===1?carryIn[0]:carryIn;
 need(prior&&prior.runner_can_login===false&&num(prior.runner_sessions)===0
  &&num(prior.cases)===1&&num(prior.calls)===3&&Number.isFinite(Date.parse(prior.observed_at)),
  'Observed inactive one-case predecessor required');
 const b=prior.original_binding,a=prior.d001_account;
 need(b?.ledger_key===P.ledgerKey&&b.runner_source_sha===P.originalSourceSha
  &&b.binding_evidence_sha256===P.originalBindingEvidenceSha256&&b.plan_sha256===P.planSha256
  &&b.backend_ref===P.backendRef&&b.project_ref===P.projectRef
  &&b.existing_key_tracking_id===P.keyTrackingId&&b.key_fingerprint_sha256===P.keyFingerprintSha256
  &&a?.ledger_key===P.ledgerKey&&a.case_id==='d001'&&num(a.reserved_microusd)===216800
  &&a.receipt_sha256===evidence.priorReceiptSha256,'Original binding and actual d001 accounting must match');
 need(planBytes instanceof Uint8Array&&hash(planBytes)===P.planSha256,'Frozen plan hash mismatch');
 const plan=JSON.parse(Buffer.from(planBytes).toString('utf8'));
 need(plan.calls.length===18&&plan.maximumSends===18&&plan.retries===0
  &&plan.maximumDirectTokenCostMicroUsd===1917600&&plan.scannerCandidateSha===P.candidateSha,'Original paid scope changed');
 const rows=[];
 for(const id of ['d001',...P.remainingCaseIds])for(const slot of ['main','primary_precision','rescue_precision']){
  const found=plan.calls.filter(c=>c.caseId===id&&c.slot===slot);
  need(found.length===1&&digest(found[0].fingerprint),'Exact frozen request pin missing');
  rows.push(`${id}:${slot}:${found[0].fingerprint}`);
 }
 const requestPinsSha256=hash(rows.join('\n'));
 const identity={environment:binding.environment,sourceSha:binding.sourceSha,backendRef:binding.backendRef,
  projectRef:binding.projectRef,keyTrackingId:binding.keyTrackingId,keyFingerprintSha256:binding.keyFingerprintSha256,
  planSha256:binding.planSha256,continuation:{originalSourceSha:P.originalSourceSha,originalRunId:P.originalRunId,
   evidenceSha,runId,runAttempt:'1',priorReceiptSha256:evidence.priorReceiptSha256}};
 const identitySql=q(JSON.stringify(identity))+'::jsonb';
 const ownerGuard=`IF current_database()<>'monaco_ledger' OR session_user<>'monaco_ledger_owner'
  OR current_user<>'monaco_ledger_owner' THEN RAISE EXCEPTION 'Exact isolated owner required'; END IF;`;
 const roleGuard=`IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='monaco_ledger_runner' AND NOT rolcanlogin
  AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls)
  OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='monaco_ledger_runner')
  OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='monaco_ledger_runner') THEN
  RAISE EXCEPTION 'Inactive restricted runner required'; END IF;`;
 const admissionSql=`-- Append-only original-allowance continuation; source ${binding.sourceSha}, evidence ${evidenceSha}, run ${runId}.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
LOCK TABLE private.monaco_first_six_continuation,private.monaco_runner_binding,private.monaco_prior_budget,
 private.monaco_request_pins,private.pocket_benchmark_pilot_ledgers,private.pocket_benchmark_budget_configs,
 private.pocket_benchmark_pilot_cases,private.pocket_benchmark_pilot_calls,
 private.pocket_benchmark_budget_accounts,private.pocket_benchmark_pilot_cost_attestations IN ACCESS EXCLUSIVE MODE;
DO $admit$
DECLARE s jsonb;
BEGIN
 ${ownerGuard}
 ${roleGuard}
 IF EXISTS(SELECT 1 FROM private.monaco_first_six_continuation)
  OR (SELECT count(*) FROM private.pocket_benchmark_pilot_ledgers)<>1
  OR (SELECT count(*) FROM private.pocket_benchmark_pilot_cases)<>1
  OR (SELECT count(*) FROM private.pocket_benchmark_pilot_calls)<>3
  OR (SELECT count(*) FROM private.pocket_benchmark_budget_accounts)<>1
  OR EXISTS(SELECT 1 FROM private.pocket_benchmark_pilot_cost_attestations)
  OR private.monaco_first_six_d001_accounted(${q(evidence.priorReceiptSha256)}) IS DISTINCT FROM true
  OR (SELECT count(*) FROM private.monaco_request_pins)<>18
  OR private.monaco_first_six_pin_digest() IS DISTINCT FROM ${q(requestPinsSha256)} THEN
  RAISE EXCEPTION 'Exact original terminal history required; never re-admit or reset'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.monaco_runner_binding WHERE singleton
  AND ledger_key=${q(P.ledgerKey)} AND runner_source_sha=${q(P.originalSourceSha)}
  AND binding_evidence_sha256=${q(P.originalBindingEvidenceSha256)}
  AND backend_ref=${q(P.backendRef)} AND project_ref=${q(P.projectRef)}
  AND existing_key_tracking_id=${q(P.keyTrackingId)} AND key_fingerprint_sha256=${q(P.keyFingerprintSha256)}
  AND plan_sha256=${q(P.planSha256)}) THEN RAISE EXCEPTION 'Original binding changed'; END IF;
 s:=private.monaco_budget_state(${q(P.ledgerKey)});
 IF (s->>'prior_exposure_microusd')::bigint IS DISTINCT FROM 0
  OR (s->>'new_commitments_microusd')::bigint IS DISTINCT FROM 216800
  OR (s->>'remaining_microusd')::bigint IS DISTINCT FROM 4783200 THEN
  RAISE EXCEPTION 'Original carry-in and charged reservation changed'; END IF;
END $admit$;
INSERT INTO private.monaco_first_six_continuation(ledger_key,original_source_sha,original_run_id,original_evidence_sha,
 original_binding_evidence_sha256,successor_source_sha,evidence_sha,run_id,run_attempt,
 prior_receipt_sha256,prior_committed_microusd,request_pins_sha256,prior_budget_evidence_sha256,
 binding_evidence_sha256,authorization_evidence_sha256,allowed_case_ids,maximum_additional_sends,
 maximum_additional_microusd,maximum_combined_microusd,authorized_at,valid_until)
SELECT ${[P.ledgerKey,P.originalSourceSha,P.originalRunId,P.originalEvidenceSha,P.originalBindingEvidenceSha256,
 binding.sourceSha,evidenceSha,runId].map(q).join(',')},1,${q(evidence.priorReceiptSha256)},216800,${q(requestPinsSha256)},
 evidence_sha256,${q(bindingEvidenceSha256)},${q(authorizationEvidenceSha256)},ARRAY['d002','d003','d004','d005','d006'],
 15,1598000,1814800,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+INTERVAL '60 minutes'
FROM private.monaco_prior_budget WHERE singleton;
INSERT INTO private.pocket_benchmark_budget_configs(ledger_key,project_ref,candidate_sha,staging_ref,
 key_tracking_id,key_fingerprint_sha256,model,service_tier,pricing_evidence_ref,runtime_evidence_sha256,
 reviewer_ref,verified_at,valid_until)
SELECT l.ledger_key,l.project_ref,l.candidate_sha,b.backend_ref,b.existing_key_tracking_id,b.key_fingerprint_sha256,
 'gpt-5-mini-2025-08-07',l.rate_tier,l.pricing_evidence_ref,${q(bindingEvidenceSha256)},
 ${q('Reviewed-first-six-continuation-'+evidenceSha)},c.authorized_at,c.valid_until
FROM private.pocket_benchmark_pilot_ledgers l JOIN private.monaco_runner_binding b USING(ledger_key)
 JOIN private.monaco_first_six_continuation c USING(ledger_key) WHERE l.ledger_key=${q(P.ledgerKey)};
DO $verify$
DECLARE s jsonb;
BEGIN
 s:=private.inspect_monaco_isolated_runner(${q(P.ledgerKey)},${identitySql});
 IF (s->>'continuation_allowed')::boolean IS DISTINCT FROM true
  OR (s->>'new_commitments_microusd')::bigint IS DISTINCT FROM 216800
  OR s->>'continuation_run_id' IS DISTINCT FROM ${q(runId)} THEN
  RAISE EXCEPTION 'Atomic continuation admission verification failed'; END IF;
END $verify$;
COMMIT;
`;
 const activationSql=`-- Only after this exact pending job's ordinary owner review is ready.
DO $activate$
DECLARE s jsonb; deadline timestamptz;
BEGIN
 ${ownerGuard}
 ${roleGuard}
 IF (SELECT count(*) FROM private.pocket_benchmark_pilot_cases)<>1
  OR (SELECT count(*) FROM private.pocket_benchmark_pilot_calls)<>3 THEN
  RAISE EXCEPTION 'Continuation has already started; never reactivate'; END IF;
 s:=private.inspect_monaco_isolated_runner(${q(P.ledgerKey)},${identitySql});
 IF (s->>'continuation_allowed')::boolean IS DISTINCT FROM true
  OR (s->>'new_commitments_microusd')::bigint IS DISTINCT FROM 216800 THEN
  RAISE EXCEPTION 'Exact unstarted continuation required'; END IF;
 deadline:=clock_timestamp()+INTERVAL '35 minutes';
 IF (s->>'continuation_valid_until')::timestamptz<=deadline THEN
  RAISE EXCEPTION 'Continuation configuration would expire during the bounded job'; END IF;
 EXECUTE format('ALTER ROLE monaco_ledger_runner LOGIN VALID UNTIL %L',deadline);
END $activate$;
`;
 return {admissionSql,activationSql,identity,requestPinsSha256,bindingEvidenceSha256,authorizationEvidenceSha256,
  sourceSha:binding.sourceSha,evidenceSha,runId,priorReceiptSha256:evidence.priorReceiptSha256,
  maximumCombinedSends:17,maximumCombinedExposureMicroUsd:1814800,executed:false};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 need(args.length===7,'Usage: node prepare-monaco-continuation-admission.mjs ROOT BINDING_PATH CONTINUATION_PATH EVIDENCE_COMMIT RUN_ID CARRY_IN_JSON OUTPUT_PREFIX');
 const [root,bindingPath,continuationPath,evidenceSha,runId,carryInPath,prefix]=args;
 const read=p=>{need(/^docs\/monaco-126\/isolated-runner\/[A-Za-z0-9_.-]+\.json$/.test(p),'Bound evidence path required');return readFileSync(resolve(root,p));};
 const bindingBytes=read(bindingPath),authorizationBytes=read(continuationPath);
 const r=buildContinuationAdmission({binding:JSON.parse(bindingBytes),bindingEvidenceSha256:hash(bindingBytes),
  evidence:JSON.parse(authorizationBytes),authorizationEvidenceSha256:hash(authorizationBytes),evidenceSha,runId,
  carryIn:JSON.parse(readFileSync(resolve(carryInPath),'utf8')),
  planBytes:readFileSync(resolve(root,'docs/monaco-126/internal-diagnostics/FIRST-SIX-PROVIDER-PLAN.json'))});
 writeFileSync(resolve(prefix+'.admission.sql'),r.admissionSql,{flag:'wx',mode:0o600});
 writeFileSync(resolve(prefix+'.activate.sql'),r.activationSql,{flag:'wx',mode:0o600});
 process.stdout.write(JSON.stringify({...r,admissionSql:undefined,activationSql:undefined,
  admissionSqlSha256:hash(r.admissionSql),activationSqlSha256:hash(r.activationSql)})+'\n');
}
