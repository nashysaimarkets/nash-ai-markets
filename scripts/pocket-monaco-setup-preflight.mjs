/**
 * Inert, setup-only preflight for the already approved protected runner.
 * No OpenAI client, HTTP calls, provider dispatch, secret writes or ledger writes.
 * Reviewed source and evidence must be pinned before the invocation branch exists.
 */
import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PINS = Object.freeze({
  repository: 'nashysaimarkets/nash-ai-markets',
  branch: 'monaco-first-six-inference-126-20261021',
  environment: 'monaco-first-six-inference',
  project: 'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI',
  keyTrackingId: 'key_EjND5GXtuqF2K0hp',
  model: 'gpt-5-mini-2025-08-07',
  planSha256: '9490af55e554f84d63d7afc1fe2442298afd6cdbe8f356d6d8d0517504420ff0',
  paidScopeReceipt: 'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6309459418',
  backend: 'neon:bitter-grass-28096464/br-aged-mode-zaa9u7lr/monaco_ledger',
  organization: 'org-icy-butterfly-11039021',
  projectId: 'bitter-grass-28096464',
  branchId: 'br-aged-mode-zaa9u7lr',
  host: 'ep-silent-fire-za1s230f.c-2.eu-west-2.aws.neon.tech',
  database: 'monaco_ledger',
  role: 'monaco_ledger_runner',
  cap: 5000000, requiredHeadroom: 1917600,
});
const hash = value => createHash('sha256').update(value).digest('hex');
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const amount = value => Number.isSafeInteger(value) && value >= 0;
const requireFact = (ok, code) => { if (!ok) throw new Error(code); };
const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Evidence files are existing SETUP-CONFIG requiredEvidence references, not
 * new permissions. Their authenticity requires the reviewed immutable source.
 * These fields mirror the existing binding, processor and carry-in requirements.
 */
export function validateSetupEvidence(config, evidence, context, phase = 'setup') {
  requireFact(['setup', 'execution'].includes(phase), 'SETUP_PHASE_INVALID');
  requireFact(context.repository === PINS.repository && context.event === 'push' &&
    context.ref === 'refs/heads/' + PINS.branch && context.runAttempt === '1' &&
    commit(context.reviewedSourceSha) && context.sourceSha === context.reviewedSourceSha &&
    commit(context.reviewedEvidenceSha) && context.evidenceSha === context.reviewedEvidenceSha,
  'SETUP_INVOCATION_NOT_BOUND');
  requireFact(config.environment === PINS.environment && config.invocationBranch === PINS.branch &&
    config.reviewer === 'nashysaimarkets' && config.administratorBypass === false &&
    config.repositoryTokenPermissions?.contents === 'read' &&
    Object.keys(config.repositoryTokenPermissions).length === 1 &&
    config.concurrency?.group === 'monaco-first-six-existing-five-dollar-allowance' &&
    config.concurrency?.cancelInProgress === false &&
    config.concurrency?.maxChartsInFlight === 1 && config.concurrency?.maxCallsInFlight === 1 &&
    config.acceptedRunAttempt === 1 && config.realDispatchEnabled === (phase === 'execution'),
  'SETUP_PROTECTION_SCOPE_MISMATCH');
  if (phase === 'execution') requireFact(config.paidScopeReceipt === PINS.paidScopeReceipt,
    'EXECUTION_EXISTING_PAID_SCOPE_MISMATCH');
  const l = config.ledger, s = config.secrets;
  requireFact(l?.provider === 'Neon' && l.backendRef === PINS.backend &&
    l.organisationId === PINS.organization && l.projectId === PINS.projectId &&
    l.branchId === PINS.branchId && l.endpointHost === PINS.host &&
    l.databaseName === PINS.database && l.runtimeRole === PINS.role &&
    l.maximumNewMonthlyCostUsd === 0 && l.plan === 'free' &&
    s?.newOpenAIKeyAllowed === false &&
    s.existingInferenceKeyEnvironmentSecret === 'MONACO_FIRST_SIX_OPENAI_API_KEY' &&
    s.isolatedLedgerCredentialEnvironmentSecret === 'MONACO_FIRST_SIX_LEDGER_KEY' &&
    s.existingInferenceKeyTrackingId === PINS.keyTrackingId &&
    s.existingInferenceProject === PINS.project &&
    config.planSha256 === PINS.planSha256,
  'SETUP_IDENTITY_SCOPE_MISMATCH');
  const b = evidence?.existingCredentialBinding;
  requireFact(b?.verified === true && b.environment === PINS.environment &&
    b.sourceSha === context.reviewedSourceSha && b.backendRef === PINS.backend &&
    b.projectRef === PINS.project && b.keyTrackingId === PINS.keyTrackingId &&
    digest(b.keyFingerprintSha256) && b.planSha256 === PINS.planSha256 &&
    typeof b.ledgerKey === 'string' && b.ledgerKey.length > 0 &&
    b.ledgerKey.length <= 200 && /^[a-zA-Z0-9:_-]+$/.test(b.ledgerKey) &&
    digest(b.controlPlaneEvidenceSha256),
  'SETUP_EXISTING_CREDENTIAL_BINDING_UNVERIFIED');
  const p = evidence?.processorSecurityAcceptance;
  requireFact(p?.securityApprovalRef && ['onBehalfAccepted', 'retentionAccepted',
    'trainingAccepted', 'territoryAccepted', 'privateArtifactsAccepted'].every(k => p[k] === true),
  'SETUP_PROCESSOR_SECURITY_UNVERIFIED');
  const budget = evidence?.authoritativeBudgetCarryIn;
  requireFact(budget?.evidenceComplete === true && budget.aggregateCapMicroUsd === PINS.cap &&
    budget.historicalAccountingKeptSeparate === true && budget.cashAllowanceApproved === true &&
    [budget.spentMicroUsd, budget.reservedMicroUsd, budget.unresolvedMicroUsd].every(amount),
  'SETUP_BUDGET_UNKNOWN');
  const prior = budget.spentMicroUsd + budget.reservedMicroUsd + budget.unresolvedMicroUsd;
  requireFact(Number.isSafeInteger(prior) && PINS.cap - prior >= PINS.requiredHeadroom,
    'SETUP_AGGREGATE_HEADROOM_INSUFFICIENT');
  return {
    identity: {environment: b.environment, sourceSha: b.sourceSha, backendRef: b.backendRef,
      projectRef: b.projectRef, keyTrackingId: b.keyTrackingId,
      keyFingerprintSha256: b.keyFingerprintSha256, planSha256: b.planSha256},
    neon: {organizationId: PINS.organization, projectId: PINS.projectId,
      branchId: PINS.branchId, endpointHost: PINS.host, databaseName: PINS.database,
      roleName: PINS.role, controlPlaneEvidenceSha256: b.controlPlaneEvidenceSha256},
    ledgerKey: b.ledgerKey, priorExposureMicroUsd: prior,
  };
}

/** No retry, query mutation, metadata or inference. Driver/credential errors are
 * deliberately discarded; their messages can contain connection secrets.
 */
export async function inspectSetupLedger(config, evidence, context, credentials, dependencies) {
  let client;
  try {
    const admission = validateSetupEvidence(config, evidence, context);
    requireFact(typeof credentials?.existingKey === 'string' &&
      hash(credentials.existingKey) === admission.identity.keyFingerprintSha256,
    'SETUP_EXISTING_KEY_MISMATCH');
    requireFact(typeof credentials?.ledgerPassword === 'string' &&
      credentials.ledgerPassword.length >= 24, 'SETUP_LEDGER_CREDENTIAL_MISSING');
    const options = dependencies.connectionOptions(admission.neon, credentials.ledgerPassword);
    // The existing inspection RPC takes FOR UPDATE locks to read an atomic
    // balance; a read-only transaction would reject it. This entry point only
    // invokes that fixed non-mutating RPC, never claim/submit/seed operations.
    client = dependencies.createClient(options);
    await client.connect();
    const port = dependencies.createPort(client, admission.neon, admission.identity);
    const result = await port.rpc('inspect_monaco_isolated_runner',
      {p_key: admission.ledgerKey, p_identity: admission.identity});
    const balance = result?.data;
    requireFact(!result?.error && balance?.binding_matches === true &&
      balance.ledger_key === admission.ledgerKey && balance.setup_only === true &&
      [balance.prior_exposure_microusd, balance.new_commitments_microusd,
        balance.remaining_microusd].every(amount) &&
      balance.prior_exposure_microusd === admission.priorExposureMicroUsd &&
      balance.prior_exposure_microusd + balance.new_commitments_microusd +
        balance.remaining_microusd === PINS.cap &&
      balance.remaining_microusd >= PINS.requiredHeadroom,
    'SETUP_LEDGER_ADMISSION_UNVERIFIED');
    return {kind: 'MONACO_SETUP_ONLY_INSPECTION', status: 'PASS',
      sourceSha: admission.identity.sourceSha, evidenceSha: context.reviewedEvidenceSha,
      existingKeyFingerprintMatched: true,
      ledgerIdentityVerified: true, remainingMicroUsd: balance.remaining_microusd,
      providerMetadataRequests: 0, providerInferenceRequests: 0, realDispatchEnabled: false};
  } catch {
    return {kind: 'MONACO_SETUP_ONLY_INSPECTION', status: 'HOLD',
      reason: 'Setup evidence, credential binding or non-mutating ledger inspection failed; preserve state and reconcile without retry.',
      providerMetadataRequests: 0, providerInferenceRequests: 0, realDispatchEnabled: false};
  } finally {
    if (client) { try { await client.end(); } catch { /* Never print driver errors. */ } }
  }
}

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
export function readEvidenceFile(root, path) {
  requireFact(typeof path === 'string' &&
    /^(docs\/monaco-126\/isolated-runner|qa\/isolated-runner)\/[a-zA-Z0-9_./-]+\.json$/.test(path) &&
    !path.split('/').includes('..'), 'SETUP_EVIDENCE_PATH_UNBOUND');
  const actual = realpathSync(resolve(root, path));
  const rel = relative(realpathSync(root), actual);
  requireFact(rel && !rel.startsWith('..') && !isAbsolute(rel), 'SETUP_EVIDENCE_PATH_ESCAPES');
  return readJson(actual);
}
function loadInput() {
  // Evidence is committed after the executable source exists, then pinned
  // separately in the reviewed invocation workflow. Never require a file to
  // embed the hash of its own enclosing commit.
  requireFact(typeof process.env.GITHUB_WORKSPACE === 'string' && isAbsolute(process.env.GITHUB_WORKSPACE),
    'SETUP_EVIDENCE_ROOT_UNBOUND');
  const evidenceRoot = resolve(process.env.GITHUB_WORKSPACE, 'runner-evidence');
  const config = readJson(resolve(evidenceRoot, 'docs/monaco-126/isolated-runner/SETUP-CONFIG.json'));
  const plan = readFileSync(resolve(ROOT, 'docs/monaco-126/internal-diagnostics/FIRST-SIX-PROVIDER-PLAN.json'));
  requireFact(hash(plan) === PINS.planSha256 && JSON.parse(plan).model === PINS.model,
    'SETUP_FROZEN_PLAN_MISMATCH');
  const evidence = Object.fromEntries(['existingCredentialBinding', 'processorSecurityAcceptance',
    'authoritativeBudgetCarryIn'].map(k => [k, readEvidenceFile(evidenceRoot, config.requiredEvidence?.[k])]));
  const context = {repository: process.env.GITHUB_REPOSITORY, event: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    reviewedSourceSha: process.env.REVIEWED_SETUP_SOURCE_SHA, sourceSha: process.env.CHECKED_OUT_SOURCE_SHA,
    reviewedEvidenceSha: process.env.REVIEWED_SETUP_EVIDENCE_SHA, evidenceSha: process.env.CHECKED_OUT_EVIDENCE_SHA};
  validateSetupEvidence(config, evidence, context);
  return {config, evidence, context};
}
async function main() {
  try {
    const mode = process.argv[2];
    requireFact(process.argv.length === 3 && ['--check-config', '--inspect-ledger'].includes(mode),
      'SETUP_MODE_INVALID');
    const {config, evidence, context} = loadInput();
    if (mode === '--check-config') {
      process.stdout.write(JSON.stringify({kind: 'MONACO_SETUP_ONLY_CONFIG', status: 'PASS',
        realDispatchEnabled: false}) + '\n'); return;
    }
    // The workflow injects secrets only for this step, after immutable checks.
    requireFact(typeof process.env.RUNNER_TEMP === 'string' && isAbsolute(process.env.RUNNER_TEMP),
      'SETUP_DRIVER_PATH_UNBOUND');
    const {default: pg} = await import(pathToFileURL(resolve(process.env.RUNNER_TEMP,
      'monaco-setup/node_modules/pg/lib/index.js')).href);
    const port = await import('./pocket-monaco-neon-port.ts');
    const result = await inspectSetupLedger(config, evidence, context,
      {existingKey: process.env.MONACO_FIRST_SIX_OPENAI_API_KEY,
        ledgerPassword: process.env.MONACO_FIRST_SIX_LEDGER_KEY},
      {createClient: options => new pg.Client(options),
        connectionOptions: port.neonConnectionOptions, createPort: port.createNeonSqlPort});
    process.stdout.write(JSON.stringify(result) + '\n');
    if (result.status !== 'PASS') process.exitCode = 1;
  } catch {
    process.stdout.write(JSON.stringify({kind: 'MONACO_SETUP_ONLY_INSPECTION', status: 'HOLD',
      reason: 'Reviewed source or required setup evidence is absent or invalid.',
      providerMetadataRequests: 0, providerInferenceRequests: 0, realDispatchEnabled: false}) + '\n');
    process.exitCode = 1;
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

