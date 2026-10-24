/** ROOT ONLY. Do not invoke until official terminal metadata and independent
 * ledger JSON from RECONCILE-v2-d002-40105387615.sql have been retained.
 * Prior accounted d001 rows must still match their immutable owner observation.
 * No network. Raw/key contents never printed.
 * Usage: node ROOT-ONLY-DECRYPT-v2-d002.mjs LEDGER.json ARTIFACT_DIR PRIVATE_KEY.pem NEW_PRIVATE_OUT
 * ARTIFACT_DIR: OFFICIAL-RUN.json, OFFICIAL-JOBS.json, OFFICIAL-ARTIFACTS.json,
 * and each exact encrypted output archive named {numericArtifactId}.zip.
 */
import {readFileSync,writeFileSync,mkdirSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {execFileSync} from 'node:child_process';

const HERE=dirname(fileURLToPath(import.meta.url));
const REPO=resolve(HERE,'../scanner-evaluation-v2');
const DOCS='docs/monaco-126/scanner-evaluation-v2-2026-10-24';
const SOURCE='20783ed5e8eb95a11df86b0d60766ffcbbf4fa79';
const WRAPPER='b7f2927f2c9438b18a9ce042904259a4acd11323';
const EVIDENCE='778a47fce8405dca6b22f14a3c7b55e858f5e71e';
const PLAN='cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109';
const RECIPIENT='ee6a572a222e2f9f97df38f4d082935c582909095b720070a0399ee31a1773da';
const RUN='40105387615',JOB='120905891814',CASE='v2-d002',SCOPE='pocket-scanner-evaluation-v2-20261024';
const PREVIOUS_RECEIPT='58b6efba5a71217e7a2f06c9c95362f79dfea50da4033e589245378717438447';
const PREVIOUS_LEDGER_SHA='a3bbcc57ae067146df915209794d28c859902813a434c5438c2eed269860b9dd';
const MAX=96*1024*1024;
const hash=x=>createHash('sha256').update(x).digest('hex');
const need=ok=>{if(!ok)throw Error('REFUSED');};
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(x);
const number=x=>Number.isSafeInteger(x)&&x>=0;
function bytes(path,maximum=MAX){
  const st=lstatSync(path);need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=maximum);
  const value=readFileSync(path);need(value.length===st.size);return value;
}
const jsonFile=path=>JSON.parse(bytes(path,8*1024*1024).toString('utf8'));
const zipProgram=String.raw`
import io,sys,zipfile,stat
data=sys.stdin.buffer.read(100663297)
if not data or len(data)>100663296: raise ValueError('archive')
with zipfile.ZipFile(io.BytesIO(data)) as z:
 rows=z.infolist()
 if len(rows)!=1: raise ValueError('entries')
 r=rows[0]
 if r.filename!='record.encrypted.json' or r.is_dir() or r.flag_bits&1: raise ValueError('entry')
 if stat.S_IFMT(r.external_attr>>16) not in (0,stat.S_IFREG): raise ValueError('type')
 if not 0<r.file_size<=100663296 or not 0<r.compress_size<=100663296: raise ValueError('size')
 raw=z.read(r)
 if len(raw)!=r.file_size: raise ValueError('length')
 sys.stdout.buffer.write(raw)
`;
let stage='INPUTS',keyBytes;
const plaintext=[];
try{
  const [ledgerPath,artifactDirectory,keyPath,outDirectory,...extra]=process.argv.slice(2);
  need(ledgerPath&&artifactDirectory&&keyPath&&outDirectory&&!extra.length);
  const art=resolve(artifactDirectory),out=resolve(outDirectory);
  need(lstatSync(art).isDirectory()&&!lstatSync(art).isSymbolicLink());
  need(realpathSync(art)===art);
  const sourceIdentity=jsonFile(join(REPO,DOCS,'SOURCE-IDENTITY.json'));
  need(sourceIdentity.testedSourceSha===SOURCE);
  for(const [file,digest] of Object.entries(sourceIdentity.files))need(hash(bytes(join(REPO,file)))===digest);
  const manifest=jsonFile(join(HERE,'permit-v2-d002/ADMISSION-MANIFEST.json'));
  const acceptedConfig=jsonFile(join(HERE,'permit-v2-d002/LEDGER-CONFIG.json'));
  need(hash(bytes(join(HERE,'permit-v2-d002/ADMISSION-MANIFEST.json')))==='c7e8f64d7c5af02c9ade369628362d6b6d020e7632e7dde89505eba816c4ec0f');
  need(hash(bytes(join(HERE,'permit-v2-d002/LEDGER-CONFIG.json')))==='789f4c6a6f4913cd7ae9e171c74234f9c8aa8f836e2f212cf12b8246545694b0');
  const identity=manifest.identity,e=identity.evaluation;
  need(identity.sourceSha===SOURCE&&identity.planSha256===PLAN&&e.wrapperSha===WRAPPER&&e.evidenceSha===EVIDENCE
    &&e.runId===RUN&&e.jobId===JOB&&e.runAttempt==='1'&&e.scopeId===SCOPE&&e.caseId===CASE&&e.sourceCaseId==='d002');
  const planBytes=bytes(join(REPO,DOCS,'PLAN.json'));need(hash(planBytes)===PLAN);
  const plan=JSON.parse(planBytes),selected=plan.cases.filter(c=>c.caseId===CASE);need(selected.length===1);
  const pins=selected[0].calls;
  const {openEvaluationArtifact}=await import(pathToFileURL(join(REPO,'scripts/pocket-scanner-evaluation-v2-effects.mjs')));
  const ledger=jsonFile(resolve(ledgerPath));
  const previousLedgerPath=resolve(HERE,'../private-six/results/v2-run40095819408/LEDGER.json');
  need(hash(bytes(previousLedgerPath))===PREVIOUS_LEDGER_SHA);
  const previousLedger=jsonFile(previousLedgerPath);
  stage='LEDGER';
  need(ledger.kind==='POCKET_SCANNER_EVALUATION_V2_INDEPENDENT_LEDGER_RECONCILIATION'
    &&ledger.databaseName==='monaco_ledger'&&ledger.sessionUser==='monaco_ledger_owner'&&ledger.currentUser==='monaco_ledger_owner'
    &&isDeepStrictEqual(ledger.permit?.identity,identity)&&isDeepStrictEqual(ledger.scope?.approval_document,acceptedConfig.approval)
    &&ledger.scope.approval_ref===manifest.expectedAdmission.approvalRef
    &&ledger.scope.approval_evidence_sha256===manifest.expectedAdmission.approvalBodySha256
    &&ledger.scope.runtime_source_sha===SOURCE&&ledger.scope.plan_sha256===PLAN
    &&ledger.permit.admission_evidence_sha256===manifest.expectedAdmission.admissionEvidenceSha256
    &&ledger.permit.reassessment_evidence_sha256===manifest.expectedAdmission.reassessmentEvidenceSha256
    &&ledger.permit.previous_case_receipt_sha256===PREVIOUS_RECEIPT
    &&Date.parse(ledger.permit.valid_until)===Date.parse(acceptedConfig.attempt.validUntil)
    &&ledger.originalHistorySha256==='4031aa388eecdac651a539a1af5ed861f0edc1944c748917001ba6546e4c2e64'
    &&ledger.scope.original_history_sha256===ledger.originalHistorySha256
    &&ledger.originalHeldMicroUsd===1506400&&ledger.evaluationHeldMicroUsd===660000&&ledger.aggregateCapMicroUsd===5000000
    &&ledger.scopeCount===1&&ledger.permitCount===2&&ledger.claimCount===2&&ledger.accountCount===2
    &&ledger.actualMicroUsd===null&&ledger.financiallySettled===false);
  need(ledger.previousCase?.caseId==='v2-d001'&&ledger.previousCase.computedReceiptSha256===PREVIOUS_RECEIPT
    &&previousLedger.account.receipt_sha256===PREVIOUS_RECEIPT&&previousLedger.computedReceiptSha256===PREVIOUS_RECEIPT
    &&ledger.unreceiptedSubmissionCount===0&&ledger.unaccountedClaimCount===0&&ledger.stopCount===0);
  for(const key of ['permit','claim','account','submissions','receipts','stops','revocations'])
    need(isDeepStrictEqual(ledger.previousCase[key],previousLedger[key]));
  const boundRow=row=>row?.scope_id===SCOPE&&row.case_id===CASE;
  need(boundRow(ledger.claim)&&ledger.claim.attempt_id===e.attemptId&&ledger.claim.reserved_microusd===330000
    &&boundRow(ledger.account)&&ledger.account.reserved_microusd===330000
    &&hex(ledger.computedReceiptSha256)&&ledger.account.receipt_sha256===ledger.computedReceiptSha256
    &&hex(ledger.account.diagnostic_sha256)&&/^[1-9][0-9]{0,19}$/.test(ledger.account.diagnostic_artifact_id)
    &&Array.isArray(ledger.stops)&&ledger.stops.length===0&&Array.isArray(ledger.revocations)&&ledger.revocations.length===0
    &&Array.isArray(ledger.receipts)&&[2,3].includes(ledger.receipts.length)
    &&Array.isArray(ledger.submissions)&&ledger.submissions.length===ledger.receipts.length);
  const receiptSlots=ledger.receipts.map(r=>r.slot);
  need(new Set(receiptSlots).size===receiptSlots.length&&receiptSlots.includes('main')&&receiptSlots.includes('primary_precision')
    &&receiptSlots.every(s=>['main','primary_precision','rescue_precision'].includes(s))
    &&ledger.account.unused_rescue_voided===!receiptSlots.includes('rescue_precision'));
  const providerIds=new Set(),responseIds=new Set();
  for(const r of ledger.receipts){
    const pin=pins.find(p=>p.slot===r.slot),s=ledger.submissions.filter(x=>x.slot===r.slot);need(pin&&s.length===1);
    need(boundRow(r)&&boundRow(s[0])&&r.request_id===pin.requestId&&s[0].request_id===pin.requestId
      &&s[0].fingerprint===pin.fingerprint&&s[0].request_sha256===pin.requestSha256&&hex(r.response_sha256)
      &&id(r.provider_request_id)&&id(r.response_id)&&!providerIds.has(r.provider_request_id)&&!responseIds.has(r.response_id)
      &&r.model==='gpt-5-mini-2025-08-07'&&r.service_tier==='default'
      &&number(r.usage?.input_tokens)&&number(r.usage?.output_tokens)&&number(r.usage?.total_tokens)
      &&r.usage.input_tokens+r.usage.output_tokens===r.usage.total_tokens&&r.usage.output_tokens<=pin.maxOutputTokens);
    providerIds.add(r.provider_request_id);responseIds.add(r.response_id);
  }
  need(ledger.submissionCount===previousLedger.submissions.length+ledger.submissions.length
    &&ledger.receiptCount===previousLedger.receipts.length+ledger.receipts.length);
  stage='OFFICIAL_METADATA';
  const officialRun=jsonFile(join(art,'OFFICIAL-RUN.json'));
  const officialJobs=jsonFile(join(art,'OFFICIAL-JOBS.json'));
  const officialArtifacts=jsonFile(join(art,'OFFICIAL-ARTIFACTS.json'));
  need(String(officialRun.id)===RUN&&officialRun.run_attempt===1&&officialRun.head_sha===WRAPPER
    &&officialRun.head_branch==='monaco-scanner-evaluation-v2-run-v2-d002'&&officialRun.event==='push'
    &&officialRun.path==='.github/workflows/pocket-scanner-evaluation-v2-run.yml'
    &&officialRun.repository?.full_name==='nashysaimarkets/nash-ai-markets'&&officialRun.status==='completed');
  need(Array.isArray(officialJobs.jobs)&&officialJobs.jobs.length===officialJobs.total_count);
  const jobs=officialJobs.jobs.filter(j=>String(j.id)===JOB);need(jobs.length===1);
  need(jobs[0].name==='Pocket scanner evaluation v2'&&String(jobs[0].run_id)===RUN&&jobs[0].run_attempt===1
    &&jobs[0].head_sha===WRAPPER&&jobs[0].status==='completed');
  need(Array.isArray(officialArtifacts.artifacts)&&officialArtifacts.artifacts.length===officialArtifacts.total_count);
  const expectedNames=new Set(ledger.receipts.map(r=>`monaco-encrypted-${RUN}-${SOURCE.slice(0,12)}-d002-provider-response-${r.slot}`));
  expectedNames.add(`monaco-encrypted-${RUN}-${SOURCE.slice(0,12)}-d002-diagnostic-output-final`);
  expectedNames.add(`monaco-input-handoff-${RUN}-${SOURCE.slice(0,12)}`);
  need(officialArtifacts.artifacts.length===expectedNames.size);
  const artifactIds=new Set();
  for(const a of officialArtifacts.artifacts){
    need(Number.isSafeInteger(a.id)&&a.id>0&&!artifactIds.has(a.id)&&expectedNames.delete(a.name)&&a.expired===false
      &&String(a.workflow_run?.id)===RUN&&a.workflow_run.head_sha===WRAPPER
      &&a.workflow_run.repository_id===1298236921&&a.workflow_run.head_repository_id===1298236921);
    artifactIds.add(a.id);
  }
  need(expectedNames.size===0);
  const records=ledger.receipts.map(r=>{const pin=pins.find(p=>p.slot===r.slot);return {
    record:{scopeId:SCOPE,attemptId:e.attemptId,caseId:CASE,sourceCaseId:'d002',planSha256:PLAN,
      kind:'provider-response',slot:r.slot,requestId:pin.requestId,requestSha256:pin.requestSha256,fingerprint:pin.fingerprint,sha256:r.response_sha256},receipt:r};});
  records.push({record:{scopeId:SCOPE,attemptId:e.attemptId,caseId:CASE,sourceCaseId:'d002',planSha256:PLAN,
    kind:'diagnostic-output',slot:null,sha256:ledger.account.diagnostic_sha256}});
  for(const item of records){
    const r=item.record;stage='ARCHIVE_'+(r.slot??'diagnostic');
    const name=`monaco-encrypted-${RUN}-${SOURCE.slice(0,12)}-d002-${r.kind}-${r.slot??'final'}`;
    item.artifact=officialArtifacts.artifacts.find(a=>a.name===name);need(item.artifact);
    if(r.kind==='diagnostic-output')need(String(item.artifact.id)===ledger.account.diagnostic_artifact_id);
    const archive=bytes(join(art,`${item.artifact.id}.zip`));
    need(item.artifact.size_in_bytes===archive.length&&item.artifact.digest===`sha256:${hash(archive)}`);
    item.archiveSha256=hash(archive);
    item.envelopeBytes=execFileSync('python',['-c',zipProgram],{input:archive,maxBuffer:MAX,stdio:['pipe','pipe','pipe']});
    const m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(item.envelopeBytes)).metadata;
    need(m&&hex(m.sha256)&&m.repository==='nashysaimarkets/nash-ai-markets'&&m.runId===RUN&&m.runAttempt==='1'
      &&m.sourceSha===SOURCE&&m.caseId==='d002'&&m.kind===r.kind&&m.slot===r.slot
      &&m.recipientPublicKeySha256===RECIPIENT&&m.retentionDays===7);
    item.wrappedSha256=m.sha256;
  }
  stage='ROOT_PRIVATE_DECRYPTION';
  keyBytes=bytes(resolve(keyPath),32768);
  const run={repository:'nashysaimarkets/nash-ai-markets',runId:RUN,runAttempt:'1',sourceSha:SOURCE};
  const summaries=[];
  for(const item of records){
    const r=item.record;stage='AUTHENTICATED_'+(r.slot??'diagnostic');
    const raw=openEvaluationArtifact({identity,record:r,wrappedSha256:item.wrappedSha256,envelopeBytes:item.envelopeBytes,
      privateKeyPem:keyBytes,run,expectedRecipientPublicKeySha256:RECIPIENT,retentionDays:7});
    plaintext.push(raw);const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
    let provider;
    if(item.receipt){
      const q=item.receipt;
      need(value._request_id===q.provider_request_id&&value.id===q.response_id&&value.model===q.model
        &&value.service_tier===q.service_tier&&isDeepStrictEqual({input_tokens:value.usage?.input_tokens,
          output_tokens:value.usage?.output_tokens,total_tokens:value.usage?.total_tokens},q.usage)
        &&typeof value.output_text==='string'&&(value.status==='completed'||value.status==='incomplete'
          &&value.incomplete_details?.reason==='max_output_tokens'&&Object.keys(value.incomplete_details).length===1
          &&(value.error===null||value.error===undefined)));
      provider={status:value.status,incompleteReason:value.status==='incomplete'?'max_output_tokens':null,
        providerRequestId:q.provider_request_id,responseId:q.response_id,model:q.model,serviceTier:q.service_tier,usage:q.usage};
    }else{
      const d=value.diagnostics;need(d?.kind==='POCKET_SCANNER_EVALUATION_V2_DIAGNOSTICS'&&d.scopeId===SCOPE
        &&d.caseId===CASE&&d.sourceCaseId==='d002'&&d.attemptId===e.attemptId&&d.planSha256===PLAN&&d.appSourceSha===e.appSourceSha
        &&isDeepStrictEqual(value.rawSha256,Object.fromEntries(ledger.receipts.map(r=>[r.slot,r.response_sha256])))
        &&d.expertAccepted===false&&d.tradingInterpretation==='UNSCORED');
    }
    const file=`${r.kind}-${r.slot??'final'}.json`;
    summaries.push({artifactId:item.artifact.id,artifactName:item.artifact.name,kind:r.kind,slot:r.slot,
      archiveSha256:item.archiveSha256,envelopeSha256:hash(item.envelopeBytes),wrappedSha256:item.wrappedSha256,
      rawSha256:hash(raw),rawBytes:raw.length,path:join(out,file),provider});
  }
  stage='PRIVATE_WRITE';mkdirSync(out,{mode:0o700});
  need(lstatSync(out).isDirectory()&&!lstatSync(out).isSymbolicLink()&&realpathSync(out)===out);
  for(let i=0;i<summaries.length;i++)writeFileSync(summaries[i].path,plaintext[i],{flag:'wx',mode:0o600});
  const summary={kind:'POCKET_SCANNER_EVALUATION_V2_ROOT_VERIFIED_DECRYPTION',status:'VERIFIED',runId:RUN,jobId:JOB,
    caseId:CASE,scopeId:SCOPE,runtimeSourceSha:SOURCE,wrapperSha:WRAPPER,evidenceSha:EVIDENCE,
    ledgerSha256:hash(bytes(resolve(ledgerPath))),officialRunSha256:hash(bytes(join(art,'OFFICIAL-RUN.json'))),
    officialJobsSha256:hash(bytes(join(art,'OFFICIAL-JOBS.json'))),officialArtifactsSha256:hash(bytes(join(art,'OFFICIAL-ARTIFACTS.json'))),
    responseCount:ledger.receipts.length,diagnosticCount:1,artifacts:summaries,receiptSha256:ledger.computedReceiptSha256,
    originalHeldMicroUsd:1506400,evaluationHeldMicroUsd:660000,aggregateHeldMicroUsd:2166400,remainingMicroUsd:2833600,
    actualMicroUsd:null,financiallySettled:false,runnerCanLogin:ledger.runner?.canLogin,runnerSessions:ledger.runner?.sessions,
    previousCaseReceiptSha256:PREVIOUS_RECEIPT,previousLedgerSha256:PREVIOUS_LEDGER_SHA,previousCaseRowsPreserved:true,
    separateFreeBrowserSourceSha:'a3b108d59d4cd530b326a0e9a106e671aaead265',freeBrowserMeasurementPerformed:false,
    scannerAccuracyAccepted:false,deployedHttpLatencyMeasured:false,rawBodiesPrinted:false,privateKeyPrinted:false,networkCalls:0};
  writeFileSync(join(out,'VERIFICATION.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify(summary)+'\n');
}catch{
  process.stderr.write(JSON.stringify({status:'REFUSED',stage,rawBodiesPrinted:false,privateKeyPrinted:false,networkCalls:0})+'\n');
  process.exitCode=1;
}finally{keyBytes?.fill(0);for(const raw of plaintext)raw.fill(0);}
