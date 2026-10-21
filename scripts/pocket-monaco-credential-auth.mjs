/** One protected authentication check. No provider client, ledger RPC or writes. */
import {createHash} from 'node:crypto';
import {readFileSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {probeNeonAuthentication} from './pocket-monaco-neon-auth-probe.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const requireValue=x=>{if(!x)throw Error('CREDENTIAL_AUTH_HOLD');};
export async function authenticateStoredCredentials({context,identityBytes,storageBytes,readInferenceKey,readLedgerPassword,createClient,probe=probeNeonAuthentication}){
 try{
  requireValue(context.repository==='nashysaimarkets/nash-ai-markets' && context.ref==='refs/heads/monaco-first-six-inference-126-20261021' && context.event==='push' && context.attempt==='1');
  requireValue(/^[a-f0-9]{40}$/.test(context.reviewedSourceSha??'') && context.sourceSha===context.reviewedSourceSha);
  requireValue(/^[a-f0-9]{64}$/.test(context.reviewedStorageSha256??'') && hash(storageBytes)===context.reviewedStorageSha256);
  const storage=JSON.parse(Buffer.from(storageBytes).toString('utf8'));
  requireValue(storage.kind==='INFERENCE_CREDENTIAL_STORED_RUNTIME_BINDING_PENDING' && storage.keyTrackingId==='key_aD5pc20EZBLGECNC' && storage.projectId==='proj_LTmAIE2Ve7gUAFJ9M74ZxIBI' && storage.environment==='monaco-first-six-inference' && storage.secretName==='MONACO_FIRST_SIX_OPENAI_API_KEY' && storage.secretPresent===true && storage.secretValuesRecorded===false);
  const key=readInferenceKey();requireValue(typeof key==='string' && /^sk-proj-[A-Za-z0-9_-]{40,}$/.test(key));
  const auth=await probe({context,identityEvidenceBytes:identityBytes,readLedgerPassword,createClient});
  requireValue(auth.status==='PASS' && auth.passwordAuthenticationVerified===true && auth.clientTlsVerified===true && auth.databaseWrites===0 && auth.providerRequests===0);
  return {kind:'MONACO_PROTECTED_CREDENTIAL_AUTH_V1',status:'PASS',sourceSha:context.sourceSha,
   runId:context.runId,keyTrackingId:storage.keyTrackingId,projectId:storage.projectId,
   keyFingerprintSha256:hash(key),storageEvidenceSha256:hash(storageBytes),
   keyIdentityBasis:'OWNER_COMPLETED_CONTROL_PLANE_CREATION_AND_DIRECT_SECRET_TRANSFER',
   providerAuthenticationVerified:false,providerRequests:0,databaseWrites:0,paidDispatchEnabled:false,
   ledgerAuthentication:{...auth,githubSecretBinding:'MONACO_FIRST_SIX_LEDGER_KEY_FROM_PROTECTED_ENVIRONMENT'}};
 }catch{return {kind:'MONACO_PROTECTED_CREDENTIAL_AUTH_V1',status:'HOLD',providerRequests:0,databaseWrites:0,paidDispatchEnabled:false,reason:'Protected credential authentication failed; no values or driver details retained.'};}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  requireValue(process.version==='v24.19.0');
  const env=process.env,root=realpathSync(env.RUNNER_TEMP),runtime=realpathSync(join(root,'monaco-first-six-runtime'));
  requireValue(runtime===join(root,'monaco-first-six-runtime'));
  const pgroot=realpathSync(join(runtime,'node_modules/pg'));requireValue(pgroot===join(runtime,'node_modules/pg'));
  requireValue(JSON.parse(readFileSync(join(pgroot,'package.json'),'utf8')).version==='8.16.3');
  const {Client}=(await import(pathToFileURL(join(pgroot,'lib/index.js')))).default;
  const result=await authenticateStoredCredentials({
   context:{repository:env.GITHUB_REPOSITORY,ref:env.GITHUB_REF,event:env.GITHUB_EVENT_NAME,attempt:env.GITHUB_RUN_ATTEMPT,runId:env.GITHUB_RUN_ID,reviewedSourceSha:env.REVIEWED_AUTH_SOURCE_SHA,sourceSha:env.CHECKED_OUT_SOURCE_SHA,reviewedIdentityEvidenceSha256:env.REVIEWED_IDENTITY_SHA256,reviewedStorageSha256:env.REVIEWED_STORAGE_SHA256},
   identityBytes:readFileSync(new URL('../docs/monaco-126/isolated-runner/NEON-IDENTITY-EVIDENCE.json',import.meta.url)),
   storageBytes:readFileSync(new URL('../docs/monaco-126/isolated-runner/INFERENCE-CREDENTIAL-STORAGE-RECEIPT.json',import.meta.url)),
   readInferenceKey:()=>env.MONACO_FIRST_SIX_OPENAI_API_KEY,readLedgerPassword:()=>env.MONACO_FIRST_SIX_LEDGER_KEY,createClient:options=>new Client(options)});
  process.stdout.write(JSON.stringify(result)+'\n');if(result.status!=='PASS')process.exitCode=1;
 }catch{process.stdout.write('CREDENTIAL_AUTH_HOLD\n');process.exitCode=1;}
}
