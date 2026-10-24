/** Inactive effect adapters. Importing this module reads no credential, opens no
 * network connection and loads no packet. The protected bootstrap must supply
 * an already admitted client and an accepted private output mount.
 */
import {createHash} from 'node:crypto';
import {constants, lstatSync, realpathSync} from 'node:fs';
import {open} from 'node:fs/promises';
import {isAbsolute, join, resolve} from 'node:path';

const PROJECT = 'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI';
const MODEL = 'gpt-5-mini-2025-08-07';
const SLOTS = new Set(['main', 'primary_precision', 'rescue_precision']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const caseIdValid = value => typeof value === 'string' && /^d00[1-6]$/.test(value);
const requireValue = value => { if (!value) throw Error('EXECUTOR_EFFECT_REFUSED'); };

function admittedClient(client) {
  requireValue(client?.project === PROJECT && client.maxRetries === 0 &&
    client.baseURL === 'https://api.openai.com/v1' &&
    typeof client.apiKey === 'string' && client.apiKey.trim().length > 0 &&
    typeof client.responses?.create === 'function');
}

/** The supplied SDK-compatible client is never constructed or configured here.
 * Its project, endpoint and no-retry configuration are checked again at send.
 * The frozen body is parsed without additions or transformations, and each
 * case/slot can be attempted only once by this transport instance.
 */
export function createResponsesTransport(client) {
  admittedClient(client);
  // The bootstrap already attests this key against the immutable ledger binding.
  // Retain it only in this closure so a mutable client cannot switch keys later.
  const boundKey = client.apiKey;
  const attempted = new Set();
  return Object.freeze({async send({caseId, slot, requestBytes, requestSha256, fingerprint, signal}) {
    let body;
    try {
      admittedClient(client);
      requireValue(client.apiKey === boundKey);
      requireValue(caseIdValid(caseId) && SLOTS.has(slot) && requestBytes instanceof Uint8Array &&
        digest(requestSha256) && digest(fingerprint) &&
        (signal === undefined || signal instanceof AbortSignal) && !signal?.aborted);
      const bytes = Buffer.from(requestBytes);
      requireValue(hash(bytes) === requestSha256);
      body = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
      requireValue(body && typeof body === 'object' && !Array.isArray(body) &&
        body.model === MODEL && body.store === false && body.service_tier === 'default' &&
        body.max_output_tokens === (slot === 'main' ? 7000 : 1400));
      const actualFingerprint = hash(JSON.stringify(body, (_key, value) =>
        typeof value === 'string' && value.startsWith('data:image/') ? `sha256:${hash(value)}` : value));
      requireValue(actualFingerprint === fingerprint && !attempted.has(`${caseId}:${slot}`));
    } catch { throw Error('EXECUTOR_TRANSPORT_REFUSED'); }
    // A rejected/unknown response never makes this case/slot reusable.
    attempted.add(`${caseId}:${slot}`);
    try {
      const response = await client.responses.create(body, {maxRetries:0, signal});
      // SDK convenience metadata can be non-enumerable. Preserve the request ID
      // and protocol fields explicitly before the core clones/retains the JSON.
      // All enumerable raw response fields remain present and unchanged.
      return {...response, _request_id:response?._request_id, id:response?.id, model:response?.model,
        service_tier:response?.service_tier, usage:response?.usage, status:response?.status,
        output_text:response?.output_text};
    } catch {
      // SDK errors can contain headers, credentials, URLs or private bodies.
      throw Error('PROVIDER_ATTEMPT_FAILED_NO_RETRY');
    }
  }});
}

function directoryIdentity(directory) {
  requireValue(typeof directory === 'string' && isAbsolute(directory) &&
    directory === resolve(directory) && directory !== '/' && !directory.includes('\0') &&
    realpathSync(directory) === directory);
  const stat = lstatSync(directory);
  requireValue(stat.isDirectory() && !stat.isSymbolicLink() && (stat.mode & 0o777) === 0o700 &&
    typeof process.getuid === 'function' && stat.uid === process.getuid());
  return stat;
}
const sameDirectory = (a, b) => a.dev === b.dev && a.ino === b.ino && b.isDirectory() &&
  (b.mode & 0o777) === 0o700 && b.uid === process.getuid();

/** Local durability only: exclusive immutable names, mode 0600, file fsync and
 * directory fsync inside a pre-existing owner-only 0700 directory. This does
 * not prove survival of an ephemeral runner or approved hosted retention. The
 * bootstrap must bind directory to the existing accepted persistent private
 * output location. Failed/partial writes remain for reconciliation; no delete,
 * overwrite, upload, public artifact, log or automatic retry is performed.
 */
export function createPrivateArtifactSink({directory}) {
  let original;
  try {
    requireValue(typeof constants.O_NOFOLLOW === 'number' && typeof constants.O_DIRECTORY === 'number');
    original = directoryIdentity(directory);
  } catch { throw Error('PRIVATE_ARTIFACT_DIRECTORY_REFUSED'); }
  return Object.freeze({async write({caseId, kind, slot, bytes, sha256, requestSha256, fingerprint}) {
    let file, parent;
    try {
      requireValue(caseIdValid(caseId) && bytes instanceof Uint8Array && digest(sha256));
      if (kind === 'provider-response') {
        requireValue(SLOTS.has(slot) && digest(requestSha256) && digest(fingerprint));
      } else {
        requireValue(kind === 'diagnostic-output' && slot === null &&
          requestSha256 === undefined && fingerprint === undefined);
      }
      const retainedBytes = Buffer.from(bytes);
      requireValue(hash(retainedBytes) === sha256 && sameDirectory(original, directoryIdentity(directory)));
      parent = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      requireValue(sameDirectory(original, await parent.stat()));
      const name = `${caseId}-${kind}${slot === null ? '' : `-${slot}`}.json`;
      file = await open(join(directory, name),
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      const stat = await file.stat();
      requireValue(stat.isFile() && stat.nlink === 1 && (stat.mode & 0o777) === 0o600 &&
        stat.uid === process.getuid() && sameDirectory(original, directoryIdentity(directory)));
      await file.writeFile(retainedBytes);
      await file.sync();
      await parent.sync();
      await file.close(); file = undefined;
      await parent.close(); parent = undefined;
      return {retained:true, sha256};
    } catch {
      throw Error('PRIVATE_ARTIFACT_RETENTION_REFUSED');
    } finally {
      if (file) { try { await file.close(); } catch { /* Do not expose filesystem errors. */ } }
      if (parent) { try { await parent.close(); } catch { /* Preserve any written bytes. */ } }
    }
  }});
}
