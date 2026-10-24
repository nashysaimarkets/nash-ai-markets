/** Offline materialization only. Imports the accepted builder; never connects,
 * reads credentials, activates a role, publishes a branch or sends a request. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const WORKSPACE='/workspace/scratch/616faf3e8649';
const REPO=join(WORKSPACE,'scanner-evaluation-v2');
const DOCS='docs/monaco-126/scanner-evaluation-v2-2026-10-24';
const SOURCE='20783ed5e8eb95a11df86b0d60766ffcbbf4fa79';
const PLAN='cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109';
const PUBLIC_RECIPIENT=join(WORKSPACE,'private-six/inputs/result-recipient.public.pem');
const need=(ok,message)=>{if(!ok)throw Error(message);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const readJson=path=>JSON.parse(readFileSync(resolve(path),'utf8'));
const json=value=>JSON.stringify(value,null,2)+'\n';
const q=value=>{need(typeof value==='string'&&!value.includes('\0'),'SQL string required');return "'"+value.replaceAll("'","''")+"'";};
const sqlJson=value=>q(JSON.stringify(value))+'::jsonb';
const [mode,configPath,outPath,...extra]=process.argv.slice(2);
need(['static','permit'].includes(mode)&&configPath&&outPath&&!extra.length,
  'Usage: node prepare-execution-material.mjs static|permit CONFIG.json NEW_OUTPUT_DIRECTORY');
const input=readJson(configPath),out=resolve(outPath);
const identity=readJson(join(REPO,DOCS,'SOURCE-IDENTITY.json'));
need(identity.testedSourceSha===SOURCE,'Accepted runtime source changed');
for(const [file,digest] of Object.entries(identity.files)){
  need(hash(readFileSync(join(REPO,file)))===digest,`Accepted file changed: ${file}`);
}
const planPath=join(REPO,DOCS,'PLAN.json'),planBytes=readFileSync(planPath);
need(hash(planBytes)===PLAN,'Accepted plan bytes changed');
const {V2_LEDGER_PINS:P,validateEvaluationV2Approval,validateEvaluationV2Plan,buildEvaluationV2Admission}
  =await import(pathToFileURL(join(REPO,'scripts/prepare-pocket-scanner-evaluation-v2-ledger.mjs')));
const {validateRunAdmission,expectedAdmissionFromConfig}
  =await import(pathToFileURL(join(REPO,'scripts/pocket-scanner-evaluation-v2-hosted-entry.mjs')));
const {recipientPublicKeySha256}
  =await import(pathToFileURL(join(REPO,'scripts/pocket-monaco-confidential-transport.mjs')));
const {rows}=validateEvaluationV2Plan(planBytes);
let outputs,summary;

if(mode==='static'){
  const caseId=input.caseId??'v2-d001';
  need(P.caseIds.includes(caseId),'One named v2 case required');
  const approval={kind:'POCKET_SCANNER_EVALUATION_V2_EXTENSION_APPROVAL',status:'APPROVED',approvedBy:'OWNER',
    approvalRef:input.approvalRef,scopeId:P.scopeId,originalAllowanceRef:'comment-6165012632',appSourceSha:P.appSourceSha,
    runtimeSourceSha:SOURCE,planSha256:PLAN,allowedCaseIds:[...P.caseIds],maximumAdditionalCases:6,maximumAdditionalSends:18,
    maximumAdditionalMicroUsd:1980000,aggregateCapMicroUsd:5000000,originalHeldMicroUsd:1506400,retries:0,
    approvedAt:input.approvedAt,validUntil:input.validUntil,approvalBodySha256:input.approvalBodySha256};
  validateEvaluationV2Approval(approval,{runtimeSourceSha:SOURCE,planSha256:PLAN});
  const body=readFileSync(resolve(input.approvalBodyPath));
  need(hash(body)===approval.approvalBodySha256,'Exact owner approval body bytes/hash disagree');
  need(typeof input.admissionEvidencePath==='string'&&typeof input.reassessmentEvidencePath==='string',
    'Independent admission and reassessment evidence files are still required');
  const admission=readFileSync(resolve(input.admissionEvidencePath));
  const reassessment=readFileSync(resolve(input.reassessmentEvidencePath));
  need(admission.length>0&&reassessment.length>0&&hash(admission)!==hash(reassessment),
    'Two distinct independently retained admission/reassessment records required');
  const recipient=readFileSync(PUBLIC_RECIPIENT,'utf8');
  const config=readJson(join(REPO,DOCS,'RUN-ADMISSION.HOLD.json'));
  need(recipientPublicKeySha256(recipient)===config.output.recipientPublicKeySha256,'Existing public recipient changed');
  const prepared=readJson(join(REPO,DOCS,'PREPARATION-RECEIPT.json'));
  const bundle=prepared.bundles.find(item=>item.caseId===caseId);
  need(bundle&&prepared.planSha256===PLAN,'Prepared case bundle absent');
  config.status='EXECUTION_APPROVED';config.caseId=caseId;config.runtimeSourceSha=SOURCE;
  config.scopeApproval={...config.scopeApproval,status:'APPROVED',approvalRef:approval.approvalRef,
    ownerDirectiveSha256:approval.approvalBodySha256};
  config.admissionEvidenceSha256=hash(admission);config.reassessmentEvidenceSha256=hash(reassessment);
  config.previousCaseReceiptSha256=input.previousCaseReceiptSha256??null;
  need(caseId==='v2-d001'?config.previousCaseReceiptSha256===null:
    typeof config.previousCaseReceiptSha256==='string'&&/^[a-f0-9]{64}$/.test(config.previousCaseReceiptSha256),
    'Later case requires the exact prior accounted receipt digest');
  config.input.bundleSha256=bundle.sha256;config.output.recipientPublicKeyPem=recipient;
  config.note='Recorded owner scope; one named case. Actual source/evidence/wrapper/run/job identities remain independently derived and require an exact post-push database permit. This local file does not activate or dispatch anything.';
  need(config.identity===undefined,'Dynamic identity must not be embedded in static evidence');
  outputs={'OWNER-APPROVAL.json':json(approval),'OWNER-APPROVAL-BODY.txt':body,
    'ADMISSION-EVIDENCE.json':admission,'REASSESSMENT-EVIDENCE.json':reassessment,'RUN-ADMISSION.json':json(config)};
  summary={kind:'POCKET_SCANNER_EVALUATION_V2_STATIC_MATERIAL',caseId,runtimeSourceSha:SOURCE,
    planSha256:PLAN,bundleSha256:bundle.sha256,expectedAdmission:expectedAdmissionFromConfig(config),
    publicRecipientSha256:config.output.recipientPublicKeySha256,containsDynamicIdentity:false};
}else{
  const staticDirectory=resolve(input.staticDirectory),config=readJson(join(staticDirectory,'RUN-ADMISSION.json'));
  const approval=readJson(join(staticDirectory,'OWNER-APPROVAL.json'));
  need(config.runtimeSourceSha===SOURCE&&config.planSha256===PLAN,'Static source or plan changed');
  need(hash(readFileSync(join(staticDirectory,'OWNER-APPROVAL-BODY.txt')))===approval.approvalBodySha256
    &&hash(readFileSync(join(staticDirectory,'ADMISSION-EVIDENCE.json')))===config.admissionEvidenceSha256
    &&hash(readFileSync(join(staticDirectory,'REASSESSMENT-EVIDENCE.json')))===config.reassessmentEvidenceSha256,
    'Independent evidence bytes changed');
  const carryIn=readJson(input.carryInPath);
  const attempt={...input.attempt,caseId:config.caseId,
    admissionEvidenceSha256:config.admissionEvidenceSha256,reassessmentEvidenceSha256:config.reassessmentEvidenceSha256,
    previousCaseReceiptSha256:config.previousCaseReceiptSha256};
  const builderInput={approval,planBytes,runtimeSourceSha:SOURCE,carryIn,attempt,
    mode:config.caseId==='v2-d001'?'scope-and-first-case':'next-case'};
  const result=buildEvaluationV2Admission(builderInput);
  const context={repository:'nashysaimarkets/nash-ai-markets',event:'push',
    ref:`refs/heads/monaco-scanner-evaluation-v2-run-${config.caseId}`,sourceSha:SOURCE,
    evidenceSha:attempt.evidenceSha,wrapperSha:attempt.wrapperSha,runId:attempt.runId,jobId:attempt.jobId,runAttempt:attempt.runAttempt};
  need(JSON.stringify(validateRunAdmission({config,context,planBytes,caseId:config.caseId}))===JSON.stringify(result.identity),
    'Actual hosted identity and accepted ledger builder disagree');
  need(JSON.stringify(expectedAdmissionFromConfig(config))===JSON.stringify(result.expectedAdmission),
    'Hosted and authoritative admission evidence differ');
  const pinRows=rows.map(row=>({scope_id:row.scopeId,case_id:row.caseId,source_case_id:row.sourceCaseId,slot:row.slot,
    request_id:row.requestId,fingerprint:row.fingerprint,request_sha256:row.requestSha256,
    max_output_tokens:row.maxOutputTokens,bound_microusd:row.costBoundMicroUsd}));
  const scope=P.scopeId,caseId=config.caseId,index=P.caseIds.indexOf(caseId);
  const observation=`-- Independent owner SELECT after committed installation/admission, before LOGIN/release.
-- Expected result: every checks value true; this performs no RPC or mutation.
BEGIN READ ONLY;
SET LOCAL timezone='UTC';
SET LOCAL statement_timeout='30s';
WITH s AS (SELECT * FROM private.monaco_scanner_eval_v2_scopes WHERE scope_id=${q(scope)}),
p AS (SELECT * FROM private.monaco_scanner_eval_v2_permits WHERE scope_id=${q(scope)} AND case_id=${q(caseId)}),
r AS (SELECT * FROM pg_roles WHERE rolname='monaco_ledger_runner'),
pins AS (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY case_id,slot),'[]'::jsonb) AS rows FROM private.monaco_scanner_eval_v2_pins t),
checks AS (SELECT
 current_database()='monaco_ledger' AND session_user='monaco_ledger_owner' AND current_user='monaco_ledger_owner' AS exact_owner,
 (SELECT count(*)=1 FROM s) AND (SELECT count(*)=1 FROM private.monaco_scanner_eval_v2_scopes) AS one_scope,
 coalesce((SELECT approval_document=${sqlJson(approval)} AND approval_ref=${q(approval.approvalRef)}
  AND approval_evidence_sha256=${q(approval.approvalBodySha256)} AND runtime_source_sha=${q(SOURCE)} AND plan_sha256=${q(PLAN)}
  AND app_source_sha=${q(P.appSourceSha)} AND original_history_sha256=${q(carryIn.originalHistorySha256)}
  AND original_pins_sha256=${q(P.originalPinsSha256)} AND original_held_microusd=1506400
  AND maximum_additional_microusd=1980000 AND clock_timestamp()>=approved_at AND clock_timestamp()<valid_until FROM s),false) AS exact_current_scope,
 coalesce((SELECT identity=${sqlJson(result.identity)} AND admission_evidence_sha256=${q(attempt.admissionEvidenceSha256)}
  AND reassessment_evidence_sha256=${q(attempt.reassessmentEvidenceSha256)} AND previous_case_receipt_sha256 IS NOT DISTINCT FROM ${attempt.previousCaseReceiptSha256===null?'NULL':q(attempt.previousCaseReceiptSha256)}
  AND valid_until=${q(attempt.validUntil)}::timestamptz AND clock_timestamp()<valid_until FROM p),false) AS exact_current_permit,
 (SELECT count(*)=${index+1} FROM private.monaco_scanner_eval_v2_permits) AS expected_permit_count,
 (SELECT rows=${sqlJson(pinRows)} FROM pins) AS exact_all_eighteen_new_pins,
 private.monaco_scanner_eval_v2_original_digest()=${q(carryIn.originalHistorySha256)} AS original_history_unchanged,
 NOT EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_claims WHERE scope_id=${q(scope)} AND case_id=${q(caseId)}) AS named_case_unclaimed,
 NOT EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_submissions WHERE scope_id=${q(scope)} AND case_id=${q(caseId)}) AS named_case_unsent,
 NOT EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_revocations WHERE scope_id=${q(scope)} AND target IN ('scope',${q(caseId+'-attempt-1')})) AS not_revoked,
 (SELECT count(*)=${index} FROM private.monaco_scanner_eval_v2_accounts) AND NOT EXISTS(
  SELECT 1 FROM private.monaco_scanner_eval_v2_claims c LEFT JOIN private.monaco_scanner_eval_v2_accounts a USING(scope_id,case_id) WHERE a.case_id IS NULL) AS previous_cases_accounted,
 coalesce((SELECT NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls FROM r),false) AS inactive_restricted_runner,
 NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN r ON r.oid=m.member) AS no_memberships,
 NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='monaco_ledger_runner') AS zero_runner_sessions,
 has_function_privilege('monaco_ledger_runner','public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)','EXECUTE')
  AND NOT has_schema_privilege('monaco_ledger_runner','private','USAGE') AS restricted_rpc_access
)
SELECT jsonb_build_object('observedAt',clock_timestamp(),'checks',to_jsonb(checks),
 'scope',coalesce((SELECT to_jsonb(s) FROM s),'null'::jsonb),
 'permit',coalesce((SELECT to_jsonb(p) FROM p),'null'::jsonb),
 'originalHeldMicroUsd',1506400,
 'evaluationHeldMicroUsd',(SELECT coalesce(sum(reserved_microusd),0) FROM private.monaco_scanner_eval_v2_claims),
 'actualMicroUsd',NULL,'financiallySettled',false) AS observation FROM checks;
COMMIT;
`;
  outputs={'LEDGER-CONFIG.json':json({...builderInput,planBytes:undefined,planPath}),
    'ADMISSION.sql':result.admissionSql,'ADMISSION-MANIFEST.json':json({...result,admissionSql:undefined}),
    'POST-INSTALL-OBSERVATION.sql':observation};
  summary={kind:'POCKET_SCANNER_EVALUATION_V2_NAMED_RUN_MATERIAL',caseId,identity:result.identity,
    expectedAdmission:result.expectedAdmission,admissionSqlSha256:result.admissionSqlSha256};
}
mkdirSync(out,{mode:0o700});
const files={};
for(const [name,bytes] of Object.entries(outputs)){
  writeFileSync(join(out,name),bytes,{flag:'wx',mode:0o600});files[name]=hash(bytes);
}
const receipt={...summary,preparedAt:new Date().toISOString(),executed:false,providerCalls:0,hostedDatabaseCalls:0,
  credentialsRead:0,privateKeysRead:0,files};
writeFileSync(join(out,'MATERIALIZATION.json'),json(receipt),{flag:'wx',mode:0o600});
console.log(JSON.stringify({outputDirectory:out,...receipt}));
