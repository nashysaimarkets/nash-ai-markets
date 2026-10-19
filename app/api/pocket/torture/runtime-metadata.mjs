import { createHash } from 'node:crypto';

const ORG='org-5vLRRzXwcigUx96TVE0rI3RW';
const PROJECT='proj_LTmAIE2Ve7gUAFJ9M74ZxIBI';
const KEY='key_EjND5GXtuqF2K0hp';
const STAGING='pxlqvaddvghjjhenqmdh';
const MODEL='gpt-5-mini-2025-08-07';
const sha=(v)=>createHash('sha256').update(v).digest('hex');
const fail=()=>{throw Error('Benchmark metadata verification failed; no inference was requested.');};

// Fixed HTTPS origin, GET only, no redirects, no retries, no response/error dumps.
// Credential-bearing transport is private: callers cannot select another host.
async function getMetadata(path,key,project) {
 let response;
 try {
  response=await fetch('https://api.openai.com/v1'+path,{
   method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{Authorization:'Bearer '+key,'OpenAI-Organization':ORG,...(project?{'OpenAI-Project':project}:{})}
  });
  if(!response.ok)fail();
  const text=await response.text();
  if(text.length>262144)fail();
  return {body:JSON.parse(text),requestId:response.headers.get('x-request-id')};
 } catch { fail(); }
}

export function checkRuntimeEnvironment(env) {
 if(env.POCKET_BENCHMARK_RUNTIME_METADATA_ENABLED!=='true')throw Error('Benchmark metadata probe is disabled.');
 if(env.OPENAI_BASE_URL || (env.OPENAI_ORG_ID && env.OPENAI_ORG_ID!==ORG) || (env.OPENAI_PROJECT_ID && env.OPENAI_PROJECT_ID!==PROJECT)
   || env.POCKET_BENCHMARK_OPENAI_PROJECT_ID!==PROJECT
   || !/^[0-9a-f]{40}$/.test(env.POCKET_BENCHMARK_CANDIDATE_SHA??'')
   || env.OPENAI_POCKET_MODEL!==MODEL || env.OPENAI_POCKET_ANNOTATION_MODEL!==MODEL)fail();
 let url;
 try{url=new URL(env.NEXT_PUBLIC_SUPABASE_URL??'');}catch{fail();}
 if(url.protocol!=='https:' || url.hostname!==STAGING+'.supabase.co' || url.username || url.password
  || url.port || url.search || url.hash || url.pathname!=='/')fail();
 if(!env.OPENAI_API_KEY?.startsWith('sk-proj-') || !env.OPENAI_ADMIN_KEY?.trim())
  throw Error('Existing isolated runtime and read-only administrator credentials are unavailable.');
 return {projectId:PROJECT,backendProjectRef:STAGING,candidateSha:env.POCKET_BENCHMARK_CANDIDATE_SHA,model:MODEL};
}

// Pure review of authenticated GET metadata; no secret is returned or logged.
// Redacted correlation is explicitly not described as a provider cryptographic signature.
export function validateRuntimeMetadata(env,project,keys,model,now=Date.now()) {
 const scope=checkRuntimeEnvironment(env);
 if(project?.id!==PROJECT || project?.status!=='active' || keys?.has_more!==false || !Array.isArray(keys.data)
  || model?.id!==MODEL || model?.object!=='model')fail();
 const matching=keys.data.filter(k=>{
  if(k.owner_project_access!=='active' || (k.expires_at!=null && (!Number.isFinite(k.expires_at)||k.expires_at*1000<=now)))return false;
  if(typeof k.redacted_value!=='string')return false;
  const match=/^(.+?)(?:\.{3}|…)(.+)$/.exec(k.redacted_value);
  return !!match && match[1].length>=3 && match[2].length>=4
   && env.OPENAI_API_KEY.startsWith(match[1]) && env.OPENAI_API_KEY.endsWith(match[2]);
 });
 if(matching.length!==1 || matching[0].id!==KEY || matching[0].object!=='organization.project.api_key')fail();
 return {
  schemaVersion:1,...scope,organisationId:ORG,keyTrackingId:KEY,
  keyFingerprintSha256:sha(env.OPENAI_API_KEY),
  keyTrackingVerification:'UNIQUE_REDACTED_METADATA_AND_PROJECT_AUTHORIZATION',
  requiredServiceTier:'default',verifiedAt:new Date(now).toISOString(),
  verificationScope:'METADATA_ONLY_NO_INFERENCE',financiallySettled:false
 };
}

export async function verifyPocketBenchmarkRuntime() {
 const env=process.env;
 checkRuntimeEnvironment(env); // Reject wrong environment before any network activity.
 const project=await getMetadata('/organization/projects/'+PROJECT,env.OPENAI_ADMIN_KEY);
 const keys=await getMetadata('/organization/projects/'+PROJECT+'/api_keys?limit=100&owner_project_access=any',env.OPENAI_ADMIN_KEY);
 // Non-billed model metadata only, with explicit project/org scope and the actual runner key.
 const model=await getMetadata('/models/'+MODEL,env.OPENAI_API_KEY,PROJECT);
 if(!model.requestId)fail();
 return {...validateRuntimeMetadata(env,project.body,keys.body,model.body),providerMetadataRequestId:model.requestId};
}
