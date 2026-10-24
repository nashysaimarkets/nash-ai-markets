/** Explicit offline materialization; never runs on import. Output is private. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareEvaluationPlan,packEvaluationCase} from './pocket-scanner-evaluation-v2-bundle.mjs';
import {CASE_IDS,need,V2} from './pocket-scanner-evaluation-v2-source.mjs';

export async function prepareEvaluationDirectory({originalBundlePath,outputDirectory}){
  const prepared=prepareEvaluationPlan(await readFile(originalBundlePath));
  await mkdir(outputDirectory,{mode:0o700});
  await writeFile(join(outputDirectory,'PLAN.json'),prepared.planBytes,{flag:'wx',mode:0o600});
  const bundles=[];
  for(const caseId of CASE_IDS){const bundle=packEvaluationCase(prepared,caseId),path=`${caseId}.bundle.gz`;
    await writeFile(join(outputDirectory,path),bundle.bytes,{flag:'wx',mode:0o600});
    bundles.push({caseId,sourceCaseId:bundle.sourceCaseId,path,bytes:bundle.bytes.length,sha256:bundle.sha256,requestPins:bundle.requestPins});}
  const receipt={kind:'POCKET_SCANNER_EVALUATION_V2_PREPARED_MATERIAL',status:'OFFLINE_PREPARED',scopeId:V2.scopeId,
    planSha256:prepared.planSha256,bundles,originalCommitmentsMicroUsd:V2.originalCommitmentsMicroUsd,
    maximumNewMicroUsd:V2.scopeBoundMicroUsd,maximumCumulativeMicroUsd:V2.aggregateMaximumMicroUsd,
    providerCalls:0,databaseCalls:0,heldOutPayloadsRead:0,paidDispatchAuthorised:false};
  await writeFile(join(outputDirectory,'PREPARATION-RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
  return receipt;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);need(args.length===4&&args[0]==='--original-bundle'&&args[2]==='--out','Usage: --original-bundle /private/original.bundle.gz --out /private/new-directory');
  const receipt=await prepareEvaluationDirectory({originalBundlePath:resolve(args[1]),outputDirectory:resolve(args[3])});
  console.log(JSON.stringify({status:receipt.status,planSha256:receipt.planSha256,bundles:receipt.bundles.length,requestsPrepared:18,
    providerCalls:0,databaseCalls:0,paidDispatchAuthorised:false}));
}
