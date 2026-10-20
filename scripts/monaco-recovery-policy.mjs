import { createHash } from 'node:crypto';

/** Narrow offline fixture contract. Nothing here launches Work, executes a
 * manifest command, acquires a writer lease, or authorizes a real branch write.
 * Production mapping: worker/ownership/checkpoint/nextSafeAction use the same
 * names; independently verified observations and saved receipts are required.
 * evaluateResume is deliberately restricted to OFFLINE_LOCAL_FIXTURE. */
export const FIXTURE_MODE = 'OFFLINE_LOCAL_FIXTURE';
export const FIXTURE_COMMAND = 'fixture:write-local-result-once';
const SHA = /^[a-f0-9]{40}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const time = value => typeof value === 'string' && UTC.test(value) ? Date.parse(value) : NaN;
const text = value => typeof value === 'string' && value.length > 0;
export const manifestDigest = manifest => createHash('sha256').update(JSON.stringify(manifest)).digest('hex');

export function checkpointKey(manifest) {
  const c = manifest?.checkpoint, o = manifest?.ownership;
  if (!text(o?.branch) || !SHA.test(c?.lastVerifiedRemoteCommit ?? '') || !SHA.test(c?.lastVerifiedRemoteTree ?? '')) return null;
  return createHash('sha256').update(JSON.stringify(['monaco-126', o.branch, c.lastVerifiedRemoteCommit, c.lastVerifiedRemoteTree])).digest('hex');
}

function evidenceError(manifest, observed, now) {
  const c = manifest?.checkpoint, o = manifest?.ownership, w = manifest?.worker;
  if (manifest?.schemaVersion !== 1 || !text(w?.id) || !text(o?.branch) || !text(o?.writer) || !text(o?.leaseId)) return 'MALFORMED_MANIFEST';
  if (o.status !== 'EXCLUSIVE' || w.id !== o.writer || !text(o.verificationBasis)) return 'OWNER_NOT_EXCLUSIVE';
  if (!SHA.test(o.expectedHead ?? '') || !SHA.test(o.expectedTree ?? '') || c?.lastVerifiedRemoteCommit !== o.expectedHead || c?.lastVerifiedRemoteTree !== o.expectedTree) return 'INCONSISTENT_CHECKPOINT';
  const checked = time(observed?.verifiedAtUtc);
  if (!Number.isFinite(now) || !Number.isFinite(checked) || checked > now || now - checked > 300_000) return 'OBSERVATION_NOT_CURRENT';
  if (observed?.headsVerified !== true || observed?.local?.branch !== o.branch || observed?.remote?.branch !== o.branch) return 'HEADS_UNVERIFIED';
  if (observed.local.head !== o.expectedHead || observed.remote.head !== o.expectedHead || observed.local.tree !== o.expectedTree || observed.remote.tree !== o.expectedTree) return 'STALE_HEAD_OR_TREE';
  if (observed.local.clean !== true) return 'DIRTY_WORKTREE';
  const owner = observed.currentOwner;
  if (owner?.verified !== true || owner.status !== 'EXCLUSIVE' || owner.writer !== o.writer || owner.leaseId !== o.leaseId || owner.branch !== o.branch || owner.expectedHead !== o.expectedHead || owner.expectedTree !== o.expectedTree) return 'CURRENT_OWNER_UNVERIFIED';
  // Heartbeat age never substitutes for an unexpired, positively checked lease.
  if (!Number.isFinite(time(owner.expiresAtUtc)) || time(owner.expiresAtUtc) <= now) return 'LEASE_EXPIRED_OR_UNKNOWN';
  if (observed.activity?.activeCi !== false || observed.activity?.activeTools !== false || observed.activity?.activeWriter !== false) return 'ACTIVITY_ACTIVE_OR_UNKNOWN';
  if (observed.successorChecked !== true || observed.handoff !== false || observed.successorPresent !== false) return 'HANDOFF_OR_SUCCESSOR_UNRESOLVED';
  const receipt = observed.checkpointReceipt;
  if (receipt?.status !== 'CHECKPOINT_SAVED' || receipt.manifestDigest !== manifestDigest(manifest) || receipt.commit !== o.expectedHead || receipt.tree !== o.expectedTree || receipt.writer !== o.writer || receipt.leaseId !== o.leaseId) return 'CHECKPOINT_RECEIPT_MISMATCH';
  return null;
}

export function evaluateResume(manifest, observed, actor, now = Date.now()) {
  const deny = reason => ({ decision: 'REFUSE', reason, mayResumeWork: false, mayAcquireLease: false });
  if (manifest?.executionMode !== FIXTURE_MODE || observed?.remote?.kind !== 'LOCAL_BARE_FIXTURE') return deny('NOT_AN_OFFLINE_FIXTURE');
  if (!text(actor) || actor !== manifest?.ownership?.writer) return deny('WRONG_OWNER');
  const error = evidenceError(manifest, observed, now);
  if (error) return deny(error);
  const action = manifest.nextSafeAction;
  if (!text(action?.id) || action.kind !== 'LOCAL_FIXTURE_FILE' || action.command !== FIXTURE_COMMAND) return deny('ACTION_NOT_ALLOWLISTED_LOCAL_FIXTURE');
  if (manifest.worker.status === 'DONE' && action.status === 'DONE') {
    const done = observed.completedAction;
    if (done?.status !== 'COMMITTED' || done.actionId !== action.id || done.commit !== observed.local.head || done.tree !== observed.local.tree || done.contentVerified !== true) return deny('DONE_RECEIPT_UNPROVEN');
    return { decision: 'NOOP', reason: 'ACTION_ALREADY_COMMITTED', mayResumeWork: false, mayAcquireLease: false };
  }
  if (manifest.worker.status !== 'RUNNING' || action.status !== 'PENDING') return deny('STATE_REQUIRES_EXPLICIT_RECONCILIATION');
  if (observed.completedAction !== null) return deny('PENDING_ACTION_HAS_UNRECONCILED_RECEIPT');
  return { decision: 'EXECUTE_LOCAL_FIXTURE_ONCE', actionId: action.id, mayResumeWork: false, mayAcquireLease: false };
}

/** Read-only recommendation only. The caller must durably claim alertKey with
 * an exclusive create before sending; evaluation alone cannot deduplicate send.
 * An alert never conveys a lease or claims that a Work session was reopened. */
export function evaluateWatchdog(manifest, observed, alertedCheckpointKeys = [], now = Date.now()) {
  const quiet = reason => ({ decision: 'QUIET', reason, mayResumeWork: false, mayWriteBranch: false, mayAcquireLease: false });
  if (manifest?.worker?.status !== 'RUNNING') return quiet('NOT_RUNNING');
  const error = evidenceError(manifest, observed, now);
  if (error) return quiet(error);
  const activity = time(manifest.worker.lastVerifiedActivityAtUtc);
  if (!Number.isFinite(activity) || activity > now || now - activity <= 2 * 60 * 60 * 1000) return quiet('RECENT_OR_UNKNOWN_HEARTBEAT');
  const alertKey = checkpointKey(manifest);
  if (!alertKey || !Array.isArray(alertedCheckpointKeys)) return quiet('ALERT_STATE_UNKNOWN');
  if (alertedCheckpointKeys.includes(alertKey)) return quiet('CHECKPOINT_ALREADY_ALERTED');
  return {
    decision: 'ALERT_ONCE', alertKey, checkpoint: manifest.checkpoint.lastVerifiedRemoteCommit,
    issue: 'https://github.com/nashysaimarkets/nash-ai-markets/issues/126',
    mayResumeWork: false, mayWriteBranch: false, mayAcquireLease: false,
  };
}
