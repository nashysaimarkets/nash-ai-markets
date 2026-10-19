import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ORG = 'org-5vLRRzXwcigUx96TVE0rI3RW';
const PROJECT = 'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI';
const OWNER = 'user-DlYoRdGCCPjv7Bk5iEjduePV';
const MODEL = 'gpt-5-mini-2025-08-07';
const NAME = 'Pocket Bullseye Metadata Verification';
const SCOPES = ['api.model.read', 'model.read'];
const EXISTING_IDS = ['key_EjND5GXtuqF2K0hp', 'key_HTa1GVGxw3MQq2QZ'];
const EXISTING_MASK_SUFFIXES = ['aBgA', 'EQUA'];
const PLAN_URL = new URL('../docs/quality/pocket-temporary-key-plan-20261019.json', import.meta.url);
const PLAN_SHA256 = '48d04a8651afdbf50c4ed65d5a1747aa131f4c155b607a0d6b7eb859ab9bde21';
const hash = value => createHash('sha256').update(value).digest('hex');
const stop = reason => { throw new Error(reason); };
const exactScopes = value => Array.isArray(value) && value.length === 2
  && [...value].sort().join(',') === SCOPES.join(',');

// No caller-controlled manifest path or digest. Replace the draft only after
// actual owner approval, creation and independent fresh dashboard review.
export function readTemporaryKeyPlan() {
  try {
    const bytes = readFileSync(PLAN_URL);
    if (bytes.byteLength > 32768 || hash(bytes) !== PLAN_SHA256) stop('TEMPORARY_PLAN_NOT_PINNED');
    return JSON.parse(bytes.toString('utf8'));
  } catch { stop('TEMPORARY_PLAN_NOT_PINNED'); }
}

export function reviewTemporaryKeyPlan(plan, now = Date.now()) {
  if (plan?.state !== 'CREATED_AND_INDEPENDENTLY_REVIEWED') stop('TEMPORARY_KEY_NOT_CREATED_OR_REVIEWED');
  if (plan.schemaVersion !== 1 || plan.purpose !== 'TEMPORARY_METADATA_ACCESS_ONLY'
      || plan.organisationId !== ORG || plan.projectId !== PROJECT
      || plan.proposal?.name !== NAME || plan.proposal?.ownerType !== 'user'
      || plan.proposal?.expirationSeconds !== 86400 || !exactScopes(plan.proposal?.scopes)
      || plan.liveSitesBindingVerified !== false || plan.releaseAuthorized !== false) stop('INVALID_TEMPORARY_PLAN');
  const key = plan.key;
  if (!key || typeof key.id !== 'string' || !/^key_[A-Za-z0-9]+$/.test(key.id)
      || EXISTING_IDS.includes(key.id) || key.name !== NAME || key.status !== 'Active'
      || key.createdBy !== OWNER || !exactScopes(key.scopes)) stop('INVALID_TEMPORARY_KEY_IDENTITY_OR_SCOPES');
  const times = [plan.ownerApprovalAt, key.createdAt, plan.observedAt, plan.reviewedAt, key.expiresAt]
    .map(value => typeof value === 'string' ? Date.parse(value) : Number.NaN);
  const [approved, created, observed, reviewed, expires] = times;
  if (!Number.isFinite(now) || times.some(value => !Number.isFinite(value))
      || approved > created || created > observed || observed > reviewed || reviewed > now
      || now - observed > 3600000 || expires <= now || expires <= created || expires - created > 86400000
      || typeof plan.observedBy !== 'string' || !plan.observedBy.trim()
      || typeof plan.reviewedBy !== 'string' || !plan.reviewedBy.trim()
      || plan.observedBy.trim() === plan.reviewedBy.trim()) stop('TEMPORARY_KEY_REVIEW_OR_EXPIRY_INVALID');
  const mask = typeof key.redactedValue === 'string'
    && /^(sk-)(?:\.{3}|…)([A-Za-z0-9_-]{4,16})$/.exec(key.redactedValue);
  if (!mask || EXISTING_MASK_SUFFIXES.includes(mask[2])) stop('TEMPORARY_KEY_COULD_MATCH_EXISTING_KEY');
  if (!Array.isArray(plan.sources) || plan.sources.length !== 2
      || !plan.sources.includes('https://platform.openai.com/api-keys')
      || !plan.sources.includes('https://platform.openai.com/settings/' + PROJECT)) stop('INVALID_TEMPORARY_PLAN');
  return { prefix: mask[1], suffix: mask[2] };
}

export function checkTemporaryCredential(env, plan) {
  const mask = reviewTemporaryKeyPlan(plan);
  // Separate input name prevents reuse of either old project or admin credentials.
  if (env.OPENAI_API_KEY || env.OPENAI_ADMIN_KEY || env.OPENAI_BASE_URL) stop('USE_TEMPORARY_METADATA_INPUT_ONLY');
  const value = env.OPENAI_METADATA_VERIFICATION_KEY;
  if (typeof value !== 'string' || !value.startsWith('sk-proj-') || value.length < 32 || /\s/.test(value)
      || !value.startsWith(mask.prefix) || !value.endsWith(mask.suffix)
      || EXISTING_MASK_SUFFIXES.some(suffix => value.endsWith(suffix))) stop('TEMPORARY_CREDENTIAL_MISMATCH');
}

export async function verifyTemporaryMetadataKey() {
  const plan = readTemporaryKeyPlan();
  const env = process.env;
  checkTemporaryCredential(env, plan);
  let requestId;
  try {
    const response = await fetch('https://api.openai.com/v1/models/' + MODEL, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Bearer ' + env.OPENAI_METADATA_VERIFICATION_KEY,
        'OpenAI-Organization': ORG, 'OpenAI-Project': PROJECT }
    });
    if (!response.ok || response.redirected) stop('TEMPORARY_METADATA_GET_FAILED');
    for (const [header, expected] of [['openai-organization', ORG], ['openai-project', PROJECT]]) {
      const value = response.headers.get(header);
      if (value && value !== expected) stop('TEMPORARY_METADATA_GET_FAILED');
    }
    requestId = response.headers.get('x-request-id');
    if (!requestId || !/^[A-Za-z0-9_-]{1,128}$/.test(requestId)
        || requestId.startsWith('sk-') || requestId.includes(env.OPENAI_METADATA_VERIFICATION_KEY)) stop('TEMPORARY_METADATA_GET_FAILED');
    const text = await response.text();
    if (text.length > 262144) stop('TEMPORARY_METADATA_GET_FAILED');
    const model = JSON.parse(text);
    if (model?.object !== 'model' || model.id !== MODEL) stop('TEMPORARY_METADATA_GET_FAILED');
    reviewTemporaryKeyPlan(plan);
  } catch { stop('TEMPORARY_METADATA_GET_FAILED'); }
  return {
    schemaVersion: 3, reportKind: 'TEMPORARY_METADATA_ACCESS_ONLY',
    status: 'VERIFIED_TEMPORARY_MODEL_METADATA_ACCESS', organisationId: ORG, projectId: PROJECT,
    temporaryKeyTrackingId: plan.key.id, temporaryCredentialFingerprintSha256: hash(env.OPENAI_METADATA_VERIFICATION_KEY),
    scopes: SCOPES, model: MODEL, providerMetadataRequestId: requestId,
    dashboardReviewedAt: plan.reviewedAt, temporaryKeyExpiresAt: plan.key.expiresAt,
    verifiedAt: new Date().toISOString(), evidenceSha256: PLAN_SHA256,
    liveSitesBindingVerified: false, existingPilotKeyBindingVerified: false,
    releaseAuthorized: false, paidDispatchEnabled: false, financiallySettled: false,
    providerInferenceRequests: 0
  };
}

const SAFE_REASONS = new Set(['TEMPORARY_PLAN_NOT_PINNED', 'TEMPORARY_KEY_NOT_CREATED_OR_REVIEWED',
  'INVALID_TEMPORARY_PLAN', 'INVALID_TEMPORARY_KEY_IDENTITY_OR_SCOPES', 'TEMPORARY_KEY_REVIEW_OR_EXPIRY_INVALID',
  'TEMPORARY_KEY_COULD_MATCH_EXISTING_KEY', 'USE_TEMPORARY_METADATA_INPUT_ONLY',
  'TEMPORARY_CREDENTIAL_MISMATCH', 'TEMPORARY_METADATA_GET_FAILED']);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3 || !['--preflight', '--metadata-only'].includes(process.argv[2])) stop('INVALID_TEMPORARY_PLAN');
    if (process.argv[2] === '--preflight') {
      reviewTemporaryKeyPlan(readTemporaryKeyPlan());
      console.log(JSON.stringify({ status: 'READY_FOR_OWNER_SECRET_INPUT', reportKind: 'TEMPORARY_METADATA_ACCESS_ONLY', releaseAuthorized: false }));
    } else console.log(JSON.stringify(await verifyTemporaryMetadataKey()));
  } catch (error) {
    console.error(JSON.stringify({ status: 'BLOCKED', reason: SAFE_REASONS.has(error?.message) ? error.message : 'INVALID_TEMPORARY_PLAN',
      providerInferenceRequests: 0, releaseAuthorized: false }));
    process.exitCode = 1;
  }
}
