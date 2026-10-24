/** Inert, explicitly selected composition for the original five untouched
 * chart cases. This does not create credentials, clients or authorization.
 */
import {createHash} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {validateContinuationEvidence} from './pocket-monaco-continuation-admission.mjs';
import {createBootstrapPrivateArtifacts} from './pocket-monaco-executor-bootstrap.mjs';
import {createResponsesTransport} from './pocket-monaco-executor-effects.mjs';
const need=ok=>{if(!ok)throw Error('CONTINUATION_BOOTSTRAP_REFUSED');};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function prepareContinuationBootstrap({config,evidence,context,responsesClient,
  sqlClient,privateOutputDirectory,encryptedArtifacts,inputPaths}) {
  try {
    const admission=validateContinuationEvidence(config,evidence,context);
    need(typeof responsesClient?.apiKey==='string'
      && hash(responsesClient.apiKey)===admission.identity.keyFingerprintSha256);
    const privateArtifacts=createBootstrapPrivateArtifacts({evidence,context,privateOutputDirectory,encryptedArtifacts});
    need(inputPaths && ['packetDirectory','objectiveReferencePath','protocolPath'].every(k=>
      typeof inputPaths[k]==='string' && isAbsolute(inputPaths[k])));
    const paths=structuredClone(inputPaths),transport=createResponsesTransport(responsesClient);
    const [{createNeonSqlPort},{loadFrozenFirstSixInputs},{createFrozenContinuationExecutor}]=await Promise.all([
      import('./pocket-monaco-neon-port.ts'),import('./pocket-monaco-first-six-executor.ts'),
      import('./pocket-monaco-continuation-case.mjs'),
    ]);
    const fixed=createNeonSqlPort(sqlClient,admission.neon,admission.identity);
    const port={async rpc(name,args) {
      const result=await fixed.rpc(name,args);
      if(name==='inspect_monaco_isolated_runner' && !result.error
        && result.data?.prior_exposure_microusd!==admission.priorExposureMicroUsd)
        return {data:null,error:'BOUND_CARRY_IN_MISMATCH'};
      return result;
    }};
    const executor=createFrozenContinuationExecutor({port,ledgerKey:admission.ledgerKey,
      identity:admission.identity,transport,privateArtifacts});
    let used=false;
    return Object.freeze({kind:'FIRST_SIX_CONTINUATION_BOOTSTRAP',status:'PREPARED',executionAdmitted:false,
      sourceSha:admission.identity.sourceSha,planSha256:admission.identity.planSha256,
      async runOnce({signal}={}) {
        if(used)return {status:'HOLD',reason:'BOOTSTRAP_ALREADY_USED'};
        used=true;
        if(signal?.aborted)return {status:'CANCELLED',reason:'CANCELLED_BEFORE_PACKET_READ'};
        let invoked=false;
        try {
          const prepared=loadFrozenFirstSixInputs(paths);
          invoked=true;
          return await executor.run(prepared,{signal});
        } catch {return {status:invoked?'UNCERTAIN':'HOLD',reason:'BOUND_INPUT_OR_EXECUTION_REFUSED'};}
      }});
  } catch {
    return {kind:'FIRST_SIX_CONTINUATION_BOOTSTRAP',status:'HOLD',executionAdmitted:false,
      reason:'Exact successor evidence, credential, ledger or private destination binding refused.'};
  }
}
