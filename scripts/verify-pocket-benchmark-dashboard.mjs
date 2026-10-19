import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ORG = 'org-5vLRRzXwcigUx96TVE0rI3RW';
const PROJECT = 'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI';
const KEY = 'key_EjND5GXtuqF2K0hp';
const OWNER = 'user-DlYoRdGCCPjv7Bk5iEjduePV';
const MODEL = 'gpt-5-mini-2025-08-07';
const CANDIDATE = '93f3fe282c6cab0196812aec989dddaa915bb986';
const BACKEND = 'https://pxlqvaddvghjjhenqmdh.supabase.co';
const MODEL_URL = 'https://api.openai.com/v1/models/' + MODEL;
const MAX_AGE_MS = 60 * 60 * 1000;
const EVIDENCE_SHA256 = '76154bf9fcbbf06c091350452a0dd1d9074aaeecfd15ceb1ebc80a1ee3ca1177';
const EVIDENCE_URL = new URL('../docs/quality/pocket-dashboard-evidence-20261019.json', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const blocked = code => { throw new Error(code); };

// This is a separate review tool. No application route or financial gate imports it.
// It never reads OPENAI_ADMIN_KEY, dotenv files, browser tokens or runtime secrets.
export function checkDashboardRuntimeEnvironment(env) {
  if (env.POCKET_BENCHMARK_RUNTIME_METADATA_ENABLED !== 'true'
      || env.POCKET_BENCHMARK_PILOT_ENABLED !== 'false'
      || env.POCKET_REAL_BENCHMARK_DISPATCH !== 'false'
      || env.POCKET_BENCHMARK_ACCOUNTING_MODE !== 'full-reservation-v2'
      || env.OPENAI_BASE_URL
      || env.OPENAI_ORG_ID !== ORG || env.OPENAI_PROJECT_ID !== PROJECT
      || env.POCKET_BENCHMARK_OPENAI_PROJECT_ID !== PROJECT
      || env.POCKET_BENCHMARK_CANDIDATE_SHA !== CANDIDATE
      || env.OPENAI_POCKET_MODEL !== MODEL || env.OPENAI_POCKET_ANNOTATION_MODEL !== MODEL
      || env.NEXT_PUBLIC_SUPABASE_URL !== BACKEND) blocked('INVALID_ISOLATED_CONFIGURATION');
  const credential = env.OPENAI_API_KEY;
  if (typeof credential !== 'string' || !credential.startsWith('sk-proj-')
      || credential.length < 32 || /\s/.test(credential)) blocked('EXISTING_PROJECT_CREDENTIAL_UNAVAILABLE');
}

export function reviewDashboardEvidence(evidence, credential, now = Date.now()) {
  const observedAt = Date.parse(evidence?.observedAt);
  if (!Number.isFinite(now) || !Number.isFinite(observedAt)
      || observedAt > now || now - observedAt > MAX_AGE_MS) blocked('DASHBOARD_EVIDENCE_EXPIRED_OR_FUTURE');
  if (evidence?.schemaVersion !== 1
      || evidence.evidenceKind !== 'AUTHENTICATED_OWNER_DASHBOARD_ATTESTATION'
      || evidence.organisationId !== ORG || evidence.organisationName !== 'Personal'
      || evidence.observer?.userId !== OWNER || evidence.observer?.organisationRole !== 'Owner'
      || evidence.project?.id !== PROJECT || evidence.project?.name !== 'bullseye private pilot'
      || evidence.project?.status !== 'active' || evidence.project?.defaultServiceTier !== 'Standard'
      || evidence.inventory?.complete !== true || !Array.isArray(evidence.inventory.filters)
      || evidence.inventory.filters.length !== 0 || !Array.isArray(evidence.inventory.keys)
      || evidence.inventory.visibleResults !== evidence.inventory.keys.length
      || !evidence.inventory.keys.length) blocked('INCOMPLETE_DASHBOARD_EVIDENCE');
  if (!Array.isArray(evidence.sources) || !evidence.sources.includes('https://platform.openai.com/api-keys')
      || !evidence.sources.includes('https://platform.openai.com/settings/' + PROJECT)
      || evidence.sources.some(source => {
        try { const url = new URL(source); return url.origin !== 'https://platform.openai.com'
          || url.username || url.password || url.search || url.hash; } catch { return true; }
      })) blocked('INVALID_DASHBOARD_SOURCE');
  const ids = new Set();
  const matches = [];
  for (const key of evidence.inventory.keys) {
    if (!key || typeof key.id !== 'string' || ids.has(key.id)
        || !['Active', 'Revoked'].includes(key.status)) blocked('INVALID_DASHBOARD_INVENTORY');
    ids.add(key.id);
    if (key.status !== 'Active') continue;
    if (key.expiresAt !== null && (!Number.isSafeInteger(key.expiresAt)
        || key.expiresAt * 1000 <= now)) blocked('INVALID_OR_EXPIRED_DASHBOARD_KEY');
    const mask = typeof key.redactedValue === 'string'
      && /^(sk-)(?:\.{3}|…)([A-Za-z0-9_-]{4,16})$/.exec(key.redactedValue);
    if (!mask) blocked('INVALID_DASHBOARD_REDACTION');
    if (credential.startsWith(mask[1]) && credential.endsWith(mask[2])) matches.push(key);
  }
  if (matches.length !== 1 || matches[0].id !== KEY || matches[0].createdBy !== OWNER
      || matches[0].name !== 'pocket bullseye staging') blocked('PROJECT_KEY_CORRELATION_FAILED');
  return { observedAt: new Date(observedAt).toISOString(), expiresAt: new Date(observedAt + MAX_AGE_MS).toISOString() };
}

function readPinnedEvidence() {
  try {
    const bytes = readFileSync(EVIDENCE_URL);
    if (bytes.byteLength > 32768 || sha(bytes) !== EVIDENCE_SHA256) blocked('DASHBOARD_EVIDENCE_DIGEST_MISMATCH');
    return JSON.parse(bytes.toString('utf8'));
  } catch { blocked('PINNED_DASHBOARD_EVIDENCE_UNAVAILABLE'); }
}

export async function verifyPocketBenchmarkDashboard() {
  const env = process.env;
  checkDashboardRuntimeEnvironment(env);
  const evidence = readPinnedEvidence();
  const observation = reviewDashboardEvidence(evidence, env.OPENAI_API_KEY);
  let response, body, requestId;
  try {
    response = await fetch(MODEL_URL, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY,
        'OpenAI-Organization': ORG, 'OpenAI-Project': PROJECT }
    });
    if (!response.ok || response.redirected) blocked('MODEL_METADATA_REJECTED');
    const orgHeader = response.headers.get('openai-organization');
    const projectHeader = response.headers.get('openai-project');
    if ((orgHeader && orgHeader !== ORG) || (projectHeader && projectHeader !== PROJECT)) blocked('MODEL_METADATA_REJECTED');
    requestId = response.headers.get('x-request-id');
    if (!requestId || !/^[A-Za-z0-9_-]{1,128}$/.test(requestId)
        || requestId.startsWith('sk-') || requestId.includes(env.OPENAI_API_KEY)) blocked('MODEL_METADATA_REJECTED');
    const text = await response.text();
    if (text.length > 262144) blocked('MODEL_METADATA_REJECTED');
    body = JSON.parse(text);
    if (body?.id !== MODEL || body?.object !== 'model') blocked('MODEL_METADATA_REJECTED');
    // Evidence and effective credential permissions must still be current on completion.
    reviewDashboardEvidence(evidence, env.OPENAI_API_KEY);
  } catch { blocked('MODEL_METADATA_GET_FAILED'); }
  return {
    schemaVersion: 2, status: 'VERIFIED_DASHBOARD_CORRELATION',
    verificationScope: 'METADATA_ONLY_NO_INFERENCE', organisationId: ORG, projectId: PROJECT,
    keyTrackingId: KEY, keyFingerprintSha256: sha(env.OPENAI_API_KEY), model: MODEL,
    candidateSha: CANDIDATE, sourceBaseSha: 'b02d5dd7a44c61fbdb6d99c60e365700d9f66d92',
    keyTrackingVerification: 'UNIQUE_REDACTED_DASHBOARD_AND_PROJECT_AUTHORIZATION',
    evidenceKind: evidence.evidenceKind, evidenceSha256: EVIDENCE_SHA256,
    dashboardObservedAt: observation.observedAt, dashboardExpiresAt: observation.expiresAt,
    providerMetadataRequestId: requestId, verifiedAt: new Date().toISOString(), requiredServiceTier: 'default',
    assurance: 'Reviewed dashboard correlation plus authenticated scoped model GET; not provider-signed key identity.',
    integrationStatus: 'STANDALONE_REVIEW_ONLY', liveSitesBindingVerified: false,
    releaseAuthorized: false, paidDispatchEnabled: false, financiallySettled: false,
    actualMicrousd: null, providerInferenceRequests: 0
  };
}

const REASONS = new Set(['INVALID_ISOLATED_CONFIGURATION', 'EXISTING_PROJECT_CREDENTIAL_UNAVAILABLE',
  'DASHBOARD_EVIDENCE_EXPIRED_OR_FUTURE', 'INCOMPLETE_DASHBOARD_EVIDENCE', 'INVALID_DASHBOARD_SOURCE',
  'INVALID_DASHBOARD_INVENTORY', 'INVALID_OR_EXPIRED_DASHBOARD_KEY', 'INVALID_DASHBOARD_REDACTION',
  'PROJECT_KEY_CORRELATION_FAILED', 'PINNED_DASHBOARD_EVIDENCE_UNAVAILABLE', 'MODEL_METADATA_GET_FAILED']);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== '--metadata-only') blocked('INVALID_ISOLATED_CONFIGURATION');
    console.log(JSON.stringify(await verifyPocketBenchmarkDashboard()));
  } catch (error) {
    const reason = REASONS.has(error?.message) ? error.message : 'METADATA_VERIFICATION_FAILED';
    console.error(JSON.stringify({ status: 'BLOCKED', reason, providerInferenceRequests: 0, releaseAuthorized: false }));
    process.exitCode = 1;
  }
}
