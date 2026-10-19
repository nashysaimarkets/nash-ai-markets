import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkDashboardRuntimeEnvironment, reviewDashboardEvidence, verifyPocketBenchmarkDashboard }
  from '../scripts/verify-pocket-benchmark-dashboard.mjs';

const evidence = JSON.parse(readFileSync(new URL('../docs/quality/pocket-dashboard-evidence-20261019.json', import.meta.url)));
const now = Date.parse(evidence.observedAt) + 1000;
const syntheticKey = ['sk', 'proj', 'SYNTHETIC_ONLY_NOT_A_CREDENTIAL', 'aBgA'].join('-');
const env = {
  POCKET_BENCHMARK_RUNTIME_METADATA_ENABLED: 'true', POCKET_BENCHMARK_PILOT_ENABLED: 'false',
  POCKET_REAL_BENCHMARK_DISPATCH: 'false', POCKET_BENCHMARK_ACCOUNTING_MODE: 'full-reservation-v2',
  OPENAI_ORG_ID: 'org-5vLRRzXwcigUx96TVE0rI3RW', OPENAI_PROJECT_ID: 'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI',
  POCKET_BENCHMARK_OPENAI_PROJECT_ID: 'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI',
  POCKET_BENCHMARK_CANDIDATE_SHA: '93f3fe282c6cab0196812aec989dddaa915bb986',
  OPENAI_POCKET_MODEL: 'gpt-5-mini-2025-08-07', OPENAI_POCKET_ANNOTATION_MODEL: 'gpt-5-mini-2025-08-07',
  NEXT_PUBLIC_SUPABASE_URL: 'https://pxlqvaddvghjjhenqmdh.supabase.co', OPENAI_API_KEY: syntheticKey
};

test('reviewed dashboard plus a project credential requires no administrator credential', () => {
  assert.equal(Object.hasOwn(env, 'OPENAI_ADMIN_KEY'), false);
  checkDashboardRuntimeEnvironment(env);
  assert.equal(reviewDashboardEvidence(evidence, syntheticKey, now).observedAt, new Date(now - 1000).toISOString());
});

const attacks = {
  filtered: e => e.inventory.filters.push('Active'),
  truncated: e => e.inventory.complete = false,
  wrongCount: e => e.inventory.visibleResults++,
  wrongProject: e => e.project.id = 'proj_other',
  wrongOrganisation: e => e.organisationId = 'org_other',
  wrongObserver: e => e.observer.userId = 'user_other',
  memberOnly: e => e.observer.organisationRole = 'Reader',
  archived: e => e.project.status = 'archived',
  priorityTier: e => e.project.defaultServiceTier = 'Priority',
  wrongTrackingId: e => e.inventory.keys[0].id = 'key_other',
  wrongOwner: e => e.inventory.keys[0].createdBy = 'user_other',
  revoked: e => e.inventory.keys[0].status = 'Revoked',
  expired: e => e.inventory.keys[0].expiresAt = 1,
  malformedExpiry: e => e.inventory.keys[0].expiresAt = 'Never',
  fullSecretInsteadOfMask: e => e.inventory.keys[0].redactedValue = syntheticKey,
  weakMask: e => e.inventory.keys[0].redactedValue = 'sk-...a',
  wrongSuffix: e => e.inventory.keys[0].redactedValue = 'sk-...zzzz',
  duplicateMask: e => { const k = structuredClone(e.inventory.keys[0]); k.id = 'key_collision'; e.inventory.keys.push(k); e.inventory.visibleResults++; },
  duplicateTrackingId: e => { e.inventory.keys[1] = structuredClone(e.inventory.keys[0]); },
  unknownKeyStatus: e => e.inventory.keys[1].status = 'Unknown',
  foreignOrigin: e => e.sources.push('https://platform.openai.com.evil.invalid/api-keys'),
  queryInSource: e => e.sources[0] += '?unreviewed=true',
  wrongSource: e => e.evidenceKind = 'USER_SUPPLIED_UNREVIEWED_JSON'
};
for (const [name, mutate] of Object.entries(attacks)) test('dashboard rejects ' + name, () => {
  const changed = structuredClone(evidence); mutate(changed);
  assert.throws(() => reviewDashboardEvidence(changed, syntheticKey, now));
});

test('dashboard evidence expires after one hour and future observations fail closed', () => {
  assert.throws(() => reviewDashboardEvidence(evidence, syntheticKey, now + 3600000));
  assert.throws(() => reviewDashboardEvidence(evidence, syntheticKey, now - 2000));
  assert.throws(() => reviewDashboardEvidence(evidence, syntheticKey, Number.NaN));
});

for (const [name, override] of Object.entries({
  paidPilot: { POCKET_BENCHMARK_PILOT_ENABLED: 'true' }, paidDispatch: { POCKET_REAL_BENCHMARK_DISPATCH: 'true' },
  missingCredential: { OPENAI_API_KEY: '' }, legacyCredential: { OPENAI_API_KEY: 'sk-SYNTHETIC_LEGACY_KEY_aBgA' },
  newlineCredential: { OPENAI_API_KEY: syntheticKey + '\n' },
  alternateOrigin: { OPENAI_BASE_URL: 'https://api.openai.com.evil.invalid/v1' },
  wrongProject: { OPENAI_PROJECT_ID: 'proj_other' }, wrongCandidate: { POCKET_BENCHMARK_CANDIDATE_SHA: 'a'.repeat(40) },
  wrongBackend: { NEXT_PUBLIC_SUPABASE_URL: 'https://opmgzchnmcgnsfwpmysc.supabase.co' },
  alias: { OPENAI_POCKET_MODEL: 'gpt-5-mini' }, annotation: { OPENAI_POCKET_ANNOTATION_MODEL: 'gpt-5.6-terra' }
})) test('configuration rejects ' + name, () => assert.throws(() => checkDashboardRuntimeEnvironment({ ...env, ...override })));

// A harness supplies only synthetic credentials. It intercepts every fetch and
// validates the request independently of the implementation's own assertions.
async function withTransport(responder, action = verifyPocketBenchmarkDashboard, overrides = {}) {
  const originalFetch = globalThis.fetch, originalNow = Date.now;
  const saved = { ...process.env }; const calls = [];
  try {
    for (const name of Object.keys(process.env)) delete process.env[name];
    Object.assign(process.env, env, overrides);
    Date.now = () => now;
    globalThis.fetch = async (url, options) => {
      calls.push(url);
      assert.equal(url, 'https://api.openai.com/v1/models/gpt-5-mini-2025-08-07');
      assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.headers.Authorization, 'Bearer ' + syntheticKey);
      assert.equal(options.headers['OpenAI-Organization'], env.OPENAI_ORG_ID);
      assert.equal(options.headers['OpenAI-Project'], env.OPENAI_PROJECT_ID);
      return responder(options);
    };
    return { result: await action(), calls };
  } finally {
    globalThis.fetch = originalFetch; Date.now = originalNow;
    for (const name of Object.keys(process.env)) delete process.env[name];
    Object.assign(process.env, saved);
  }
}
const success = () => ({ ok: true, redirected: false,
  headers: new Headers({ 'x-request-id': 'req_synthetic_no_inference', 'openai-organization': env.OPENAI_ORG_ID }),
  text: async () => JSON.stringify({ object: 'model', id: env.OPENAI_POCKET_MODEL }) });

test('one authenticated model GET emits explicit attestation assurance and cannot enable release', async () => {
  const { result, calls } = await withTransport(success);
  assert.equal(calls.length, 1);
  assert.equal(result.status, 'VERIFIED_DASHBOARD_CORRELATION');
  assert.equal(result.keyFingerprintSha256, createHash('sha256').update(syntheticKey).digest('hex'));
  assert.equal(result.schemaVersion, 2); assert.equal(result.integrationStatus, 'STANDALONE_REVIEW_ONLY');
  assert.equal(result.liveSitesBindingVerified, false); assert.equal(result.releaseAuthorized, false);
  assert.equal(result.paidDispatchEnabled, false); assert.equal(result.financiallySettled, false);
  assert.equal(result.actualMicrousd, null); assert.equal(result.providerInferenceRequests, 0);
  assert.ok(!JSON.stringify(result).includes(syntheticKey));
});

for (const [name, change] of Object.entries({
  denied: r => r.ok = false, redirected: r => r.redirected = true,
  missingRequestId: r => r.headers.delete('x-request-id'),
  reflectedSecret: r => r.headers.set('x-request-id', syntheticKey),
  wrongOrganisation: r => r.headers.set('openai-organization', 'org_other'),
  wrongProject: r => r.headers.set('openai-project', 'proj_other'),
  invalidJson: r => r.text = async () => syntheticKey,
  oversized: r => r.text = async () => 'x'.repeat(262145),
  aliasModel: r => r.text = async () => JSON.stringify({ object: 'model', id: 'gpt-5-mini' }),
  fakeObject: r => r.text = async () => JSON.stringify({ object: 'response', id: env.OPENAI_POCKET_MODEL })
})) test('transport rejects ' + name + ' without leaking data or retrying', async () => {
  let requests = 0;
  await assert.rejects(withTransport(() => { requests++; const r = success(); change(r); return r; }),
    error => error.message === 'MODEL_METADATA_GET_FAILED' && !error.message.includes(syntheticKey));
  assert.equal(requests, 1);
});

test('network failures stay generic and administrator credentials are never read', async () => {
  let requests = 0;
  await assert.rejects(withTransport(() => { requests++; throw new Error(syntheticKey); }, undefined,
    { OPENAI_ADMIN_KEY: 'SYNTHETIC_ADMIN_MUST_NOT_BE_USED' }), /MODEL_METADATA_GET_FAILED/);
  assert.equal(requests, 1);
  const source = readFileSync(new URL('../scripts/verify-pocket-benchmark-dashboard.mjs', import.meta.url), 'utf8');
  assert.ok(!source.includes('env.OPENAI_ADMIN_KEY'));
  assert.ok(!source.includes('/organization/projects/'));
});

test('missing existing project credential stops before any fetch', async () => {
  let calls = 0;
  await assert.rejects(withTransport(() => { calls++; throw new Error('Network must not be called'); }, undefined,
    { OPENAI_API_KEY: '' }), /EXISTING_PROJECT_CREDENTIAL_UNAVAILABLE/);
  assert.equal(calls, 0);
});

test('pinned evidence tampering fails before network and is restored exactly', async () => {
  const path = new URL('../docs/quality/pocket-dashboard-evidence-20261019.json', import.meta.url);
  const original = readFileSync(path); let calls = 0;
  try {
    writeFileSync(path, Buffer.concat([original, Buffer.from('\n')]));
    await assert.rejects(withTransport(() => { calls++; throw new Error('Network must not be called'); }), /PINNED_DASHBOARD_EVIDENCE_UNAVAILABLE/);
    assert.equal(calls, 0);
  } finally { writeFileSync(path, original); }
});

test('wrapper forces reviewed models and paid holds in its child without reading any credential file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'monaco-no-admin-'));
  try {
    const configNames = Object.keys(env).filter(k => k !== 'OPENAI_API_KEY');
    writeFileSync(join(dir, 'node'), `#!${process.execPath}\nprocess.stdout.write(JSON.stringify({args:process.argv.slice(2),env:Object.fromEntries(${JSON.stringify(configNames)}.map(k=>[k,process.env[k]]))}));`, { mode: 0o700 });
    const wrapper = fileURLToPath(new URL('../scripts/verify-pocket-benchmark-no-admin.sh', import.meta.url));
    const result = spawnSync('bash', [wrapper, '--metadata-only'], { encoding: 'utf8', env: {
      PATH: dir + ':' + process.env.PATH, POCKET_BENCHMARK_PILOT_ENABLED: 'true',
      POCKET_REAL_BENCHMARK_DISPATCH: 'true', OPENAI_POCKET_MODEL: 'gpt-5.6-sol'
    } });
    assert.equal(result.status, 0, result.stderr);
    const actual = JSON.parse(result.stdout);
    assert.deepEqual(actual.env, Object.fromEntries(configNames.map(k => [k, env[k]])));
    assert.equal(actual.args.at(-1), '--metadata-only');
    for (const args of [[], ['--enable-paid'], ['--metadata-only', '--enable-paid']]) {
      const rejected = spawnSync('bash', [wrapper, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH } });
      assert.equal(rejected.status, 2); assert.equal(rejected.stdout, '');
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI fails closed with no existing key and emits only non-secret JSON', () => {
  const wrapper = fileURLToPath(new URL('../scripts/verify-pocket-benchmark-no-admin.sh', import.meta.url));
  const result = spawnSync('bash', [wrapper, '--metadata-only'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.deepEqual(JSON.parse(result.stderr), { status: 'BLOCKED', reason: 'EXISTING_PROJECT_CREDENTIAL_UNAVAILABLE',
    providerInferenceRequests: 0, releaseAuthorized: false });
});
