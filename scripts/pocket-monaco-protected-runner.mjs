/** Explicit one-shot entry point for the reviewed first-six protected run.
 * Import is inert. The CLI requires --run-once, immutable execution evidence,
 * the actual existing inference credential, real Neon authentication and one
 * run-bound encrypted input. Missing wiring never means execution permission.
 * Only the official artifact SDK's remote acknowledgement establishes retention.
 */
import {createHash} from 'node:crypto';
import {readFileSync, realpathSync} from 'node:fs';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {isAbsolute, join, relative, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {PINS, readEvidenceFile, validateSetupEvidence} from './pocket-monaco-setup-preflight.mjs';
import {createNeonSqlPort, neonConnectionOptions} from './pocket-monaco-neon-port.ts';
import {prepareFirstSixBootstrap} from './pocket-monaco-executor-bootstrap.mjs';
import {createInputHandoff, ENCRYPTED_ARTIFACT_KIND,
  recipientPublicKeySha256} from './pocket-monaco-confidential-transport.mjs';
import {unpackFirstSixBundle} from './pocket-monaco-first-six-bundle.mjs';

export const RUNTIME_PACKAGES = Object.freeze({openai:'6.48.0', pg:'8.16.3', '@actions/artifact':'6.3.1'});
export const MAX_INPUT_ENVELOPE_BYTES = Math.ceil(64 * 1024 * 1024 * 1.4 + 4096);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OPENAI_ORGANIZATION = 'org-5vLRRzXwcigUx96TVE0rI3RW';
const hash = value => createHash('sha256').update(value).digest('hex');
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const amount = value => Number.isSafeInteger(value) && value >= 0;
const requireValue = ok => { if (!ok) throw Error('PROTECTED_RUNNER_REFUSED'); };
const inside = (root, path) => {const rel = relative(root,path); return rel && !rel.startsWith('..') && !isAbsolute(rel);};
const json = path => JSON.parse(readFileSync(path, 'utf8'));

/** No package install or ambient module search. The protected workflow installs
 * its committed lock in this exact runner-temp child before invoking the CLI.
 */
export async function loadPinnedRuntime(runnerTemp) {
  requireValue(typeof runnerTemp === 'string' && isAbsolute(runnerTemp));
  const temporary = realpathSync(runnerTemp), root = realpathSync(join(temporary,'monaco-first-six-runtime'));
  requireValue(root === join(temporary,'monaco-first-six-runtime'));
  const require = createRequire(join(root,'package.json')), modules = {};
  for (const [name, version] of Object.entries(RUNTIME_PACKAGES)) {
    const packageRoot = realpathSync(join(root,'node_modules',name));
    const manifest = json(join(packageRoot,'package.json'));
    requireValue(inside(root,packageRoot) && manifest.version === version);
    // Artifact 6.3.1 is import-only ESM. require.resolve cannot resolve its
    // export; use the reviewed package's import/default target when present.
    const exported = manifest.exports?.['.'] ?? manifest.exports;
    const condition = exported?.import ?? exported?.default;
    const target = typeof condition === 'string' ? condition : condition?.default;
    const entry = realpathSync(typeof target === 'string' && target.startsWith('./')
      ? resolve(packageRoot,target) : require.resolve(name));
    requireValue(inside(packageRoot,entry));
    modules[name] = await import(pathToFileURL(entry).href);
  }
  const runtime = {versions:RUNTIME_PACKAGES,
    OpenAI:modules.openai.OpenAI ?? modules.openai.default?.OpenAI ?? modules.openai.default?.default ?? modules.openai.default,
    Client:modules.pg.Client ?? modules.pg.default?.Client,
    ArtifactClient:modules['@actions/artifact'].DefaultArtifactClient ?? modules['@actions/artifact'].default?.DefaultArtifactClient};
  requireValue(['OpenAI','Client','ArtifactClient'].every(key => typeof runtime[key] === 'function'));
  return Object.freeze(runtime);
}

export function loadProtectedRunnerInputs(env, sourceRoot = ROOT) {
  requireValue(typeof env.GITHUB_WORKSPACE === 'string' && isAbsolute(env.GITHUB_WORKSPACE));
  const evidenceRoot = resolve(env.GITHUB_WORKSPACE,'runner-evidence');
  const config = readEvidenceFile(evidenceRoot,'docs/monaco-126/isolated-runner/SETUP-CONFIG.json');
  const plan = readFileSync(resolve(sourceRoot,'docs/monaco-126/internal-diagnostics/FIRST-SIX-PROVIDER-PLAN.json'));
  requireValue(hash(plan) === PINS.planSha256 && JSON.parse(plan).model === PINS.model);
  const evidence = Object.fromEntries(['existingCredentialBinding','processorSecurityAcceptance',
    'authoritativeBudgetCarryIn'].map(key => [key,readEvidenceFile(evidenceRoot,config.requiredEvidence?.[key])]));
  const context = {repository:env.GITHUB_REPOSITORY, event:env.GITHUB_EVENT_NAME, ref:env.GITHUB_REF,
    runId:env.GITHUB_RUN_ID, runAttempt:env.GITHUB_RUN_ATTEMPT,
    reviewedSourceSha:env.REVIEWED_SETUP_SOURCE_SHA, sourceSha:env.CHECKED_OUT_SOURCE_SHA,
    reviewedEvidenceSha:env.REVIEWED_SETUP_EVIDENCE_SHA, evidenceSha:env.CHECKED_OUT_EVIDENCE_SHA};
  validateSetupEvidence(config,evidence,context,'execution');
  return {config,evidence,context};
}

function deliveryBinding(evidence, context) {
  const p = evidence.processorSecurityAcceptance, input = p.inputDelivery, output = p.privateArtifactLocation;
  requireValue(typeof context.runId === 'string' && /^[1-9][0-9]{0,19}$/.test(context.runId)
    && input?.kind === 'MONACO_RUN_BOUND_ENCRYPTED_INPUT_V1' && digest(input.bundleSha256)
    && Number.isSafeInteger(input.maxWaitMs) && input.maxWaitMs >= 1 && input.maxWaitMs <= 300000
    && typeof input.acceptanceRef === 'string' && input.acceptanceRef.trim()
    && output?.kind === ENCRYPTED_ARTIFACT_KIND && output.repository === PINS.repository
    && Number.isInteger(output.retentionDays) && output.retentionDays >= 1 && output.retentionDays <= 90
    && typeof output.acceptanceRef === 'string' && output.acceptanceRef.trim()
    && recipientPublicKeySha256(output.recipientPublicKeyPem) === output.recipientPublicKeySha256);
  return {input,output,run:Object.freeze({repository:context.repository,runId:context.runId,
    runAttempt:context.runAttempt,sourceSha:context.sourceSha})};
}

async function publishHandoff(artifactClient, publicHandoff) {
  let directory;
  try {
    directory = await mkdtemp(join(tmpdir(),'monaco-public-handoff-'));
    const path = join(directory,'public-input-handoff.json');
    await writeFile(path,JSON.stringify(publicHandoff),{flag:'wx',mode:0o600});
    const name = `monaco-input-handoff-${publicHandoff.runId}-${publicHandoff.sourceSha.slice(0,12)}`;
    const result = await artifactClient.uploadArtifact(name,[path],directory,{retentionDays:1,compressionLevel:0});
    const archiveSha256 = typeof result?.digest === 'string' ? result.digest.replace(/^sha256:/,'') : '';
    requireValue(Number.isSafeInteger(result?.id) && result.id > 0
      && Number.isSafeInteger(result?.size) && result.size > 0 && digest(archiveSha256));
    return Object.freeze({id:result.id,name,archiveSha256});
  } finally { if (directory) await rm(directory,{recursive:true,force:true}); }
}

/** A caller may supply a concrete hosted one-shot receiver. It receives public
 * run metadata only, never credentials. A late/ambiguous response cannot restart
 * execution. The default CLI receiver accepts one encrypted envelope on stdin.
 */
async function receiveEnvelopeOnce(receiver, args, parentSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parentSignal.addEventListener('abort',abort,{once:true});
  let timer;
  try {
    requireValue(!parentSignal.aborted);
    const deadline = new Promise((_,reject) => {
      controller.signal.addEventListener('abort',() => reject(Error('INPUT_DELIVERY_STOPPED')),{once:true});
      timer = setTimeout(abort,args.timeoutMs);
    });
    const bytes = await Promise.race([deadline,Promise.resolve().then(() => {
      requireValue(!controller.signal.aborted);
      return receiver({...args,signal:controller.signal,maxEnvelopeBytes:MAX_INPUT_ENVELOPE_BYTES});
    })]);
    requireValue(!controller.signal.aborted && bytes instanceof Uint8Array
      && bytes.length > 0 && bytes.length <= MAX_INPUT_ENVELOPE_BYTES);
    return bytes;
  } finally {
    clearTimeout(timer); parentSignal.removeEventListener('abort',abort); controller.abort();
  }
}

export function createStdinEnvelopeReceiver(stream) {
  let used = false;
  return async ({signal,maxEnvelopeBytes}) => {
    requireValue(!used && !stream.isTTY && !signal.aborted); used = true;
    return new Promise((resolvePromise,reject) => {
      const chunks = []; let size = 0, finished = false;
      const cleanup = () => {
        stream.off('data',onData); stream.off('end',onEnd); stream.off('error',onError);
        signal.removeEventListener('abort',onError); stream.pause();
      };
      const finish = (error,bytes) => {
        if (finished) return; finished = true; cleanup();
        if (error) reject(Error('INPUT_DELIVERY_REFUSED')); else resolvePromise(bytes);
      };
      const onError = () => finish(true);
      const onData = chunk => {
        if (!(chunk instanceof Uint8Array)) {finish(true); return;}
        size += chunk.length;
        if (size > maxEnvelopeBytes) {finish(true); return;}
        chunks.push(Buffer.from(chunk));
      };
      const onEnd = () => finish(size === 0,Buffer.concat(chunks,size));
      stream.on('data',onData); stream.once('end',onEnd); stream.once('error',onError);
      signal.addEventListener('abort',onError,{once:true});
      if (signal.aborted || stream.readableEnded || stream.destroyed) onError(); else stream.resume();
    });
  };
}

function publicSummary(result, {context,entered,authenticated,stage}) {
  const allowed = new Set(['HOLD','COMPLETED','CANCELLED','UNCERTAIN','TECHNICAL_FAILURE']);
  let status = allowed.has(result?.status) ? result.status : entered ? 'UNCERTAIN' : 'HOLD';
  const attempts = amount(result?.transportSendAttempts) && result.transportSendAttempts <= 18
    ? result.transportSendAttempts : entered ? null : 0;
  const retained = Array.isArray(result?.cases)
    ? new Set(result.cases.filter(row => /^d00[1-6]$/.test(row?.caseId)
      && row.status === 'DIAGNOSTIC_RETAINED').map(row => row.caseId)).size : 0;
  if (status === 'COMPLETED' && (attempts === null || attempts < 6 || retained !== 6
    || result.cases.length !== 6)) status = 'UNCERTAIN';
  return {kind:'MONACO_PROTECTED_FIRST_SIX_RUN',status,stage,
    sourceSha:context?.sourceSha ?? null,evidenceSha:context?.evidenceSha ?? null,
    ledgerAuthenticationVerified:authenticated,bootstrapInvocations:entered ? 1 : 0,
    transportSendAttempts:attempts,providerMetadataRequests:0,
    diagnosticCasesRetained:retained,
    providerAuthenticity:'NOT_ATTESTED_BY_CLI_SUMMARY',financiallySettled:false,actualMicroUsd:null};
}

/** Injection seams are for offline composition tests and a reviewed hosted
 * input receiver. The production entry always loads the pinned official SDKs
 * and the real bootstrap; a synthetic result establishes no hosted evidence.
 */
export async function runProtectedFirstSix(args, {prepareBootstrap = prepareFirstSixBootstrap} = {}) {
  let sqlClient, unpacked, entered = false, authenticated = false, stage = 'EVIDENCE', context;
  const controller = new AbortController(), stop = () => controller.abort();
  args.signal?.addEventListener('abort',stop,{once:true});
  if (args.signal?.aborted) stop();
  try {
    const snapshot = structuredClone({config:args.config,evidence:args.evidence,context:args.context});
    const {config,evidence} = snapshot;
    const admission = validateSetupEvidence(config,evidence,snapshot.context,'execution');
    context = snapshot.context;
    const {input,output,run} = deliveryBinding(evidence,context), runtime = args.runtime;
    requireValue(Object.entries(RUNTIME_PACKAGES).every(([name,version]) => runtime?.versions?.[name] === version)
      && ['OpenAI','Client','ArtifactClient'].every(key => typeof runtime?.[key] === 'function')
      && typeof args.receiveInputOnce === 'function' && typeof prepareBootstrap === 'function');
    const key = args.credentials?.existingKey, password = args.credentials?.ledgerPassword;
    requireValue(typeof key === 'string' && key.trim() && hash(key) === admission.identity.keyFingerprintSha256
      && typeof password === 'string' && password.length >= 12 && !controller.signal.aborted);
    stage = 'LEDGER_AUTHENTICATION';
    sqlClient = new runtime.Client(neonConnectionOptions(admission.neon,password));
    sqlClient.on('error',stop); // Discard driver text, which can contain credentials.
    await sqlClient.connect();
    requireValue(!controller.signal.aborted);
    const port = createNeonSqlPort(sqlClient,admission.neon,admission.identity);
    const inspection = await port.rpc('inspect_monaco_isolated_runner',
      {p_key:admission.ledgerKey,p_identity:admission.identity});
    const balance = inspection?.data;
    requireValue(!inspection?.error && balance?.binding_matches === true && balance.setup_only === true
      && balance.ledger_key === admission.ledgerKey
      && [balance.prior_exposure_microusd,balance.new_commitments_microusd,balance.remaining_microusd].every(amount)
      && balance.prior_exposure_microusd === admission.priorExposureMicroUsd
      && balance.prior_exposure_microusd + balance.new_commitments_microusd + balance.remaining_microusd === PINS.cap
      && balance.remaining_microusd >= PINS.requiredHeadroom && !controller.signal.aborted);
    authenticated = true;
    const responsesClient = new runtime.OpenAI({apiKey:key,project:PINS.project,organization:OPENAI_ORGANIZATION,
      baseURL:'https://api.openai.com/v1',maxRetries:0,timeout:60000,logLevel:'off'});
    const artifactClient = new runtime.ArtifactClient();
    requireValue(typeof artifactClient.uploadArtifact === 'function');
    stage = 'ENCRYPTED_INPUT';
    const handoff = createInputHandoff({run,expectedBundleSha256:input.bundleSha256});
    const handoffArtifact = await publishHandoff(artifactClient,handoff.publicHandoff);
    const envelope = await receiveEnvelopeOnce(args.receiveInputOnce,{publicHandoff:handoff.publicHandoff,
      handoffArtifact,run,expectedBundleSha256:input.bundleSha256,timeoutMs:input.maxWaitMs},controller.signal);
    let plaintext;
    try {
      plaintext = handoff.openOnce(envelope);
      unpacked = unpackFirstSixBundle({bytes:plaintext,expectedBundleSha256:input.bundleSha256});
    } finally { plaintext?.fill(0); }
    requireValue(!controller.signal.aborted);
    stage = 'BOOTSTRAP';
    const bootstrap = await prepareBootstrap({config,evidence,context,responsesClient,sqlClient,
      encryptedArtifacts:{artifactClient,recipientPublicKeyPem:output.recipientPublicKeyPem},
      inputPaths:unpacked.inputPaths});
    requireValue(bootstrap?.status === 'PREPARED' && typeof bootstrap.runOnce === 'function'
      && !controller.signal.aborted);
    stage = 'EXECUTION'; entered = true;
    const result = await bootstrap.runOnce({signal:controller.signal});
    return publicSummary(result,{context,entered,authenticated,stage});
  } catch {
    return publicSummary({status:entered ? 'UNCERTAIN' : controller.signal.aborted ? 'CANCELLED' : 'HOLD'},
      {context,entered,authenticated,stage});
  } finally {
    controller.abort(); args.signal?.removeEventListener('abort',stop);
    try { unpacked?.cleanup(); } catch { /* Unique private temporary input directory only. */ }
    if (sqlClient) { try { await sqlClient.end(); } catch { /* Never expose driver errors. */ } }
  }
}

async function main() {
  const controller = new AbortController(), stop = () => controller.abort();
  process.once('SIGINT',stop); process.once('SIGTERM',stop);
  try {
    requireValue(process.argv.length === 3 && process.argv[2] === '--run-once');
    const input = loadProtectedRunnerInputs(process.env);
    // No OPENAI_API_KEY fallback and no metadata-only credential path exists.
    const result = await runProtectedFirstSix({...input,runtime:await loadPinnedRuntime(process.env.RUNNER_TEMP),
      credentials:{existingKey:process.env.MONACO_FIRST_SIX_OPENAI_API_KEY,
        ledgerPassword:process.env.MONACO_FIRST_SIX_LEDGER_KEY},
      receiveInputOnce:createStdinEnvelopeReceiver(process.stdin),signal:controller.signal});
    process.stdout.write(JSON.stringify(result)+'\n');
    if (result.status !== 'COMPLETED') process.exitCode = 1;
  } catch {
    process.stdout.write(JSON.stringify(publicSummary(null,
      {entered:false,authenticated:false,stage:'CONFIGURATION'}))+'\n');
    process.exitCode = 1;
  } finally { process.off('SIGINT',stop); process.off('SIGTERM',stop); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
