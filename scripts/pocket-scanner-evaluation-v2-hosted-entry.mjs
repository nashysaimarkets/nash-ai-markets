/** Separate one-case entry. Absent independently recorded new scope approval
 * returns HOLD before credentials, runtime clients, input or provider access. */
import {readFileSync,realpathSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {loadPinnedRuntime,RUNTIME_PACKAGES,MAX_INPUT_ENVELOPE_BYTES} from './pocket-monaco-protected-runner.mjs';
import {neonConnectionOptions} from './pocket-monaco-neon-port.ts';
import {createInputHandoff,recipientPublicKeySha256} from './pocket-monaco-confidential-transport.mjs';
import {createGitHubEnvelopeReceiver} from './pocket-monaco-github-input-relay.mjs';
import {V2,need,sha256,digest,commit,verifyAppSources,CASE_IDS,sourceCaseId,attemptId} from './pocket-scanner-evaluation-v2-source.mjs';
import {validateEvaluationPlan,unpackEvaluationCase} from './pocket-scanner-evaluation-v2-bundle.mjs';
import {validateEvaluationIdentity,validateAdmissionEvidence,createEvaluationSqlPort,createEvaluationLedgerBridge} from './pocket-scanner-evaluation-v2-bridge.mjs';
import {createEvaluationTransport,createEvaluationArtifactSink} from './pocket-scanner-evaluation-v2-effects.mjs';
import {createEvaluationExecutor} from './pocket-scanner-evaluation-v2-executor.mjs';
import {createEvaluationDiagnostics} from './pocket-scanner-evaluation-v2-diagnostics.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const DOCUMENTS='docs/monaco-126/scanner-evaluation-v2-2026-10-24';

export function validateStaticRunAdmission({config,context,planBytes,caseId}){
  need(config?.kind==='POCKET_SCANNER_EVALUATION_V2_RUN_ADMISSION'&&config.status==='EXECUTION_APPROVED'
    &&config.scopeApproval?.status==='APPROVED'&&config.scopeApproval.scopeId===V2.scopeId
    &&digest(config.scopeApproval.ownerDirectiveSha256)&&digest(config.admissionEvidenceSha256)
    &&digest(config.reassessmentEvidenceSha256)&&config.identity===undefined
    &&commit(config.runtimeSourceSha)&&digest(config.planSha256)
    &&config.scopeApproval.planSha256===config.planSha256&&config.scopeApproval.appSourceSha===V2.appSourceSha
    &&config.scopeApproval.maximumNewMicroUsd===1980000&&config.scopeApproval.aggregateCapMicroUsd===5000000,
    'V2_NEW_EXPLICIT_SCOPE_APPROVAL_REQUIRED');
  need(caseId===config.caseId&&CASE_IDS.includes(caseId)&&context.repository===V2.repository&&context.runAttempt==='1'
    &&context.sourceSha===config.runtimeSourceSha&&commit(context.evidenceSha)&&commit(context.wrapperSha)
    &&typeof context.runId==='string'&&/^[1-9][0-9]{0,19}$/.test(context.runId)
    &&context.ref===`refs/heads/monaco-scanner-evaluation-v2-run-${caseId}`&&context.event==='push','V2_RUN_BINDING_REFUSED');
  validateEvaluationPlan(planBytes,config.planSha256);
  need(digest(config.input?.bundleSha256)&&Number.isInteger(config.input.maxWaitMs)&&config.input.maxWaitMs>0&&config.input.maxWaitMs<=300000
    &&Number.isInteger(config.output?.retentionDays)&&config.output.retentionDays>=7&&config.output.retentionDays<=90
    &&recipientPublicKeySha256(config.output.recipientPublicKeyPem)===config.output.recipientPublicKeySha256);
}
export function validateRunAdmission(input){
  validateStaticRunAdmission(input);const {config,context,caseId}=input;
  const identity=validateEvaluationIdentity({environment:V2.environment,sourceSha:config.runtimeSourceSha,backendRef:V2.backendRef,
    projectRef:V2.project,keyTrackingId:V2.keyTrackingId,keyFingerprintSha256:V2.keyFingerprintSha256,planSha256:config.planSha256,
    evaluation:{scopeId:V2.scopeId,attemptId:attemptId(caseId),caseId,sourceCaseId:sourceCaseId(caseId),appSourceSha:V2.appSourceSha,
      evidenceSha:context.evidenceSha,wrapperSha:context.wrapperSha,runId:context.runId,jobId:context.jobId,
      runAttempt:context.runAttempt,approvalRef:config.scopeApproval.approvalRef}});
  validateAdmissionEvidence(expectedAdmissionFromConfig(config),identity);return identity;
}
export const expectedAdmissionFromConfig=config=>({approvalRef:config.scopeApproval.approvalRef,
  approvalBodySha256:config.scopeApproval.ownerDirectiveSha256,admissionEvidenceSha256:config.admissionEvidenceSha256,
  reassessmentEvidenceSha256:config.reassessmentEvidenceSha256,previousCaseReceiptSha256:config.previousCaseReceiptSha256});
export function loadEvaluationRunInputs(env,caseId,sourceRoot=ROOT){
  need(typeof env?.GITHUB_WORKSPACE==='string'&&isAbsolute(env.GITHUB_WORKSPACE));
  const root=realpathSync(sourceRoot),evidenceRoot=realpathSync(join(env.GITHUB_WORKSPACE,'runner-evidence'));
  const file=realpathSync(join(evidenceRoot,DOCUMENTS,'RUN-ADMISSION.json'));
  need(relative(evidenceRoot,file)===`${DOCUMENTS}/RUN-ADMISSION.json`);
  const config=JSON.parse(readFileSync(file,'utf8'));
  const planBytes=readFileSync(join(root,DOCUMENTS,'PLAN.json'));
  const sourceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  const evidenceSha=execFileSync('git',['rev-parse','HEAD'],{cwd:evidenceRoot,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  execFileSync('git',['diff','--exit-code','HEAD','--'],{cwd:root,stdio:'ignore'});
  execFileSync('git',['diff','--exit-code','HEAD','--'],{cwd:evidenceRoot,stdio:'ignore'});
  const context={repository:env.GITHUB_REPOSITORY,event:env.GITHUB_EVENT_NAME,ref:env.GITHUB_REF,
    runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT,
    sourceSha,evidenceSha,wrapperSha:env.GITHUB_SHA};
  validateStaticRunAdmission({config,context,planBytes,caseId});verifyAppSources();
  return {config,context,planBytes,caseId};
}
/** Read-only official metadata; no guessed job IDs or self-referential commit
 * documents. The owner installs the exact resulting identity after push. */
export async function resolveCurrentEvaluationJob(env,{fetchImpl=globalThis.fetch,signal}={}){
  need(!signal?.aborted&&env.GITHUB_REPOSITORY===V2.repository&&env.GITHUB_JOB==='evaluation'&&env.GITHUB_EVENT_NAME==='push'
    &&env.GITHUB_RUN_ATTEMPT==='1'&&/^[1-9][0-9]{0,19}$/.test(env.GITHUB_RUN_ID)&&commit(env.GITHUB_SHA)
    &&/^refs\/heads\/monaco-scanner-evaluation-v2-run-v2-d00[1-6]$/.test(env.GITHUB_REF)
    &&typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>0&&!/[\s\x00-\x1f\x7f]/.test(env.GITHUB_TOKEN));
  const base=`https://api.github.com/repos/${V2.repository}/actions/runs/${env.GITHUB_RUN_ID}`;
  async function get(url){
    const deadline=AbortSignal.timeout(10000),requestSignal=signal?AbortSignal.any([signal,deadline]):deadline;
    const r=await fetchImpl(url,{method:'GET',redirect:'error',cache:'no-store',signal:requestSignal,
      headers:{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','Accept-Encoding':'identity',
        'X-GitHub-Api-Version':'2022-11-28','User-Agent':'pocket-scanner-evaluation-v2'}});
    need(r?.status===200&&r.url===url&&r.redirected===false&&r.headers?.get('x-github-request-id')
      &&r.headers.get('link')===null&&[null,'identity'].includes(r.headers.get('content-encoding'))
      &&['application/json','application/vnd.github+json'].includes(r.headers.get('content-type')?.split(';')[0].trim()));
    const declared=r.headers.get('content-length');need(declared===null||/^\d+$/.test(declared)&&Number(declared)>0&&Number(declared)<=131072);
    const reader=r.body?.getReader();need(reader);let bytes=0;const parts=[];
    try{for(;;){need(!requestSignal.aborted);const part=await reader.read();need(!requestSignal.aborted);if(part.done)break;bytes+=part.value.length;need(bytes<=131072);parts.push(Buffer.from(part.value));}}
    finally{try{await reader.cancel();}catch{ /* Public metadata only. */ }}
    need(bytes>0&&(declared===null||bytes===Number(declared)));return JSON.parse(Buffer.concat(parts).toString('utf8'));
  }
  const run=await get(base);need(String(run.id)===env.GITHUB_RUN_ID&&run.run_attempt===1&&run.status==='in_progress'
    &&run.head_sha===env.GITHUB_SHA&&run.event==='push'&&`refs/heads/${run.head_branch}`===env.GITHUB_REF
    &&run.path==='.github/workflows/pocket-scanner-evaluation-v2-run.yml'&&run.repository?.full_name===V2.repository);
  const jobs=await get(`${base}/jobs?per_page=100`);need(Number.isInteger(jobs.total_count)&&jobs.total_count>0&&jobs.total_count<=100
    &&Array.isArray(jobs.jobs)&&jobs.jobs.length===jobs.total_count);
  const selected=jobs.jobs.filter(j=>j.name==='Pocket scanner evaluation v2');need(selected.length===1);
  const job=selected[0];need(Number.isSafeInteger(job.id)&&job.id>0&&String(job.run_id)===env.GITHUB_RUN_ID
    &&job.run_attempt===1&&job.head_sha===env.GITHUB_SHA&&job.status==='in_progress');
  return {jobId:String(job.id)};
}
async function publishHandoff(client,publicHandoff){
  const directory=await mkdtemp(join(tmpdir(),'pocket-v2-public-handoff-'));
  try{const file=join(directory,'public-input-handoff.json');await writeFile(file,JSON.stringify(publicHandoff),{flag:'wx',mode:0o600});
    const name=`monaco-input-handoff-${publicHandoff.runId}-${publicHandoff.sourceSha.slice(0,12)}`;
    const r=await client.uploadArtifact(name,[file],directory,{retentionDays:1,compressionLevel:0});
    const archiveSha256=typeof r?.digest==='string'?r.digest.replace(/^sha256:/,''):'';
    need(Number.isSafeInteger(r?.id)&&r.id>0&&Number.isSafeInteger(r.size)&&r.size>0&&digest(archiveSha256));
    return {id:r.id,name,archiveSha256};
  }finally{await rm(directory,{recursive:true,force:true});}
}
export async function executeProtectedEvaluation(input,{runtime,receiveInputOnce,credentials,signal}){
  let sqlClient,entered=false,stage='ADMISSION';
  const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  try{
    const {config,context,planBytes,caseId}=input,identity=validateRunAdmission(input),e=identity.evaluation;
    need(!controller.signal.aborted&&Object.entries(RUNTIME_PACKAGES).every(([name,version])=>runtime?.versions?.[name]===version)
      &&['OpenAI','Client','ArtifactClient'].every(k=>typeof runtime[k]==='function')&&typeof receiveInputOnce==='function');
    const key=credentials?.existingKey,password=credentials?.ledgerPassword;
    need(typeof key==='string'&&sha256(key)===identity.keyFingerprintSha256&&typeof password==='string'&&password.length>=12);
    verifyAppSources();stage='LEDGER_AUTHENTICATION';
    sqlClient=new runtime.Client({...neonConnectionOptions(config.neon,password),application_name:'pocket-scanner-evaluation-v2'});
    sqlClient.on('error',abort);await sqlClient.connect();need(!controller.signal.aborted);
    const expectedAdmission=expectedAdmissionFromConfig(config);
    const ledger=createEvaluationLedgerBridge(createEvaluationSqlPort(sqlClient,config.neon,identity),identity,expectedAdmission);
    await ledger.inspect(); // Authoritative live approval before any image transfer/provider client.
    need(!controller.signal.aborted);
    const run={repository:V2.repository,runId:e.runId,runAttempt:'1',sourceSha:identity.sourceSha};
    const artifactClient=new runtime.ArtifactClient(),handoff=createInputHandoff({run,expectedBundleSha256:config.input.bundleSha256});
    stage='ENCRYPTED_INPUT';
    const handoffArtifact=await publishHandoff(artifactClient,handoff.publicHandoff);
    const encrypted=await receiveInputOnce({publicHandoff:handoff.publicHandoff,handoffArtifact,run,
      expectedBundleSha256:config.input.bundleSha256,timeoutMs:config.input.maxWaitMs,maxEnvelopeBytes:MAX_INPUT_ENVELOPE_BYTES,signal:controller.signal});
    let bytes,prepared;
    try{bytes=handoff.openOnce(encrypted);prepared=unpackEvaluationCase({bytes,expectedBundleSha256:config.input.bundleSha256,
      planBytes,expectedPlanSha256:identity.planSha256,caseId});}finally{bytes?.fill(0);}
    need(!controller.signal.aborted);
    const client=new runtime.OpenAI({apiKey:key,project:V2.project,organization:'org-5vLRRzXwcigUx96TVE0rI3RW',
      baseURL:'https://api.openai.com/v1',maxRetries:0,timeout:60000,logLevel:'off'});
    const privateArtifacts=createEvaluationArtifactSink({identity,run,artifactClient,recipientPublicKeyPem:config.output.recipientPublicKeyPem,
      expectedRecipientPublicKeySha256:config.output.recipientPublicKeySha256,retentionDays:config.output.retentionDays});
    const diagnostics=createEvaluationDiagnostics();
    const executor=createEvaluationExecutor({identity,expectedAdmission,ledger,transport:createEvaluationTransport(client,identity),privateArtifacts,
      prepareCase:value=>{need(value.caseId===caseId);return value;},...diagnostics});
    stage='EXECUTION';entered=true;return await executor.run(prepared,{signal:controller.signal});
  }catch{return {kind:'POCKET_SCANNER_EVALUATION_V2_EXECUTION',status:entered?'UNCERTAIN':controller.signal.aborted?'CANCELLED':'HOLD',
    stage,reason:'PROTECTED_EVALUATION_REFUSED_OR_UNKNOWN',transportSendAttempts:entered?null:0,financiallySettled:false,actualMicroUsd:null};
  }finally{controller.abort();signal?.removeEventListener('abort',abort);if(sqlClient){try{await sqlClient.end();}catch{ /* No driver text. */ }}}
}
export async function runHostedEvaluation({env,argv,signal},{loadInputs=loadEvaluationRunInputs,loadRuntime=loadPinnedRuntime,
  execute=executeProtectedEvaluation,createReceiver=createGitHubEnvelopeReceiver,resolveJob=resolveCurrentEvaluationJob}={}){
  let invoked=false;
  try{need(Array.isArray(argv)&&argv.length===3&&argv[0]==='--run-once'&&argv[1]==='--case'&&CASE_IDS.includes(argv[2])&&!signal?.aborted);
    const input=loadInputs(env,argv[2]);validateStaticRunAdmission(input);
    input.context={...input.context,...await resolveJob(env,{signal})};validateRunAdmission(input);
    const runtime=await loadRuntime(env.RUNNER_TEMP),receiveInputOnce=createReceiver({token:env.GITHUB_TOKEN});
    invoked=true;return await execute(input,{runtime,receiveInputOnce,signal,
      credentials:{existingKey:env.MONACO_FIRST_SIX_OPENAI_API_KEY,ledgerPassword:env.MONACO_FIRST_SIX_LEDGER_KEY}});
  }catch{return {kind:'POCKET_SCANNER_EVALUATION_V2_EXECUTION',status:invoked?'UNCERTAIN':'HOLD',reason:'NEW_SCOPE_OR_HOSTED_ADMISSION_REQUIRED',
    transportSendAttempts:invoked?null:0,financiallySettled:false,actualMicroUsd:null};}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{const result=await runHostedEvaluation({env:process.env,argv:process.argv.slice(2),signal:controller.signal});
    process.stdout.write(JSON.stringify(result)+'\n');if(result.status!=='COMPLETED')process.exitCode=1;
  }finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);}
}
