/** New owner-side read/activation/result variants only. Original files untouched.
 * Generated opener retains the accepted authenticated artifact parser and adds
 * independent lease evidence before any private-key read. No code here opens a key.
 */
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {HERE,EXECUTION,P,sha,need,q,jsonSql,buildRecoveryProposal} from './recovery-builder.mjs';
const readPinned=(name,h)=>{const b=readFileSync(join(EXECUTION,name));need(sha(b)===h,'Accepted operation drift: '+name);return b.toString('utf8');};
const micro=s=>{
 need(typeof s==='string','Timestamp required');
 const m=s.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/);
 need(m&&Number.isFinite(Date.parse(m[1]+m[3])),'Finite exact timestamp required');
 return BigInt(Date.parse(m[1]+m[3]))*1000n+BigInt((m[2]??'').padEnd(6,'0'));
};
function expectedLease(actual,expected){
 need(actual&&expected,'Committed independent lease required');
 const a={...actual},e={...expected};delete a.granted_at;
 for(const k of ['valid_until','pending_observed_at','ledger_observed_at']){
  need(micro(a[k])===micro(e[k]),'Lease time mismatch');delete a[k];delete e[k];
 }
 need(isDeepStrictEqual(a,e),'Committed lease differs from reviewed grant');
 need(micro(actual.granted_at)<micro(actual.valid_until)
  &&micro(actual.valid_until)-micro(actual.granted_at)<=3600000000n,'Bounded lease interval required');
}
function protocolWitness(w,proposal){
 need(w?.rpcBodySha256===proposal.rpcAfterSha256&&w.owner==='monaco_ledger_owner'&&w.securityDefiner===true
  &&isDeepStrictEqual(w.settings,['search_path=pg_catalog, private'])
  &&w.acl==='{monaco_ledger_owner=X/monaco_ledger_owner,monaco_ledger_runner=X/monaco_ledger_owner}',
  'Exact installed amended RPC required');
 need(w.helpers&&Object.keys(w.helpers).length===3,'Exactly three helper witnesses required');
 for(const [name,h] of Object.entries(proposal.manifest.helperBodies)){
  const f=w.helpers[name];need(f?.bodySha256===h&&f.owner==='monaco_ledger_owner'&&f.securityDefiner===true
   &&isDeepStrictEqual(f.settings,['search_path=pg_catalog, private','TimeZone=UTC'])
   &&f.acl==='{monaco_ledger_owner=X/monaco_ledger_owner}','Exact recovery helper body/attributes required');
 }
}
export function validateRecoveryObservation(observation,grantManifest,proposal=buildRecoveryProposal(),{terminal=false,now=Date.now()}={}){
 need(grantManifest?.kind==='POCKET_SCANNER_UNUSED_PERMIT_RECOVERY_GRANT'
  &&grantManifest.proposalSha256===proposal.proposalSha256
  &&grantManifest.installSqlSha256===sha(proposal.installSql)&&grantManifest.rpcAfterSha256===proposal.rpcAfterSha256,
  'Exact independently reviewed recovery proposal required');
 const w=observation?.executionLease,l=w?.row;
 need(observation.databaseName==='monaco_ledger'&&observation.sessionUser==='monaco_ledger_owner'
  &&observation.currentUser==='monaco_ledger_owner'&&w?.count===1&&/^[a-f0-9]{64}$/.test(w.sha256),
  'Independent owner lease observation required');
 protocolWitness(w,proposal);expectedLease(l,grantManifest.lease);
 need(l.original_permit.identity.evaluation.runId===P.run&&l.original_permit.identity.evaluation.jobId===P.job
  &&l.original_permit.identity.sourceSha===P.source&&l.original_permit.identity.planSha256===P.plan
  &&micro(observation.permit.valid_until)===micro('2026-10-24T15:50:00Z')
  &&isDeepStrictEqual(observation.permit,l.original_permit)&&isDeepStrictEqual(observation.scope,l.original_scope),
  'Original expired permit and scope must remain unchanged');
 if(!terminal){
  need(micro(observation.observedAt)<=BigInt(now)*1000n&&BigInt(now)*1000n-micro(observation.observedAt)<=900000000n
   &&w.active===true&&observation.claim===null&&observation.account===null
   &&observation.claimCount===1&&observation.accountCount===1&&observation.submissionCount===3&&observation.receiptCount===3
   &&observation.submissions?.length===0&&observation.receipts?.length===0&&observation.stops?.length===0&&observation.revocations?.length===0
   &&observation.runner?.canLogin===false&&observation.runner.sessions===0&&observation.runnerRestricted===true
   &&BigInt(now+1200000)*1000n<micro(l.valid_until),'Fresh unused committed lease must have room for bounded login');
 }else{
  need(observation.claim&&Array.isArray(observation.submissions)&&observation.submissions.length>=2,
   'Completed claimed/submitted case required for result audit');
  const start=micro(l.granted_at),end=micro(l.valid_until),scopeStart=micro(l.original_scope.approved_at),scopeEnd=micro(l.original_scope.valid_until);
  for(const t of [observation.claim.claimed_at,...observation.submissions.map(r=>r.submitted_at)]){
   const v=micro(t);need(v>=start&&v<end&&v>=scopeStart&&v<scopeEnd,'Claim/submission occurred outside the authorized lease or original scope');
  }
 }
 return {proposalSha256:proposal.proposalSha256,amendmentRef:l.amendment.approvalRef,
  amendmentBodySha256:l.amendment.approvalBodySha256,leaseSha256:w.sha256,
  originalPermitValidUntil:l.original_permit.valid_until,grantedAt:l.granted_at,leaseValidUntil:l.valid_until,
  runtimeSourceSha:P.source,rpcBeforeSha256:P.originalRpc,rpcAfterSha256:proposal.rpcAfterSha256};
}
export function validateFinalRecoveryLedger(ledger,committed,grantManifest,proposal=buildRecoveryProposal()){
 const audit=validateRecoveryObservation(ledger,grantManifest,proposal,{terminal:true});
 expectedLease(committed.executionLease?.row,grantManifest.lease);protocolWitness(committed.executionLease,proposal);
 need(isDeepStrictEqual(ledger.executionLease.row,committed.executionLease.row)
  &&ledger.executionLease.sha256===committed.executionLease.sha256,'Result lease differs from independently observed committed lease');
 return audit; // Receipt/accounting/decryption times may legitimately be later.
}

const helperQuery=`(SELECT jsonb_object_agg(f.proname,jsonb_build_object('bodySha256',encode(extensions.digest(convert_to(f.prosrc,'UTF8'),'sha256'),'hex'),
 'owner',pg_get_userbyid(f.proowner),'securityDefiner',f.prosecdef,'settings',to_jsonb(f.proconfig),'acl',f.proacl::text))
 FROM pg_proc f JOIN pg_namespace ns ON ns.oid=f.pronamespace WHERE ns.nspname='private'
 AND f.proname IN ('monaco_scanner_eval_v2_recovery_prior_matches','monaco_scanner_eval_v2_validate_unused_lease','monaco_scanner_eval_v2_unused_lease_active'))`;
function observations(){
 const original=readPinned('RECONCILE-v2-d002-40105387615.sql','7db4ce57072fea378875a978317dc9f79062d0174f12a35740d8e9722dd994e4');
 const anchor=" 'actualMicroUsd',NULL,'financiallySettled',false,";
 need(original.split(anchor).length===2,'Exact read-only query anchor required');
 const common=` 'runnerRestricted',(SELECT NOT(rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) AND NOT has_schema_privilege(r.oid,'private','USAGE')
  AND has_function_privilege(r.oid,'public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)','EXECUTE')
  FROM pg_roles r WHERE rolname='monaco_ledger_runner'),
 'recoveryPrior',jsonb_build_object(
  'permit',(SELECT to_jsonb(t) FROM private.monaco_scanner_eval_v2_permits t WHERE case_id='v2-d001'),
  'claim',(SELECT to_jsonb(t) FROM private.monaco_scanner_eval_v2_claims t WHERE case_id='v2-d001'),
  'account',(SELECT to_jsonb(t) FROM private.monaco_scanner_eval_v2_accounts t WHERE case_id='v2-d001'),
  'submissions',(SELECT jsonb_agg(to_jsonb(t) ORDER BY slot) FROM private.monaco_scanner_eval_v2_submissions t WHERE case_id='v2-d001'),
  'receipts',(SELECT jsonb_agg(to_jsonb(t) ORDER BY slot) FROM private.monaco_scanner_eval_v2_receipts t WHERE case_id='v2-d001'),
  'pins',(SELECT jsonb_agg(to_jsonb(t) ORDER BY case_id,slot) FROM private.monaco_scanner_eval_v2_pins t)),
`;
 const before=` 'recoveryInstalled',to_regclass('private.monaco_scanner_eval_v2_unused_leases') IS NOT NULL,
 'originalRpcBodySha256',(SELECT encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex') FROM pg_proc WHERE oid='public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)'::regprocedure),
`;
 const after=` 'executionLease',(SELECT jsonb_build_object('row',to_jsonb(l),'sha256',encode(extensions.digest(convert_to(to_jsonb(l)::text,'UTF8'),'sha256'),'hex'),
  'count',(SELECT count(*) FROM private.monaco_scanner_eval_v2_unused_leases),
  'active',private.monaco_scanner_eval_v2_unused_lease_active((SELECT t FROM private.monaco_scanner_eval_v2_permits t WHERE t.scope_id='${P.scope}' AND t.case_id='${P.case}')),
  'rpcBodySha256',encode(extensions.digest(convert_to(f.prosrc,'UTF8'),'sha256'),'hex'),
  'owner',pg_get_userbyid(f.proowner),'securityDefiner',f.prosecdef,'settings',to_jsonb(f.proconfig),'acl',f.proacl::text,
  'helpers',${helperQuery}) FROM private.monaco_scanner_eval_v2_unused_leases l,pg_proc f
  WHERE l.scope_id='${P.scope}' AND l.case_id='${P.case}' AND f.oid='public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)'::regprocedure),
`;
 return {before:original.replace(anchor,common+before+anchor),after:original.replace(anchor,common+after+anchor)};
}
export function buildRecoveryActivation({grantManifestPath,postLeaseObservationPath,now=Date.now()}){
 const grant=JSON.parse(readFileSync(grantManifestPath,'utf8')),post=JSON.parse(readFileSync(postLeaseObservationPath,'utf8')),
  proposal=buildRecoveryProposal();
 validateRecoveryObservation(post,grant,proposal,{now});
 const l=post.executionLease.row;
 let sql=readPinned('ACTIVATE-v2-d002-40105387615.sql','a39ad1adfd0714cfdcb3e3f3632ce9c4ac75cf0494ac35b8f008e8159630acf2');
 sql=sql.replace('DECLARE\n','DECLARE\n l private.monaco_scanner_eval_v2_unused_leases%rowtype;\n');
 const old=" observed_now:=clock_timestamp();";
 need(sql.split(old).length===2,'Exact activation time anchor required');
 const guard=` SELECT * INTO STRICT l FROM private.monaco_scanner_eval_v2_unused_leases WHERE scope_id=s.scope_id AND case_id=p.case_id;
 IF l IS DISTINCT FROM jsonb_populate_record(NULL::private.monaco_scanner_eval_v2_unused_leases,${jsonSql(l)})
  OR NOT coalesce(private.monaco_scanner_eval_v2_unused_lease_active(p),false)
  OR (SELECT encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex') FROM pg_proc WHERE oid='public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)'::regprocedure) IS DISTINCT FROM ${q(proposal.rpcAfterSha256)}
  OR ${helperQuery} IS DISTINCT FROM ${jsonSql(post.executionLease.helpers)}
  THEN RAISE EXCEPTION 'Exact committed independently observed recovery lease and amended protocol required'; END IF;
`;
 sql=sql.replace(old,guard+old);
 const deadline='OR login_deadline>=s.valid_until OR login_deadline>=p.valid_until';
 need(sql.split(deadline).length===2,'Exact original login expiry bound required');
 sql=sql.replace(deadline,'OR login_deadline>=s.valid_until OR login_deadline>=l.valid_until OR observed_now<l.granted_at');
 return `-- NEW RECOVERY VARIANT. Original permit deadline remains 15:50; never updated.\n-- Proposal ${proposal.proposalSha256}; amendment ${l.amendment.approvalRef}; lease ${post.executionLease.sha256}.\n-- Committed observation bytes SHA256 ${sha(readFileSync(postLeaseObservationPath))}.\n`+sql;
}
export function prepareOperationalVariants(proposal=buildRecoveryProposal()){
 const o=observations();
 let opener=readPinned('ROOT-ONLY-DECRYPT-v2-d002.mjs','ae22066903fbb8dd9d9caf8f67c672f8c66aa9a57a3f28c7078146312c4f7169');
 opener=opener.replace("const HERE=dirname(fileURLToPath(import.meta.url));",`const HERE=resolve(process.env.POCKET_RECOVERY_EXECUTION_ROOT??resolve(dirname(fileURLToPath(import.meta.url)),'../..'));\nconst RECOVERY=resolve(process.env.POCKET_RECOVERY_SOURCE_ROOT??resolve(dirname(fileURLToPath(import.meta.url)),'..'));`);
 opener=opener.replace("const REPO=resolve(HERE,'../scanner-evaluation-v2');","const REPO=resolve(process.env.POCKET_RECOVERY_ACCEPTED_ROOT??resolve(HERE,'../scanner-evaluation-v2'));");
 opener=opener.replace("const previousLedgerPath=resolve(HERE,'../private-six/results/v2-run40095819408/LEDGER.json');","const previousLedgerPath=resolve(process.env.POCKET_RECOVERY_PRIOR_LEDGER_PATH??resolve(HERE,'../private-six/results/v2-run40095819408/LEDGER.json'));");
 const argv='const [ledgerPath,artifactDirectory,keyPath,outDirectory,...extra]=process.argv.slice(2);';
 need(opener.includes(argv),'Exact opener argv anchor required');
 opener=opener.replace(argv,'const [ledgerPath,artifactDirectory,keyPath,outDirectory,grantManifestPath,committedLeasePath,...extra]=process.argv.slice(2);');
 opener=opener.replace('need(ledgerPath&&artifactDirectory&&keyPath&&outDirectory&&!extra.length);',
  'need(ledgerPath&&artifactDirectory&&keyPath&&outDirectory&&grantManifestPath&&committedLeasePath&&!extra.length);');
 const ledger='const ledger=jsonFile(resolve(ledgerPath));';need(opener.includes(ledger),'Exact key-before-ledger anchor required');
 opener=opener.replace(ledger,ledger+`\n  stage='RECOVERY_SOURCE_PREIMAGE';\n  for(const [file,digest] of Object.entries(${JSON.stringify(proposal.manifest.files)}))need(hash(bytes(join(RECOVERY,file)))===digest);\n  stage='RECOVERY_LEASE_AUDIT';\n  const {validateFinalRecoveryLedger}=await import(pathToFileURL(join(RECOVERY,'recovery-operations.mjs')));\n  const recoveryAudit=validateFinalRecoveryLedger(ledger,jsonFile(resolve(committedLeasePath)),jsonFile(resolve(grantManifestPath)));`);
 // Included in both the retained sanitized summary and console metadata without exposing bodies.
 const summary='const summary=';
 need(opener.includes(summary),'Accepted summary anchor missing');
 opener=opener.replace(summary,'const summary=');
 const jsonStart=opener.indexOf('{',opener.indexOf(summary)+summary.length);
 opener=opener.slice(0,jsonStart+1)+'\n    recoveryProtocol:recoveryAudit,'+opener.slice(jsonStart+1);
 opener=`/** NEW RECOVERY ROOT-ONLY VARIANT. Requires GRANT-MANIFEST.json and independently observed POST-LEASE.json as last two arguments. No key is read before lease/source/interval checks. */\n`+opener;
 return {'PRE-GRANT-OBSERVATION.sql':o.before,'POST-LEASE-OBSERVATION.sql':o.after,
  'RECONCILE-RECOVERED-v2-d002.sql':o.after,'ROOT-ONLY-DECRYPT-RECOVERED-v2-d002.mjs':opener,
  'OWNER-DECISION.HOLD.json':JSON.stringify({decision:'HOLD',requestText:null,ownerResponseText:null,recordedAt:null},null,2)+'\n',
  'GRANT-INPUTS.HOLD.json':JSON.stringify({ownerComment:null,ownerDecision:null,independentReview:null,pendingEvidence:null,carryIn:null,validUntil:null},null,2)+'\n'};
}
