/** Explicit, inactive composition for the already approved first-six scope.
 * Importing this module does nothing. No environment lookup, client creation,
 * packet read, secret retrieval, login, database/network call or workflow entry
 * is mounted. The future protected caller supplies already connected clients and
 * immutable reviewed evidence. Setup PASS is not execution authority.
 */
import {createHash} from 'node:crypto';
import {realpathSync} from 'node:fs';
import {isAbsolute, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateSetupEvidence, PINS} from './pocket-monaco-setup-preflight.mjs';
import {createResponsesTransport, createPrivateArtifactSink} from './pocket-monaco-executor-effects.mjs';
import {createEncryptedArtifactSink, ENCRYPTED_ARTIFACT_KIND} from './pocket-monaco-confidential-transport.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const requireValue = ok => {if (!ok) throw Error('EXPLICIT_BOOTSTRAP_BINDING_REFUSED');};
const sourceRoot = fileURLToPath(new URL('../', import.meta.url));

/** The location record binds the already-required private-artifact acceptance
 * to the selected persistent private mount. Local fsync cannot attest persistence
 * after an ephemeral runner is destroyed; that fact must be established by the
 * reviewed processor/security evidence, never manufactured from this function.
 */
export function validatePrivateArtifactLocation(evidence, directory) {
  const accepted = evidence?.processorSecurityAcceptance?.privateArtifactLocation;
  requireValue(accepted?.persistent === true && typeof accepted.acceptanceRef === 'string'
    && accepted.acceptanceRef.trim() && typeof directory === 'string' && isAbsolute(directory)
    && accepted.directory === directory && resolve(directory) === directory);
  requireValue(!/^\/(?:tmp|var\/tmp)(?:\/|$)/.test(directory) && !directory.split('/').includes('_temp'));
  const canonical = realpathSync(directory);
  requireValue(canonical === directory);
  const rel = relative(sourceRoot, canonical);
  requireValue(rel.startsWith('..' + '/') || isAbsolute(rel)); // Never place private output in this repository.
  return canonical;
}

/** The existing private-artifact acceptance can name either a real persistent
 * private directory or an encrypted, remotely acknowledged Actions destination.
 * This chooses the concrete effect; it grants no execution/budget admission.
 */
export function createBootstrapPrivateArtifacts({evidence, context, privateOutputDirectory, encryptedArtifacts}) {
  if (encryptedArtifacts === undefined) {
    return createPrivateArtifactSink({directory:validatePrivateArtifactLocation(evidence,privateOutputDirectory)});
  }
  const accepted = evidence?.processorSecurityAcceptance?.privateArtifactLocation;
  requireValue(privateOutputDirectory === undefined && accepted?.kind === ENCRYPTED_ARTIFACT_KIND
    && accepted.repository === PINS.repository && context?.repository === accepted.repository
    && context.sourceSha === context.reviewedSourceSha && typeof accepted.acceptanceRef === 'string'
    && accepted.acceptanceRef.trim());
  return createEncryptedArtifactSink({run:{repository:context.repository,runId:context.runId,
    runAttempt:context.runAttempt,sourceSha:context.sourceSha},
    recipientPublicKeyPem:encryptedArtifacts.recipientPublicKeyPem,
    expectedRecipientPublicKeySha256:accepted.recipientPublicKeySha256,
    retentionDays:accepted.retentionDays,artifactClient:encryptedArtifacts.artifactClient});
}

export async function prepareFirstSixBootstrap({config, evidence, context, responsesClient,
  sqlClient, privateOutputDirectory, encryptedArtifacts, inputPaths}) {
  try {
    const admission = validateSetupEvidence(config,evidence,context,'execution');
    // Verify the credential actually held by the supplied existing client. No
    // key is returned, printed, persisted or passed into any ledger operation.
    requireValue(typeof responsesClient?.apiKey === 'string'
      && hash(responsesClient.apiKey) === admission.identity.keyFingerprintSha256);
    const privateArtifacts = createBootstrapPrivateArtifacts({evidence,context,privateOutputDirectory,encryptedArtifacts});
    requireValue(inputPaths && ['packetDirectory','objectiveReferencePath','protocolPath'].every(k=>
      typeof inputPaths[k] === 'string' && isAbsolute(inputPaths[k])));
    const paths = structuredClone(inputPaths);
    const transport = createResponsesTransport(responsesClient);
    const [{createNeonSqlPort}, {createFrozenFirstSixExecutor,loadFrozenFirstSixInputs}] = await Promise.all([
      import('./pocket-monaco-neon-port.ts'), import('./pocket-monaco-first-six-executor.ts'),
    ]);
    const fixedPort = createNeonSqlPort(sqlClient,admission.neon,admission.identity);
    const port = {async rpc(name,args) {
      const result = await fixedPort.rpc(name,args);
      // The existing reviewed carry-in must equal the actual immutable SQL row.
      // New commitments are counted separately by the original bridge/core.
      if (name==='inspect_monaco_isolated_runner' && !result.error
        && result.data?.prior_exposure_microusd !== admission.priorExposureMicroUsd) {
        return {data:null,error:'BOUND_CARRY_IN_MISMATCH'};
      }
      return result;
    }};
    const executor = createFrozenFirstSixExecutor({port,ledgerKey:admission.ledgerKey,
      identity:admission.identity,transport,privateArtifacts});
    let used = false;
    return Object.freeze({kind:'UNMOUNTED_FIRST_SIX_BOOTSTRAP',status:'PREPARED',executionAdmitted:false,
      sourceSha:admission.identity.sourceSha,planSha256:PINS.planSha256,
      // No caller in this change invokes runOnce. Activation still requires the
      // protected branch/environment, frozen source+evidence and actual SQL/key
      // binding. All SQL checks remain active; declarations cannot replace them.
      async runOnce({signal} = {}) {
        if (used) return {status:'HOLD',reason:'BOOTSTRAP_ALREADY_USED'};
        used = true;
        if (signal?.aborted) return {status:'CANCELLED',reason:'CANCELLED_BEFORE_PACKET_READ'};
        try {
          const prepared = loadFrozenFirstSixInputs(paths);
          return await executor.run(prepared,{signal});
        } catch {
          return {status:'HOLD',reason:'BOUND_INPUT_OR_EXECUTION_REFUSED'};
        }
      }});
  } catch {
    return {kind:'UNMOUNTED_FIRST_SIX_BOOTSTRAP',status:'HOLD',executionAdmitted:false,
      reason:'Existing evidence, credential or private-artifact destination binding incomplete.'};
  }
}
