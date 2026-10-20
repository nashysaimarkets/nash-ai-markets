import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readTemporaryKeyPlan, reviewTemporaryKeyPlan, checkTemporaryCredential, verifyTemporaryMetadataKey }
  from '../scripts/verify-pocket-temporary-key.mjs';

const pinned = readTemporaryKeyPlan();
const draft = { ...structuredClone(pinned), state: 'DRAFT_NOT_CREATED', key: null, ownerApprovalAt: null };
const observed = Date.parse('2026-10-19T17:45:00Z');
const now = observed + 2000;
const credential = ['sk', 'proj', 'SYNTHETIC_TEMPORARY_NOT_A_REAL_KEY', 'wX9Z'].join('-');
const plan = { ...structuredClone(draft), state: 'CREATED_AND_INDEPENDENTLY_REVIEWED',
  ownerApprovalAt: '2026-10-19T17:44:00Z', observedAt: '2026-10-19T17:45:00Z', reviewedAt: '2026-10-19T17:45:01Z',
  observedBy: 'synthetic-owner', reviewedBy: 'synthetic-independent-reviewer',
  key: { id: 'key_SYNTHETICTEMPONLY', name: draft.proposal.name, status: 'Active',
    createdBy: 'user-jy2Gr5ZRQ3EPWerlbY1MDHDM', scopes: ['api.model.read', 'model.read'],
    redactedValue: 'sk-...wX9Z', createdAt: '2026-10-19T17:44:30Z', expiresAt: '2026-10-20T17:44:30Z' }
};
plan.inventory = { complete: true, filters: [], visibleResults: 3, keys: [
  { id: 'key_EjND5GXtuqF2K0hp', name: 'existing synthetic row', status: 'Active',
    createdBy: 'user-DlYoRdGCCPjv7Bk5iEjduePV', redactedValue: 'sk-...aBgA', expiresAt: null },
  { id: 'key_HTa1GVGxw3MQq2QZ', name: 'revoked synthetic row', status: 'Revoked',
    createdBy: 'user_synthetic', redactedValue: 'sk-...EQUA', expiresAt: null },
  structuredClone(plan.key)
] };

test('pinned plan without a credential cannot prompt for a secret or make a network request', async () => {
  assert.equal(draft.state, 'DRAFT_NOT_CREATED'); assert.equal(draft.key, null); assert.equal(draft.ownerApprovalAt, null);
  const savedFetch = globalThis.fetch, savedEnv = { ...process.env }; let calls = 0;
  try {
    for (const name of Object.keys(process.env)) delete process.env[name];
    globalThis.fetch = async () => { calls++; throw new Error('Forbidden network'); };
    await assert.rejects(verifyTemporaryMetadataKey(), /TEMPORARY_KEY_NOT_CREATED_OR_REVIEWED|TEMPORARY_CREDENTIAL_MISMATCH|TEMPORARY_KEY_REVIEW_OR_EXPIRY_INVALID/);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = savedFetch;
    for (const name of Object.keys(process.env)) delete process.env[name]; Object.assign(process.env, savedEnv);
  }
  const launcher = fileURLToPath(new URL('../scripts/run-pocket-metadata-temporary.py', import.meta.url));
  const result = spawnSync('python', [launcher, '--metadata-only'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(result.status, 1); assert.ok(!result.stderr.includes('Temporary metadata key (hidden'));
  assert.ok(result.stderr.includes('TEMPORARY_KEY_NOT_CREATED_OR_REVIEWED')
    || result.stderr.includes('TEMPORARY_KEY_REVIEW_OR_EXPIRY_INVALID')
    || result.stderr.includes('Owner-controlled interactive terminal required'));
});

test('an uncreated draft is rejected even when copied from a real pinned plan', () => {
  assert.throws(() => reviewTemporaryKeyPlan(draft, now), /TEMPORARY_KEY_NOT_CREATED_OR_REVIEWED/);
});

test('only a separately approved, freshly reviewed one-day read-only temporary plan is eligible', () => {
  assert.deepEqual(reviewTemporaryKeyPlan(plan, now), { prefix: 'sk-', suffix: 'wX9Z' });
});

for (const [name, mutate] of Object.entries({
  pendingApproval: p => p.ownerApprovalAt = null,
  approvalAfterCreation: p => p.ownerApprovalAt = '2026-10-19T17:45:00Z',
  liveTrackingId: p => p.key.id = 'key_EjND5GXtuqF2K0hp',
  oldReaderId: p => p.key.id = 'key_HTa1GVGxw3MQq2QZ',
  liveMaskCollision: p => p.key.redactedValue = 'sk-...aBgA',
  readerMaskCollision: p => p.key.redactedValue = 'sk-...EQUA',
  wrongProject: p => p.projectId = 'proj_other',
  wrongOwner: p => p.key.createdBy = 'user_other',
  historicalOwner: p => p.key.createdBy = 'user-DlYoRdGCCPjv7Bk5iEjduePV',
  revoked: p => p.key.status = 'Revoked',
  inferenceScope: p => p.key.scopes.push('api.model.request'),
  writeScope: p => p.key.scopes.push('api.files.write'),
  allReadScope: p => p.key.scopes = ['api.all.read'],
  proposalExpansion: p => p.proposal.scopes.push('model.request'),
  noExpiration: p => p.key.expiresAt = null,
  longExpiration: p => p.key.expiresAt = '2026-10-21T17:44:30Z',
  expired: p => p.key.expiresAt = '2026-10-19T17:44:31Z',
  futureReview: p => p.reviewedAt = '2026-10-19T17:46:00Z',
  sameReviewer: p => p.reviewedBy = p.observedBy,
  liveBindingClaim: p => p.liveSitesBindingVerified = true,
  releaseClaim: p => p.releaseAuthorized = true
})) test('temporary-key review rejects ' + name, () => {
  const changed = structuredClone(plan); mutate(changed);
  assert.throws(() => reviewTemporaryKeyPlan(changed, now));
});

for (const [name, mutate] of Object.entries({
  absent: p => delete p.inventory,
  partial: p => p.inventory.complete = false,
  filtered: p => p.inventory.filters.push('Active'),
  truncated: p => p.inventory.visibleResults++,
  duplicateId: p => p.inventory.keys[0].id = p.key.id,
  invalidMask: p => p.inventory.keys[0].redactedValue = 'sk-FAKEwX9Z',
  absentNewKey: p => { p.inventory.keys.pop(); p.inventory.visibleResults--; },
  sameMask: p => p.inventory.keys[0].redactedValue = p.key.redactedValue,
  suffixOverlap: p => { p.key.redactedValue = 'sk-...longwX9Z'; p.inventory.keys[2].redactedValue = p.key.redactedValue;
    p.inventory.keys[0].redactedValue = 'sk-...wX9Z'; },
  wrongScope: p => p.inventory.keys[2].scopes.push('api.model.request'),
  wrongOwner: p => p.inventory.keys[2].createdBy = 'user_other',
  wrongExpiry: p => p.inventory.keys[2].expiresAt = null,
  revokedMatch: p => p.inventory.keys[2].status = 'Revoked',
  malformedOtherExpiry: p => p.inventory.keys[0].expiresAt = 'invalid'
})) test('complete inventory admission rejects ' + name, () => {
  const changed = structuredClone(plan); mutate(changed);
  assert.throws(() => reviewTemporaryKeyPlan(changed, now));
});

test('temporary review cannot be reused after one hour', () => {
  assert.throws(() => reviewTemporaryKeyPlan(plan, now + 3600000));
});

test('the input name and guards prevent accidental reuse of old project/admin credentials', () => {
  const saved = Date.now;
  try {
    Date.now = () => now;
    checkTemporaryCredential({ OPENAI_METADATA_VERIFICATION_KEY: credential }, plan);
    for (const env of [{ OPENAI_API_KEY: credential }, { OPENAI_ADMIN_KEY: 'SYNTHETIC_ADMIN' },
      { OPENAI_BASE_URL: 'https://evil.invalid' }])
      assert.throws(() => checkTemporaryCredential({ OPENAI_METADATA_VERIFICATION_KEY: credential, ...env }, plan), /USE_TEMPORARY_METADATA_INPUT_ONLY/);
    assert.throws(() => checkTemporaryCredential({ OPENAI_METADATA_VERIFICATION_KEY: credential.replace('wX9Z', 'aBgA') }, plan), /TEMPORARY_CREDENTIAL_MISMATCH/);
  } finally { Date.now = saved; }
});

// A separate disposable copy can exercise the post-approval transport with only
// synthetic evidence. The actual source and pinned uncreated draft stay intact.
async function withSyntheticTransport(responder) {
  const dir = mkdtempSync(join(tmpdir(), 'monaco-temporary-key-'));
  const savedEnv = { ...process.env }, savedFetch = globalThis.fetch, savedNow = Date.now;
  let calls = 0;
  try {
    mkdirSync(join(dir, 'scripts')); mkdirSync(join(dir, 'docs', 'quality'), { recursive: true });
    const json = JSON.stringify(plan);
    const digest = createHash('sha256').update(json).digest('hex');
    const source = readFileSync(new URL('../scripts/verify-pocket-temporary-key.mjs', import.meta.url), 'utf8')
      .replace(/const PLAN_SHA256 = '[a-f0-9]{64}';/, `const PLAN_SHA256 = '${digest}';`);
    const modulePath = join(dir, 'scripts', 'verifier.mjs'); writeFileSync(modulePath, source);
    writeFileSync(join(dir, 'docs', 'quality', 'pocket-temporary-key-plan-20261019.json'), json);
    for (const name of Object.keys(process.env)) delete process.env[name];
    process.env.OPENAI_METADATA_VERIFICATION_KEY = credential;
    Date.now = () => now;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/models/gpt-5-mini-2025-08-07');
      assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer ' + credential);
      assert.equal(options.headers['OpenAI-Project'], plan.projectId);
      assert.equal(options.headers['OpenAI-Organization'], plan.organisationId);
      return responder();
    };
    const module = await import(pathToFileURL(modulePath));
    return { result: await module.verifyTemporaryMetadataKey(), calls };
  } finally {
    globalThis.fetch = savedFetch; Date.now = savedNow;
    for (const name of Object.keys(process.env)) delete process.env[name]; Object.assign(process.env, savedEnv);
    rmSync(dir, { recursive: true, force: true });
  }
}
const okResponse = () => ({ ok: true, redirected: false, headers: new Headers({ 'x-request-id': 'req_synthetic_temporary_metadata' }),
  text: async () => JSON.stringify({ object: 'model', id: 'gpt-5-mini-2025-08-07' }) });

test('temporary success remains a distinct report that cannot attest the existing live key', async () => {
  const { result, calls } = await withSyntheticTransport(okResponse);
  assert.equal(calls, 1); assert.equal(result.schemaVersion, 3);
  assert.equal(result.reportKind, 'TEMPORARY_METADATA_ACCESS_ONLY');
  assert.equal(result.temporaryKeyTrackingId, plan.key.id); assert.equal(result.keyTrackingId, undefined);
  assert.equal(result.liveSitesBindingVerified, false); assert.equal(result.existingPilotKeyBindingVerified, false);
  assert.equal(result.releaseAuthorized, false); assert.equal(result.paidDispatchEnabled, false);
  assert.equal(result.financiallySettled, false); assert.equal(result.providerInferenceRequests, 0);
  assert.ok(!JSON.stringify(result).includes(credential));
});

for (const [name, change] of Object.entries({
  denial: r => r.ok = false, redirect: r => r.redirected = true,
  projectMismatch: r => r.headers.set('openai-project', 'proj_other'),
  reflectedCredential: r => r.headers.set('x-request-id', credential),
  modelAlias: r => r.text = async () => JSON.stringify({ object: 'model', id: 'gpt-5-mini' })
})) test('temporary transport rejects ' + name + ' without retry or credential disclosure', async () => {
  let calls = 0;
  await assert.rejects(withSyntheticTransport(() => { calls++; const r = okResponse(); change(r); return r; }),
    error => error.message === 'TEMPORARY_METADATA_GET_FAILED' && !error.message.includes(credential));
  assert.equal(calls, 1);
});

const datePlan = () => {
  const p = structuredClone(plan);
  p.key.createdAt = null; p.key.expiresAt = null;
  Object.assign(p.key, { timestampPrecision: 'DASHBOARD_DATE_ONLY', createdDate: '2026-10-19',
    expiresDate: '2026-10-20', expirationSelection: '1 day' });
  p.inventory.keys[2] = structuredClone(p.key);
  p.creationSelectionReceipt = 'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6295910084';
  p.providerExactTimestampsKnown = false;
  p.executionNotAfter = new Date(observed + 600000).toISOString();
  return p;
};

test('date precision authorizes only a short local window without inventing provider timestamps', () => {
  const p = datePlan();
  assert.deepEqual(reviewTemporaryKeyPlan(p, now), { prefix: 'sk-', suffix: 'wX9Z' });
  assert.equal(p.key.createdAt, null); assert.equal(p.key.expiresAt, null);
  assert.throws(() => reviewTemporaryKeyPlan(p, observed + 600000));
});

for (const [name, mutate] of Object.entries({
  noReceipt: p => delete p.creationSelectionReceipt,
  wrongReceipt: p => p.creationSelectionReceipt += '-other',
  falsePrecision: p => p.providerExactTimestampsKnown = true,
  fabricatedCreatedTime: p => p.key.createdAt = '2026-10-19T17:44:30Z',
  fabricatedExpiryTime: p => p.key.expiresAt = '2026-10-20T17:44:30Z',
  missingCreatedDate: p => delete p.key.createdDate,
  invalidExpiryDate: p => p.key.expiresDate = '2026-02-30',
  lifetimeDateMismatch: p => p.key.expiresDate = '2026-10-21',
  wrongSelection: p => p.key.expirationSelection = 'Never',
  missingDeadline: p => delete p.executionNotAfter,
  longDeadline: p => p.executionNotAfter = new Date(observed + 600001).toISOString(),
  expiredDeadline: p => p.executionNotAfter = new Date(now).toISOString(),
  futureObservation: p => p.observedAt = new Date(now + 1).toISOString(),
  missingInventoryPrecision: p => delete p.inventory.keys[2].timestampPrecision,
  inventoryExpiryDateMismatch: p => p.inventory.keys[2].expiresDate = '2026-10-21',
  inventorySelectionMismatch: p => p.inventory.keys[2].expirationSelection = 'Never',
  uncertainExpiryMaskCollision: p => { p.inventory.keys[0].redactedValue = p.key.redactedValue;
    p.inventory.keys[0].expiresAt = null; }
})) test('date precision fails closed for ' + name, () => {
  const p = datePlan(); mutate(p); assert.throws(() => reviewTemporaryKeyPlan(p, now));
});
