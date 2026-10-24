/** Offline operator preparation. No network, secret lookup, hosted mutation,
 * credential activation or dispatch. Import and explicit builders are inert. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {V2,CASE_IDS,need,commit,digest,sha256} from './pocket-scanner-evaluation-v2-source.mjs';
import {unpackEvaluationCase} from './pocket-scanner-evaluation-v2-bundle.mjs';
import {sealInputBundle} from './pocket-monaco-confidential-transport.mjs';

const root=new URL('../',import.meta.url);
const oldRuns=new Set(['40083992183','40086015008']);
export function buildEvaluationRunWorkflow({caseId,sourceSha,evidenceSha}){
  need(CASE_IDS.includes(caseId)&&commit(sourceSha)&&commit(evidenceSha)&&sourceSha!==evidenceSha
    &&sourceSha!==V2.appSourceSha,'Exact new runtime/evidence source and named v2 case required');
  const branch=`monaco-scanner-evaluation-v2-run-${caseId}`;
  const template=readFileSync(new URL('docs/monaco-126/scanner-evaluation-v2-2026-10-24/RUN-WORKFLOW.yml.template',root),'utf8');
  const yaml=template.replaceAll('__CASE_ID__',caseId).replaceAll('__SOURCE_SHA__',sourceSha).replaceAll('__EVIDENCE_SHA__',evidenceSha);
  need(!/__CASE_ID__|__SOURCE_SHA__|__EVIDENCE_SHA__/.test(yaml));
  const vercel=JSON.parse(readFileSync(new URL('vercel.json',root),'utf8'));
  vercel.git.deploymentEnabled[branch]=false;
  return {kind:'POCKET_SCANNER_EVALUATION_V2_OFFLINE_WRAPPER',caseId,branch,sourceSha,evidenceSha,
    published:false,dispatchAuthorised:false,workflowPath:'.github/workflows/pocket-scanner-evaluation-v2-run.yml',
    workflow:yaml,workflowSha256:sha256(yaml),vercel:JSON.stringify(vercel,null,2)+'\n'};
}

export function sealEvaluationInput({caseId,sourceSha,runId,publicHandoff,bundleBytes,bundleSha256,planBytes,planSha256}){
  need(CASE_IDS.includes(caseId)&&commit(sourceSha)&&sourceSha!==V2.appSourceSha
    &&typeof runId==='string'&&/^[1-9][0-9]{0,19}$/.test(runId)&&!oldRuns.has(runId)
    &&digest(bundleSha256)&&digest(planSha256),'New exact named run and material pins required');
  unpackEvaluationCase({bytes:bundleBytes,expectedBundleSha256:bundleSha256,planBytes,expectedPlanSha256:planSha256,caseId});
  const run={repository:V2.repository,runId,runAttempt:'1',sourceSha};
  const envelope=sealInputBundle({publicHandoff,run,bytes:bundleBytes,expectedBundleSha256:bundleSha256});
  const branch=`monaco-first-six-input-${runId}`;
  const vercel=JSON.parse(readFileSync(new URL('vercel.json',root),'utf8'));
  vercel.git.deploymentEnabled[branch]=false;
  return {kind:'POCKET_SCANNER_EVALUATION_V2_OFFLINE_INPUT_RELAY',caseId,scopeId:V2.scopeId,
    run,planSha256,bundleSha256,branch,published:false,dispatchAuthorised:false,
    envelope,envelopeSha256:sha256(envelope),envelopeBytes:envelope.length,vercel:JSON.stringify(vercel,null,2)+'\n'};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [mode,configPath,outputDirectory,...extra]=process.argv.slice(2);
  need(['workflow','input'].includes(mode)&&configPath&&outputDirectory&&extra.length===0,
    'Usage: operator.mjs workflow|input CONFIG.json NEW_OUTPUT_DIRECTORY');
  const config=JSON.parse(readFileSync(resolve(configPath),'utf8'));
  let result;
  if(mode==='workflow')result=buildEvaluationRunWorkflow(config);
  else{
    const {publicHandoffPath,bundlePath,planPath,...pins}=config;
    result=sealEvaluationInput({...pins,publicHandoff:JSON.parse(readFileSync(resolve(publicHandoffPath),'utf8')),
      bundleBytes:readFileSync(resolve(bundlePath)),planBytes:readFileSync(resolve(planPath))});
  }
  const out=resolve(outputDirectory);mkdirSync(out,{mode:0o700});
  const name=mode==='workflow'?'pocket-scanner-evaluation-v2-run.yml':'input.envelope.json';
  writeFileSync(join(out,name),result.workflow??result.envelope,{flag:'wx',mode:0o600});
  writeFileSync(join(out,'vercel.json'),result.vercel,{flag:'wx',mode:0o600});
  const receipt={...result,workflow:undefined,envelope:undefined,vercel:undefined,providerCalls:0,databaseCalls:0};
  writeFileSync(join(out,'PREPARATION.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify(receipt));
}
