/** Offline only. No network, DB client, credentials, dispatch or activation.
 * A new externally observed owner amendment is mandatory for grant material.
 * The proposal hash excludes future owner/fresh-observation/grant bytes.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {prepareOperationalVariants,buildRecoveryActivation} from './recovery-operations.mjs';
export const HERE=dirname(fileURLToPath(import.meta.url));
export const EXECUTION=resolve(process.env.POCKET_RECOVERY_EXECUTION_ROOT??resolve(HERE,'..'));
export const ACCEPTED=resolve(process.env.POCKET_RECOVERY_ACCEPTED_ROOT??resolve(HERE,'../../scanner-evaluation-v2'));
export const sha=x=>createHash('sha256').update(x).digest('hex');
export const need=(v,message)=>{if(!v)throw Error(message);};
export const q=v=>{need(typeof v==='string'&&!v.includes('\0'),'SQL string required');return "'"+v.replaceAll("'","''")+"'";};
export const jsonSql=v=>q(JSON.stringify(v))+'::jsonb';
export const P=Object.freeze({scope:'pocket-scanner-evaluation-v2-20261024',case:'v2-d002',attempt:'v2-d002-attempt-1',
 run:'40105387615',job:'120905891814',wrapper:'b7f2927f2c9438b18a9ce042904259a4acd11323',
 evidence:'778a47fce8405dca6b22f14a3c7b55e858f5e71e',source:'20783ed5e8eb95a11df86b0d60766ffcbbf4fa79',
 plan:'cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109',
 originalRpc:'00fd1d5ef2f81cc022c31f6160ca7022bef794513bec4ef8efbe66e98a0feb87',
 originalHistory:'4031aa388eecdac651a539a1af5ed861f0edc1944c748917001ba6546e4c2e64',
 previousReceipt:'58b6efba5a71217e7a2f06c9c95362f79dfea50da4033e589245378717438447',
 oldRef:'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029'});
const forbidden=['6165012632','6309459418','6383327587','6383999765','6384333029'];
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const canonicalSha=v=>sha(JSON.stringify(canonical(v)));
const parse=b=>{need(b instanceof Uint8Array,'Exact retained JSON bytes required');return JSON.parse(Buffer.from(b).toString('utf8'));};
const fresh=(s,now)=>date(s)&&Date.parse(s)<=now&&now-Date.parse(s)<=900000;
function pinned(path,digest){const b=readFileSync(path);need(sha(b)===digest,'Accepted input drift: '+path);return b;}
export function boundInputs(){
 const original=JSON.parse(pinned(join(EXECUTION,'d002-preparation/POST-PERMIT-OBSERVATION.json'),
  'a781dcb5c946530a5e51d9c908904fdf7ba08bdbdbeca5b5b1608f969abd803d'));
 const previous=JSON.parse(pinned(resolve(process.env.POCKET_RECOVERY_PRIOR_LEDGER_PATH??resolve(EXECUTION,'../private-six/results/v2-run40095819408/LEDGER.json')),
  'a3bbcc57ae067146df915209794d28c859902813a434c5438c2eed269860b9dd'));
 const plan=JSON.parse(pinned(join(ACCEPTED,'docs/monaco-126/scanner-evaluation-v2-2026-10-24/PLAN.json'),P.plan));
 const pins=plan.cases.flatMap(c=>c.calls.map(r=>({scope_id:P.scope,case_id:c.caseId,source_case_id:c.sourceCaseId,
  slot:r.slot,request_id:r.requestId,fingerprint:r.fingerprint,request_sha256:r.requestSha256,
  max_output_tokens:r.maxOutputTokens,bound_microusd:r.costBoundMicroUsd})))
  .sort((a,b)=>(a.case_id+':'+a.slot).localeCompare(b.case_id+':'+b.slot));
 const prior={permit:previous.permit,claim:previous.claim,account:previous.account,
  submissions:previous.submissions,receipts:previous.receipts,pins};
 need(original.permit.identity.evaluation.runId===P.run&&original.permit.identity.evaluation.jobId===P.job
  &&original.permit.identity.sourceSha===P.source&&original.permit.identity.planSha256===P.plan
  &&original.permit.valid_until==='2026-10-24T15:50:00+00:00'
  &&original.permit.previous_case_receipt_sha256===P.previousReceipt,'Exact expired original identity required');
 return {scope:original.scope,permit:original.permit,prior};
}

export function buildRecoveryProposal({acceptedRoot=ACCEPTED,installedObservation}={}){
 const migration=readFileSync(join(acceptedRoot,'database/neon/proposed/20261024-scanner-evaluation-v2.sql'),'utf8');
 const start=migration.indexOf('CREATE FUNCTION public.monaco_scanner_evaluation_v2_rpc(');
 need(start>=0,'Original RPC definition missing');
 const end=migration.indexOf('END $$;',start)+7;
 need(end>start,'Original RPC terminator missing');
 const definition=migration.slice(start,end),body=definition.slice(definition.indexOf(' AS $$')+6,-3);
 const observation=installedObservation??JSON.parse(readFileSync(join(EXECUTION,'d002-preparation/INSTALLED-ORIGINAL-RPC-OBSERVATION.json'),'utf8'));
 need(sha(body)===P.originalRpc&&observation.body===body&&observation.body_sha256===P.originalRpc
  &&observation.owner==='monaco_ledger_owner'&&observation.security_definer===true
  &&isDeepStrictEqual(observation.settings,['search_path=pg_catalog, private'])
  &&observation.acl==='{monaco_ledger_owner=X/monaco_ledger_owner,monaco_ledger_runner=X/monaco_ledger_owner}',
  'Accepted and independently observed original RPC preimage/attributes must match');
 const old="p.valid_until<=clock_timestamp() THEN 'expired'";
 const replacement="(p.valid_until<=clock_timestamp() AND NOT coalesce(private.monaco_scanner_eval_v2_unused_lease_active(p),false)) THEN 'expired'";
 need(body.split(old).length===2,'Only the exact per-permit expiry predicate may change');
 const rpcAfter=body.replace(old,replacement),rpcAfterSha256=sha(rpcAfter);
 need(rpcAfter.replace(replacement,old)===body,'Unintended RPC change');
 const amended=definition.replace('CREATE FUNCTION ','CREATE OR REPLACE FUNCTION ').replace(old,replacement);
 const post=`DO $post_rpc$\nDECLARE f pg_proc%rowtype;\nBEGIN\n SELECT * INTO STRICT f FROM pg_proc WHERE oid='public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)'::regprocedure;\n IF encode(extensions.digest(convert_to(f.prosrc,'UTF8'),'sha256'),'hex')<>${q(rpcAfterSha256)}\n  OR pg_get_userbyid(f.proowner)<>'monaco_ledger_owner' OR NOT f.prosecdef\n  OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, private']::text[]\n  OR f.proacl::text IS DISTINCT FROM '{monaco_ledger_owner=X/monaco_ledger_owner,monaco_ledger_runner=X/monaco_ledger_owner}'\n THEN RAISE EXCEPTION 'Amended RPC body/attributes differ'; END IF;\nEND $post_rpc$;\n`;
 const installSql=readFileSync(join(HERE,'lease-schema.sql'),'utf8')+'\n'+amended+'\n'+post;
 const sourceFiles=['lease-schema.sql','recovery-builder.mjs','recovery-operations.mjs'];
 const files=Object.fromEntries(sourceFiles.map(f=>[f,sha(readFileSync(join(HERE,f)))]));
 const schema=readFileSync(join(HERE,'lease-schema.sql'),'utf8');
 const helperBodies=Object.fromEntries([...schema.matchAll(/CREATE FUNCTION private\.(monaco_scanner_eval_v2_[a-z_]+)\([^]*? AS \$\$([^]*?)\$\$;/g)].map(m=>[m[1],sha(m[2])]));
 need(Object.keys(helperBodies).length===3,'All three new helpers must be pinned');
 const manifest={kind:'POCKET_SCANNER_UNUSED_PERMIT_RECOVERY_PROPOSAL',status:'OFFLINE_UNAPPROVED',
  scopeId:P.scope,caseId:P.case,attemptId:P.attempt,runId:P.run,jobId:P.job,runAttempt:'1',runtimeSourceSha:P.source,
  wrapperSha:P.wrapper,planSha256:P.plan,originalPermitValidUntil:'2026-10-24T15:50:00.000Z',
  files,helperBodies,originalRpcBodySha256:P.originalRpc,amendedRpcBodySha256:rpcAfterSha256,installSqlSha256:sha(installSql),
  maximumLeases:1,maximumLeaseSeconds:3600,maximumLoginSeconds:1200,retries:0,
  originalRowsAndTriggersUnchanged:true,productionRuntimeUnchanged:true,additionalBudgetMicroUsd:0};
 return {installSql,rpcBefore:body,rpcAfter,rpcBeforeSha256:P.originalRpc,rpcAfterSha256,
  manifest,proposalSha256:canonicalSha(manifest),diff:`--- accepted RPC expiry\n+++ proposed RPC expiry\n-${old}\n+${replacement}\n`};
}

function validatePending(x,now,approvedAt){
 const r=x?.run,j=x?.jobs?.jobs,e=x?.environments;
 need(fresh(x?.observedAt,now)&&Date.parse(x.observedAt)>=approvedAt,'Fresh post-amendment official pending evidence required');
 need(String(r?.id)===P.run&&r.head_sha===P.wrapper&&r.head_branch==='monaco-scanner-evaluation-v2-run-v2-d002'
  &&r.event==='push'&&r.run_attempt===1&&r.status==='waiting'&&r.conclusion===null
  &&r.path==='.github/workflows/pocket-scanner-evaluation-v2-run.yml'
  &&r.repository?.full_name==='nashysaimarkets/nash-ai-markets'
  &&x.jobs.total_count===1&&Array.isArray(j)&&j.length===1&&String(j[0].id)===P.job&&String(j[0].run_id)===P.run
  &&j[0].run_attempt===1&&j[0].head_sha===P.wrapper&&j[0].status==='waiting'&&j[0].conclusion===null
  &&j[0].name==='Pocket scanner evaluation v2'&&Array.isArray(j[0].steps)&&j[0].steps.length===0
  &&Array.isArray(e)&&e.length===1&&e[0].environment?.id===24916350021
  &&e[0].environment.name==='monaco-first-six-inference'
  &&e[0].reviewers?.some(v=>v.type==='User'&&v.reviewer?.login==='nashysaimarkets'),
  'Exact existing unstarted protected run/job/owner gate required');
}
export function ownerApprovalPrompt(proposalSha256){
 need(digest(proposalSha256),'Frozen proposal digest required');
 return `Do you approve the reviewed protocol amendment proposal-sha256: ${proposalSha256} for v2-d002 / run 40105387615 / job 120905891814 / attempt 1? This authorizes one non-renewable execution lease of at most 60 minutes, within the existing scope ending 2026-10-25T12:40:25Z, and one login window of at most 20 minutes inside that lease. The expired original permit and prior history remain unchanged. The same runtime, app, credentials, case cost bound and existing total budget remain in force, with no retry or new attempt. Reply Yes to approve this amendment.`;
}
export function ownerAmendmentBody({proposalSha256,approvalRequestSha256,ownerResponseSha256}){
 need([proposalSha256,approvalRequestSha256,ownerResponseSha256].every(digest),'Bound approval hashes required');
 return `APPROVED OWNER AMENDMENT: POCKET_SCANNER_UNUSED_PERMIT_RECOVERY_V1\ndecision: APPROVED\napproval-request-sha256: ${approvalRequestSha256}\nowner-response-sha256: ${ownerResponseSha256}\nproposal-sha256: ${proposalSha256}\ntarget: v2-d002 / run 40105387615 / job 120905891814 / attempt 1\nOne non-renewable lease of at most 60 minutes, inside the unchanged original scope; login at most 20 minutes inside that lease.\nThe expired original permit and all prior history remain unchanged. No retry, new attempt, new keys, added budget, or changed runtime.`;
}
export function buildRecoveryGrant({ownerCommentBytes,ownerDecisionBytes,reviewEvidenceBytes,pendingEvidenceBytes,carryInBytes,validUntil,now=Date.now()},proposal=buildRecoveryProposal()){
 const {scope,permit,prior}=boundInputs();
 const comment=parse(ownerCommentBytes),decision=parse(ownerDecisionBytes),review=parse(reviewEvidenceBytes),pending=parse(pendingEvidenceBytes),carry=parse(carryInBytes);
 const ref=comment.html_url,approvedAt=Date.parse(comment.created_at);
 need(decision.decision==='APPROVED'&&decision.requestText===ownerApprovalPrompt(proposal.proposalSha256)
  &&typeof decision.ownerResponseText==='string'&&/^\s*(yes|yea|yeah)[!.\s]*$/i.test(decision.ownerResponseText)
  &&date(decision.recordedAt)&&Date.parse(decision.recordedAt)<=approvedAt&&Date.parse(decision.recordedAt)>=Date.parse(permit.valid_until)
  &&isDeepStrictEqual(Object.keys(decision).sort(),['decision','requestText','ownerResponseText','recordedAt'].sort()),
  'Current affirmative owner response to the exact rendered amendment request must be retained');
 const decisionPins={proposalSha256:proposal.proposalSha256,approvalRequestSha256:sha(decision.requestText),ownerResponseSha256:sha(decision.ownerResponseText)};
 need(typeof ref==='string'&&/^https:\/\/github\.com\/nashysaimarkets\/nash-ai-markets\/issues\/126#issuecomment-[1-9][0-9]{8,19}$/.test(ref)
  &&!forbidden.some(id=>ref.endsWith('#issuecomment-'+id))&&String(comment.id)===ref.split('issuecomment-')[1]
  &&comment.user?.login==='nashysaimarkets'&&typeof comment.body==='string'
  &&comment.body===ownerAmendmentBody(decisionPins)
  &&date(comment.created_at)&&approvedAt<=now&&approvedAt>=Date.parse(permit.valid_until),
  'New separately retained official owner amendment for this exact proposal required; HOLD is not authority');
 need(review.decision==='ACCEPTED'&&review.proposalSha256===proposal.proposalSha256
  &&review.installSqlSha256===sha(proposal.installSql)&&review.rpcAfterSha256===proposal.rpcAfterSha256,
  'Independent exact-source protocol review required');
 validatePending(pending,now,approvedAt);
 need(fresh(carry.observedAt,now)&&Date.parse(carry.observedAt)>=approvedAt
  &&carry.databaseName==='monaco_ledger'&&carry.sessionUser==='monaco_ledger_owner'&&carry.currentUser==='monaco_ledger_owner'
  &&isDeepStrictEqual(carry.scope,scope)&&isDeepStrictEqual(carry.permit,permit)
  &&isDeepStrictEqual(carry.recoveryPrior,prior)&&carry.originalHistorySha256===P.originalHistory
  &&carry.scopeCount===1&&carry.permitCount===2&&carry.claimCount===1&&carry.accountCount===1
  &&carry.submissionCount===3&&carry.receiptCount===3&&carry.stopCount===0
  &&carry.claim===null&&carry.account===null&&carry.submissions?.length===0&&carry.receipts?.length===0&&carry.revocations?.length===0
  &&carry.evaluationHeldMicroUsd===330000&&carry.originalHeldMicroUsd===1506400&&carry.aggregateCapMicroUsd===5000000
  &&carry.unreceiptedSubmissionCount===0&&carry.unaccountedClaimCount===0
  &&carry.runner?.canLogin===false&&carry.runner.sessions===0&&carry.runnerRestricted===true
  &&carry.recoveryInstalled===false&&carry.originalRpcBodySha256===P.originalRpc,
  'Fresh exact unclaimed/unsent inactive ledger and immutable old witnesses required');
 const end=Date.parse(validUntil);
 need(date(validUntil)&&end>now+1200000&&end<=now+3600000&&end<=Date.parse(scope.valid_until),
  'One fresh lease of at most 60 minutes with room for the separate 20-minute login required');
 const owner={url:ref,author:comment.user.login,body:comment.body,createdAt:comment.created_at};
 const amendment={kind:'POCKET_SCANNER_EVALUATION_V2_UNUSED_PERMIT_RECOVERY_AMENDMENT',approvedBy:'OWNER',approvalRef:ref,
  approvalBodySha256:sha(comment.body),approvedAt:comment.created_at,proposalSha256:proposal.proposalSha256,
  approvalRequestSha256:decisionPins.approvalRequestSha256,ownerResponseSha256:decisionPins.ownerResponseSha256,
  targetIdentity:permit.identity,originalPermit:permit,originalScope:scope,previousCaseReceiptSha256:P.previousReceipt,
  maximumLeases:1,maximumLeaseSeconds:3600,maximumLoginSeconds:1200,retries:0,caseBoundMicroUsd:330000,aggregateCapMicroUsd:5000000};
 const lease={scope_id:P.scope,case_id:P.case,attempt_id:P.attempt,original_scope:scope,original_permit:permit,
  prior_evidence:prior,original_history_sha256:P.originalHistory,amendment,owner_comment:owner,owner_decision:decision,
  proposal_sha256:proposal.proposalSha256,review_evidence_sha256:sha(reviewEvidenceBytes),
  pending_evidence_sha256:sha(pendingEvidenceBytes),pending_observed_at:pending.observedAt,
  ledger_evidence_sha256:sha(carryInBytes),ledger_observed_at:carry.observedAt,valid_until:validUntil};
 const columns=Object.keys(lease),values=Object.values(lease).map(v=>typeof v==='object'?jsonSql(v):q(v));
 const grantSql=`INSERT INTO private.monaco_scanner_eval_v2_unused_leases(${columns.join(',')}) VALUES(${values.join(',')});\n`;
 const combinedSql=`-- NEW PROTOCOL AMENDMENT; requires independent owner review before execution.\nBEGIN;\nSET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; SET LOCAL timezone='UTC';\nSELECT set_config('monaco.unused_lease_amendment',${q(JSON.stringify(amendment))},true);\nSELECT set_config('monaco.unused_lease_proposal_sha256',${q(proposal.proposalSha256)},true);\n${proposal.installSql}\n${grantSql}COMMIT;\n`;
 const manifest={kind:'POCKET_SCANNER_UNUSED_PERMIT_RECOVERY_GRANT',status:'PREPARED_REQUIRES_INDEPENDENT_REVIEW',
  proposalSha256:proposal.proposalSha256,installSqlSha256:sha(proposal.installSql),rpcBeforeSha256:P.originalRpc,rpcAfterSha256:proposal.rpcAfterSha256,
  lease,ownerCommentSha256:sha(ownerCommentBytes),ownerDecisionSha256:sha(ownerDecisionBytes),reviewEvidenceSha256:sha(reviewEvidenceBytes),
  pendingEvidenceSha256:sha(pendingEvidenceBytes),carryInSha256:sha(carryInBytes),combinedSqlSha256:sha(combinedSql),
  grantedAt:'DATABASE_ASSIGNED_ON_INSERT',activation:'HOLD_UNTIL_COMMITTED_LEASE_INDEPENDENTLY_OBSERVED'};
 return {combinedSql,grantSql,manifest};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,input,out,...extra]=process.argv.slice(2);need(!extra.length,'Unexpected arguments');
 if(mode==='proposal'&&input&&!out){
  const p=buildRecoveryProposal(),ops=prepareOperationalVariants(p);mkdirSync(input,{recursive:false});
  for(const [name,value] of Object.entries({'INSTALL-PROPOSAL.sql':p.installSql,'RPC-CHANGE.diff':p.diff,
   'PROPOSAL-MANIFEST.json':JSON.stringify({...p.manifest,proposalSha256:p.proposalSha256},null,2)+'\n',...ops}))writeFileSync(join(input,name),value,{flag:'wx'});
  console.log(JSON.stringify({status:'OFFLINE_UNAPPROVED',proposalSha256:p.proposalSha256,output:resolve(input)}));
 }else if(mode==='grant'&&input&&out){
  const c=JSON.parse(readFileSync(input,'utf8')),bytes=k=>readFileSync(resolve(dirname(input),c[k]));
  const r=buildRecoveryGrant({ownerCommentBytes:bytes('ownerComment'),ownerDecisionBytes:bytes('ownerDecision'),reviewEvidenceBytes:bytes('independentReview'),
   pendingEvidenceBytes:bytes('pendingEvidence'),carryInBytes:bytes('carryIn'),validUntil:c.validUntil});
  mkdirSync(out,{recursive:false});writeFileSync(join(out,'INSTALL-AND-GRANT.sql'),r.combinedSql,{flag:'wx'});
  writeFileSync(join(out,'GRANT-MANIFEST.json'),JSON.stringify(r.manifest,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({status:r.manifest.status,combinedSqlSha256:r.manifest.combinedSqlSha256,output:resolve(out)}));
 }else if(mode==='activation'&&input&&out){
  const c=JSON.parse(readFileSync(input,'utf8')),r=buildRecoveryActivation(c);
  writeFileSync(out,r,{flag:'wx'});console.log(JSON.stringify({status:'PREPARED_REQUIRES_INDEPENDENT_REVIEW',sha256:sha(r)}));
 }else throw Error('Usage: recovery-builder.mjs proposal NEW_DIR | grant INPUT_PATHS.json NEW_DIR | activation INPUT_PATHS.json NEW_SQL');
}
