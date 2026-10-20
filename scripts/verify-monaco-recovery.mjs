import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, openSync, closeSync, fsyncSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkpointKey, evaluateResume, evaluateWatchdog, FIXTURE_COMMAND, FIXTURE_MODE, manifestDigest } from './monaco-recovery-policy.mjs';

const SELF = fileURLToPath(import.meta.url);
const OWNER = 'offline-fixture-owner';
const BRANCH = 'monaco-offline-recovery-fixture';
const ACTION = 'write-local-result-v1';
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const utc = milliseconds => new Date(milliseconds).toISOString();
const option = name => { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1]; };
const gitEnv = {
  PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C', GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_COUNT: '0', GIT_TERMINAL_PROMPT: '0', GIT_ALLOW_PROTOCOL: 'file',
  GIT_AUTHOR_NAME: 'Monaco Offline Fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Monaco Offline Fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
};
const git = (cwd, ...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', '-c', 'protocol.file.allow=always', ...args], { cwd, env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 }).trim();

function save(file, value, exclusive = false) {
  mkdirSync(dirname(file), { recursive: true });
  const target = exclusive ? file : `${file}.${process.pid}.tmp`;
  writeFileSync(target, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  const fd = openSync(target, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
  if (!exclusive) renameSync(target, file);
}

function fixture(root, token) {
  const path = resolve(root ?? '');
  const temporary = realpathSync(tmpdir());
  if (!path.startsWith(temporary + sep) || !basename(path).startsWith('monaco-recovery-fixture-') || realpathSync(path) !== path) throw new Error('Only a generated local throwaway fixture may be used.');
  const marker = readJson(join(path, 'fixture.json'));
  if (marker.executionMode !== FIXTURE_MODE || marker.token !== token) throw new Error('Fixture marker mismatch.');
  return { root: path, work: join(path, 'worktree'), remote: join(path, 'remote.git'), state: join(path, 'state') };
}

const files = f => ({ manifest: join(f.state, 'RECOVERY-STATE.json'), checkpoint: join(f.state, 'checkpoint-receipt.json'), owner: join(f.state, 'owner-lease.json'), operation: join(f.state, 'operation-receipt.json') });
const snapshot = f => {
  if (git(f.work, 'remote', 'get-url', 'origin') !== f.remote || realpathSync(f.remote) !== f.remote || realpathSync(f.work) !== f.work) throw new Error('Refuse any non-fixture remote or worktree.');
  const remoteHead = git(f.work, 'ls-remote', '--heads', f.remote, `refs/heads/${BRANCH}`).split(/\s/)[0];
  return {
    local: { branch: git(f.work, 'branch', '--show-current'), head: git(f.work, 'rev-parse', 'HEAD'), tree: git(f.work, 'rev-parse', 'HEAD^{tree}'), clean: git(f.work, 'status', '--porcelain') === '' },
    remote: { kind: 'LOCAL_BARE_FIXTURE', branch: BRANCH, head: remoteHead, tree: git(f.root, '--git-dir', f.remote, 'rev-parse', `${remoteHead}^{tree}`) },
  };
};

function stopped(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return 'UNKNOWN';
  try { process.kill(pid, 0); return false; } catch (error) { return error.code === 'ESRCH' ? true : 'UNKNOWN'; }
}

function observation(f) {
  const paths = files(f), owner = readJson(paths.owner), receipt = readJson(paths.checkpoint);
  let completedAction = null;
  if (existsSync(paths.operation)) {
    const op = readJson(paths.operation);
    let contentVerified = false;
    if (op.status === 'COMMITTED') {
      try { contentVerified = hash(git(f.work, 'show', `${op.commit}:local-result.json`) + '\n') === op.contentHash; } catch { /* Unproven remains held. */ }
    }
    completedAction = { ...op, contentVerified };
  }
  return {
    ...snapshot(f), verifiedAtUtc: utc(Date.now()), headsVerified: true,
    currentOwner: { ...owner, verified: true }, checkpointReceipt: receipt, completedAction,
    activity: { activeCi: false, activeTools: false, activeWriter: stopped(receipt.workerPid) === true ? false : 'UNKNOWN' },
    successorChecked: true, handoff: false, successorPresent: false,
  };
}

function seed(f) {
  mkdirSync(f.work); mkdirSync(f.state);
  git(f.root, 'init', '--bare', '--object-format=sha1', f.remote);
  git(f.work, 'init', '--object-format=sha1', '-b', BRANCH);
  writeFileSync(join(f.work, 'partial-work.json'), JSON.stringify({ state: 'RUNNING', completedLocalSteps: ['fixture-source-saved'], pending: ACTION }) + '\n');
  git(f.work, 'add', '--', 'partial-work.json'); git(f.work, 'commit', '-m', 'fixture: checkpoint partial RUNNING work');
  git(f.work, 'remote', 'add', 'origin', f.remote); git(f.work, 'push', '--porcelain', 'origin', `HEAD:refs/heads/${BRANCH}`);
  const head = git(f.work, 'rev-parse', 'HEAD'), tree = git(f.work, 'rev-parse', 'HEAD^{tree}'), now = Date.now(), leaseId = randomUUID();
  const manifest = {
    schemaVersion: 1, executionMode: FIXTURE_MODE,
    worker: { id: OWNER, status: 'RUNNING', lastVerifiedActivityAtUtc: utc(now) },
    ownership: { branch: BRANCH, writer: OWNER, leaseId, status: 'EXCLUSIVE', expectedHead: head, expectedTree: tree, verificationBasis: 'EXPLICIT_LOCAL_FIXTURE_OWNER_RECEIPT' },
    checkpoint: { lastVerifiedRemoteCommit: head, lastVerifiedRemoteTree: tree, savedAtUtc: utc(now), identityResolution: 'LOCAL_BARE_SOURCE_HEAD_BOUND_BY_SEPARATE_RECEIPT' },
    nextSafeAction: { id: ACTION, status: 'PENDING', kind: 'LOCAL_FIXTURE_FILE', command: FIXTURE_COMMAND },
    externalGates: ['Actual Work restart, hosted HEAD/claims, provider/device/live acceptance are not exercised.'],
  };
  const paths = files(f);
  save(paths.manifest, manifest);
  save(paths.owner, { ...manifest.ownership, expiresAtUtc: utc(now + 3_600_000) });
  save(paths.checkpoint, { status: 'CHECKPOINT_SAVED', manifestDigest: manifestDigest(manifest), commit: head, tree, writer: OWNER, leaseId, workerPid: process.pid });
  return { phase: 'SAVED_THEN_STOPPED', pid: process.pid, head, tree, manifestDigest: manifestDigest(manifest) };
}

function resume(f, actor, attempt) {
  if (!/^[a-z0-9-]{1,60}$/.test(attempt ?? '')) throw new Error('Explicit fresh attempt receipt is required.');
  const lock = join(f.state, 'resume.lock');
  try { mkdirSync(lock); } catch { return { decision: 'REFUSE', reason: 'EXISTING_RESUME_LOCK_REQUIRES_OWNER_RECONCILIATION', pid: process.pid }; }
  try {
    const paths = files(f), manifest = readJson(paths.manifest), observed = observation(f);
    const decision = evaluateResume(manifest, observed, actor);
    const attemptFile = join(f.state, 'attempts', attempt + '.json');
    save(attemptFile, { attempt, pid: process.pid, checkpoint: observed.local.head, decision }, true);
    if (decision.decision !== 'EXECUTE_LOCAL_FIXTURE_ONCE') return { ...decision, attempt, pid: process.pid, head: observed.local.head };
    const output = join(f.work, 'local-result.json');
    if (existsSync(output)) return { decision: 'REFUSE', reason: 'UNRECORDED_ACTION_REQUIRES_RECONCILIATION', pid: process.pid };
    const content = JSON.stringify({ actionId: ACTION, executionCount: 1, scope: FIXTURE_MODE }) + '\n';
    save(paths.operation, { status: 'PREPARED', actionId: ACTION, beforeHead: observed.local.head, writer: actor });
    writeFileSync(output, content, { flag: 'wx' });
    git(f.work, 'add', '--', 'local-result.json'); git(f.work, 'commit', '-m', 'fixture: execute local action exactly once');
    git(f.work, 'push', '--porcelain', 'origin', `HEAD:refs/heads/${BRANCH}`);
    const next = snapshot(f); assert.equal(next.local.head, next.remote.head); assert.equal(next.local.tree, next.remote.tree);
    const result = { status: 'COMMITTED', actionId: ACTION, commit: next.local.head, tree: next.local.tree, contentHash: hash(content), writer: actor };
    save(paths.operation, result);
    manifest.worker.status = 'DONE'; manifest.worker.lastVerifiedActivityAtUtc = utc(Date.now());
    manifest.nextSafeAction.status = 'DONE';
    manifest.ownership.expectedHead = next.local.head; manifest.ownership.expectedTree = next.local.tree;
    manifest.checkpoint.lastVerifiedRemoteCommit = next.local.head; manifest.checkpoint.lastVerifiedRemoteTree = next.local.tree; manifest.checkpoint.savedAtUtc = utc(Date.now());
    save(paths.manifest, manifest);
    save(paths.owner, { ...manifest.ownership, expiresAtUtc: readJson(paths.owner).expiresAtUtc });
    save(paths.checkpoint, { status: 'CHECKPOINT_SAVED', manifestDigest: manifestDigest(manifest), commit: next.local.head, tree: next.local.tree, writer: actor, leaseId: manifest.ownership.leaseId, workerPid: process.pid });
    save(attemptFile, { attempt, pid: process.pid, checkpoint: next.local.head, decision: 'COMMITTED', operation: result });
    return { decision: 'COMMITTED', attempt, pid: process.pid, head: next.local.head, tree: next.local.tree, operation: result };
  } finally { rmSync(lock, { recursive: true }); }
}

const phase = option('--fixture-phase');
if (phase) {
  const f = fixture(option('--fixture-root'), option('--fixture-token'));
  const result = phase === 'seed' ? seed(f) : phase === 'resume' ? resume(f, option('--actor'), option('--attempt')) : null;
  if (!result) throw new Error('Unknown fixture phase.');
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = phase === 'seed' ? 75 : 0; // Deliberate interrupted-worker exit after durable save.
} else {
  const roots = [], checks = [];
  const proof = { schemaVersion: 1, scope: FIXTURE_MODE, result: 'FAIL', generatedAtUtc: utc(Date.now()), node: process.version, checks, networkRequests: 0, providerRequests: 0, realWorkSessionsResumed: 0, branchLeaseAcquisitions: 0, limits: ['Local Git/file/process simulation only; not a real Work restart, hosted writer attestation, native/provider acceptance or hardware power-loss test.', 'Fixture manifests/receipts live outside the tracked throwaway worktree to avoid self-referential commit hashes; production durable checkpoint mapping belongs to RECOVERY-RUNBOOK.md.', 'Interrupted/inconsistent receipts, dirty/stale heads and stale locks require explicit owner reconciliation; heartbeat expiry never confers ownership.'] };
  const check = (name, run) => { const start = performance.now(); run(); checks.push({ name, result: 'PASS', durationMs: Math.round((performance.now() - start) * 100) / 100 }); };
  const child = (f, childPhase, attempt, actor = OWNER) => {
    const result = spawnSync(process.execPath, [SELF, '--fixture-phase', childPhase, '--fixture-root', f.root, '--fixture-token', f.token, '--actor', actor, '--attempt', attempt ?? 'seed'], { env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 20_000 });
    assert.equal(result.error, undefined); assert.equal(result.status, childPhase === 'seed' ? 75 : 0, result.stderr);
    return JSON.parse(result.stdout.trim());
  };
  const createFixture = () => {
    const root = mkdtempSync(join(realpathSync(tmpdir()), 'monaco-recovery-fixture-')), token = randomUUID(); roots.push(root);
    save(join(root, 'fixture.json'), { executionMode: FIXTURE_MODE, token }, true);
    return { ...fixture(root, token), token };
  };
  try {
    const f = createFixture(), saved = child(f, 'seed');
    let first, second;
    check('stopped process leaves independently readable RUNNING manifest and exact pushed source receipt', () => {
      const m = readJson(files(f).manifest), o = observation(f);
      assert.equal(m.worker.status, 'RUNNING'); assert.equal(m.nextSafeAction.status, 'PENDING');
      assert.equal(o.local.head, saved.head); assert.equal(o.remote.head, saved.head); assert.equal(o.local.tree, saved.tree); assert.equal(o.remote.tree, saved.tree);
      assert.equal(o.checkpointReceipt.manifestDigest, manifestDigest(m)); assert.equal(stopped(saved.pid), true);
    });
    check('independent resume process verifies saved heads/owner and commits one allowlisted local action', () => {
      first = child(f, 'resume', 'first-resume'); assert.notEqual(first.pid, saved.pid); assert.equal(first.decision, 'COMMITTED');
      const output = readJson(join(f.work, 'local-result.json')); assert.equal(output.executionCount, 1);
      assert.equal(git(f.work, 'rev-list', '--count', `${saved.head}..HEAD`), '1');
      const m = readJson(files(f).manifest); assert.equal(m.worker.status, 'DONE'); assert.equal(m.nextSafeAction.status, 'DONE');
    });
    check('second independent resume saves a fresh receipt without another action or commit', () => {
      const before = snapshot(f); second = child(f, 'resume', 'second-resume');
      assert.notEqual(second.pid, first.pid); assert.equal(second.decision, 'NOOP'); assert.equal(second.reason, 'ACTION_ALREADY_COMMITTED');
      assert.deepEqual(snapshot(f), before); assert.equal(git(f.work, 'rev-list', '--count', `${saved.head}..HEAD`), '1');
      assert.equal(readJson(join(f.state, 'attempts', 'first-resume.json')).decision, 'COMMITTED');
      assert.equal(readJson(join(f.state, 'attempts', 'second-resume.json')).decision.decision, 'NOOP');
      assert.equal(readJson(join(f.work, 'local-result.json')).executionCount, 1);
    });
    const wrong = createFixture(); child(wrong, 'seed');
    check('wrong owner cannot write or infer authority from a saved checkpoint', () => {
      const before = snapshot(wrong), result = child(wrong, 'resume', 'wrong-owner', 'another-writer');
      assert.equal(result.decision, 'REFUSE'); assert.equal(result.reason, 'WRONG_OWNER'); assert.deepEqual(snapshot(wrong), before); assert.equal(existsSync(join(wrong.work, 'local-result.json')), false);
    });
    const stale = createFixture(); child(stale, 'seed');
    writeFileSync(join(stale.work, 'other-change.txt'), 'unrelated local fixture change\n'); git(stale.work, 'add', '--', 'other-change.txt'); git(stale.work, 'commit', '-m', 'fixture: change head outside saved checkpoint'); git(stale.work, 'push', '--porcelain', 'origin', `HEAD:refs/heads/${BRANCH}`);
    check('changed local and remote heads refuse resume without overwriting the checkpoint', () => {
      const before = snapshot(stale), m = readFileSync(files(stale).manifest, 'utf8'), result = child(stale, 'resume', 'stale-head');
      assert.equal(result.decision, 'REFUSE'); assert.equal(result.reason, 'STALE_HEAD_OR_TREE'); assert.deepEqual(snapshot(stale), before);
      assert.equal(readFileSync(files(stale).manifest, 'utf8'), m); assert.equal(existsSync(join(stale.work, 'local-result.json')), false);
    });
    const m = readJson(files(wrong).manifest), baseObservation = observation(wrong), now = Date.now();
    m.worker.lastVerifiedActivityAtUtc = utc(now - 2 * 60 * 60 * 1000 - 1);
    const obs = { ...baseObservation, verifiedAtUtc: utc(now), checkpointReceipt: { ...baseObservation.checkpointReceipt, manifestDigest: manifestDigest(m) } };
    const cases = [
      ['RUNNING stale with complete current evidence', {}, {}, 'ALERT_ONCE'],
      ...['PAUSED', 'HANDOFF', 'BLOCKED_EXTERNAL', 'DONE'].map(status => [status + ' stays quiet', { worker: { ...m.worker, status } }, {}, 'QUIET']),
      ['recent RUNNING stays quiet', { worker: { ...m.worker, lastVerifiedActivityAtUtc: utc(now - 60_000) } }, {}, 'QUIET'],
      ['exactly two hours is not stalled', { worker: { ...m.worker, lastVerifiedActivityAtUtc: utc(now - 7_200_000) } }, {}, 'QUIET'],
      ['unknown heartbeat stays quiet', { worker: { ...m.worker, lastVerifiedActivityAtUtc: null } }, {}, 'QUIET'],
      ['unknown lease stays quiet', {}, { currentOwner: null }, 'QUIET'],
      ['expired lease stays quiet', {}, { currentOwner: { ...obs.currentOwner, expiresAtUtc: utc(now - 1) } }, 'QUIET'],
      ['active CI stays quiet', {}, { activity: { ...obs.activity, activeCi: true } }, 'QUIET'],
      ['unknown CI stays quiet', {}, { activity: { ...obs.activity, activeCi: null } }, 'QUIET'],
      ['active tools stay quiet', {}, { activity: { ...obs.activity, activeTools: true } }, 'QUIET'],
      ['unknown tools stay quiet', {}, { activity: { ...obs.activity, activeTools: null } }, 'QUIET'],
      ['active writer stays quiet', {}, { activity: { ...obs.activity, activeWriter: true } }, 'QUIET'],
      ['unknown writer stays quiet', {}, { activity: { ...obs.activity, activeWriter: null } }, 'QUIET'],
      ['explicit handoff stays quiet', {}, { handoff: true }, 'QUIET'],
      ['successor claim stays quiet', {}, { successorPresent: true }, 'QUIET'],
      ['unchecked successor stays quiet', {}, { successorChecked: false }, 'QUIET'],
      ['unverified heads stay quiet', {}, { headsVerified: false }, 'QUIET'],
      ['changed remote head stays quiet', {}, { remote: { ...obs.remote, head: 'f'.repeat(40) } }, 'QUIET'],
    ];
    for (const [name, change, observationChange, expected] of cases) check('watchdog: ' + name, () => {
      const candidate = { ...m, ...change }, evidence = { ...obs, ...observationChange };
      evidence.checkpointReceipt = { ...evidence.checkpointReceipt, manifestDigest: manifestDigest(candidate) };
      const result = evaluateWatchdog(candidate, evidence, [], now); assert.equal(result.decision, expected);
      assert.equal(result.mayResumeWork, false); assert.equal(result.mayAcquireLease, false); assert.equal(result.mayWriteBranch, false);
    });
    check('watchdog alert claim is durable and a second check of the same saved head is quiet', () => {
      const key = checkpointKey(m), alert = evaluateWatchdog(m, obs, [], now); assert.equal(alert.decision, 'ALERT_ONCE');
      const receipt = join(wrong.state, 'alerts', key + '.json'); save(receipt, { key, decision: 'ALERT_CLAIMED_ONLY_NO_MESSAGE_SENT' }, true);
      assert.throws(() => save(receipt, { key }, true), error => error.code === 'EEXIST');
      const reload = readJson(receipt); assert.equal(evaluateWatchdog(m, obs, [reload.key], now).decision, 'QUIET');
    });
    check('stale heartbeat never grants a lease, wrong-owner resume, or an expired-lease write', () => {
      assert.equal(evaluateResume(m, obs, 'another-writer', now).decision, 'REFUSE');
      const denied = evaluateResume(m, { ...obs, currentOwner: { ...obs.currentOwner, expiresAtUtc: utc(now - 1) } }, OWNER, now);
      assert.equal(denied.decision, 'REFUSE'); assert.equal(denied.reason, 'LEASE_EXPIRED_OR_UNKNOWN'); assert.equal(denied.mayAcquireLease, false);
    });
    check('unproved DONE and arbitrary/paid actions cannot be inferred from a manifest', () => {
      const done = readJson(files(f).manifest), doneObs = observation(f);
      assert.equal(evaluateResume(done, { ...doneObs, completedAction: null }, OWNER).reason, 'DONE_RECEIPT_UNPROVEN');
      const dangerous = { ...m, nextSafeAction: { ...m.nextSafeAction, kind: 'PROVIDER_CALL' } };
      assert.equal(evaluateResume(dangerous, { ...obs, checkpointReceipt: { ...obs.checkpointReceipt, manifestDigest: manifestDigest(dangerous) } }, OWNER, now).reason, 'ACTION_NOT_ALLOWLISTED_LOCAL_FIXTURE');
      assert.equal(evaluateResume({ ...m, executionMode: 'REAL_WORK' }, obs, OWNER, now).reason, 'NOT_AN_OFFLINE_FIXTURE');
    });
    proof.result = 'PASS'; proof.processes = { savedByPid: saved.pid, firstResumePid: first.pid, secondResumePid: second.pid };
    proof.checkpoints = { savedHead: saved.head, savedTree: saved.tree, completedHead: first.head, completedTree: first.tree };
    proof.localActionExecutions = 1; proof.localActionCommits = 1; proof.skipped = 0;
  } catch (error) {
    proof.error = error.message; process.exitCode = 1;
  } finally {
    proof.sourceHashes = { policy: hash(readFileSync(new URL('./monaco-recovery-policy.mjs', import.meta.url))), verifier: hash(readFileSync(SELF)) };
    for (const root of roots) rmSync(root, { recursive: true, force: true });
    const output = option('--proof');
    if (output) { mkdirSync(dirname(resolve(output)), { recursive: true }); writeFileSync(resolve(output), JSON.stringify(proof, null, 2) + '\n'); }
    else process.stdout.write(JSON.stringify(proof, null, 2) + '\n');
    process.stdout.write(`${proof.result}: ${checks.length} offline recovery checks; ${proof.skipped ?? 0} skipped; no real Work restart, network, provider or lease acquisition.\n`);
  }
}
