/** Confidential first-six transport. Inert on import; no credential lookup,
 * dataset read, provider call or paid admission. Only ciphertext reaches the
 * injected official Actions artifact client. An envelope authenticates its
 * contents, not its sender: recovery must also bind the actual protected run
 * and immutable artifact ID. Synthetic upload clients establish no hosted proof.
 */
import {constants as cryptoConstants, createCipheriv, createDecipheriv, createHash,
  createPrivateKey, createPublicKey, generateKeyPairSync, privateDecrypt, publicEncrypt,
  randomBytes} from 'node:crypto';
import {constants as fsConstants} from 'node:fs';
import {mkdtemp, open, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export const ENCRYPTED_ARTIFACT_KIND = 'GITHUB_ACTIONS_ENCRYPTED_ARTIFACTS_V1';
const ENVELOPE_KIND = 'MONACO_CONFIDENTIAL_ENVELOPE_V1';
const ALGORITHM = 'RSA-OAEP-SHA256+A256GCM';
const REPOSITORY = 'nashysaimarkets/nash-ai-markets';
const SLOTS = new Set(['main', 'primary_precision', 'rescue_precision']);
const LIMIT = 64 * 1024 * 1024;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const requireValue = ok => { if (!ok) throw Error('CONFIDENTIAL_TRANSPORT_REFUSED'); };
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

function runBinding(run) {
  requireValue(run?.repository === REPOSITORY && typeof run.runId === 'string'
    && /^[1-9][0-9]{0,19}$/.test(run.runId) && run.runAttempt === '1'
    && typeof run.sourceSha === 'string' && /^[a-f0-9]{40}$/.test(run.sourceSha));
  return Object.freeze({repository:run.repository, runId:run.runId,
    runAttempt:run.runAttempt, sourceSha:run.sourceSha});
}

function publicKey(pem) {
  requireValue(typeof pem === 'string' && pem.startsWith('-----BEGIN PUBLIC KEY-----'));
  const key = createPublicKey(pem), details = key.asymmetricKeyDetails;
  requireValue(key.type === 'public' && key.asymmetricKeyType === 'rsa'
    && details?.modulusLength >= 3072 && details.modulusLength <= 4096
    && details.publicExponent === 65537n);
  return key;
}

export function recipientPublicKeySha256(publicKeyPem) {
  try { return hash(publicKey(publicKeyPem).export({type:'spki', format:'der'})); }
  catch { throw Error('CONFIDENTIAL_TRANSPORT_REFUSED'); }
}

/** Caller must save the output recipient private key privately before any paid
 * call, and pin only its public-key digest in reviewed evidence. No key is saved
 * or printed by this function. Input handoff keys instead stay in runner memory.
 */
export function generateRecipientKeyPair() {
  const pair = generateKeyPairSync('rsa', {modulusLength:3072, publicExponent:65537,
    publicKeyEncoding:{type:'spki', format:'pem'}, privateKeyEncoding:{type:'pkcs8', format:'pem'}});
  return {publicKeyPem:pair.publicKey, privateKeyPem:pair.privateKey,
    publicKeySha256:recipientPublicKeySha256(pair.publicKey)};
}

function recordBinding(record) {
  requireValue(digest(record?.sha256));
  const {kind, caseId, slot, sha256, requestSha256, fingerprint} = record;
  if (kind === 'first-six-input-bundle') {
    requireValue(caseId === null && slot === null && requestSha256 === undefined && fingerprint === undefined);
  } else {
    requireValue(typeof caseId === 'string' && /^d00[1-6]$/.test(caseId));
    if (kind === 'provider-response') {
      requireValue(SLOTS.has(slot) && digest(requestSha256) && digest(fingerprint));
    } else {
      requireValue(kind === 'diagnostic-output' && slot === null
        && requestSha256 === undefined && fingerprint === undefined);
    }
  }
  return {kind, caseId, slot, sha256, requestSha256:requestSha256 ?? null, fingerprint:fingerprint ?? null};
}

function metadataFor(run, record, recipientSha256, retentionDays) {
  requireValue(digest(recipientSha256));
  const row = recordBinding(record);
  requireValue(row.kind === 'first-six-input-bundle' ? retentionDays === null
    : Number.isInteger(retentionDays) && retentionDays >= 1 && retentionDays <= 90);
  return {...runBinding(run), ...row, recipientPublicKeySha256:recipientSha256, retentionDays};
}

function aad(metadata) {
  return Buffer.from(JSON.stringify({kind:ENVELOPE_KIND, algorithm:ALGORITHM, metadata}));
}
function decode64(value, maximum) {
  requireValue(typeof value === 'string' && value.length <= Math.ceil(maximum / 3) * 4
    && value.length % 4 === 0);
  const bytes = Buffer.from(value, 'base64');
  requireValue(bytes.length <= maximum && bytes.toString('base64') === value);
  return bytes;
}

export function sealConfidentialRecord({run, record, bytes, recipientPublicKeyPem,
  expectedRecipientPublicKeySha256, retentionDays}) {
  let contentKey;
  try {
    requireValue(bytes instanceof Uint8Array && bytes.length > 0 && bytes.length <= LIMIT);
    const plaintext = Buffer.from(bytes), key = publicKey(recipientPublicKeyPem);
    requireValue(hash(key.export({type:'spki', format:'der'})) === expectedRecipientPublicKeySha256);
    const metadata = metadataFor(run, record, expectedRecipientPublicKeySha256, retentionDays);
    requireValue(hash(plaintext) === metadata.sha256);
    const associated = aad(metadata), nonce = randomBytes(12);
    contentKey = randomBytes(32);
    const cipher = createCipheriv('aes-256-gcm', contentKey, nonce, {authTagLength:16});
    cipher.setAAD(associated);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const encryptedKey = publicEncrypt({key, padding:cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      oaepHash:'sha256', oaepLabel:associated}, contentKey);
    return Buffer.from(JSON.stringify({kind:ENVELOPE_KIND, algorithm:ALGORITHM, metadata,
      encryptedKey:encryptedKey.toString('base64'), nonce:nonce.toString('base64'),
      tag:cipher.getAuthTag().toString('base64'), ciphertext:ciphertext.toString('base64')}));
  } catch { throw Error('CONFIDENTIAL_TRANSPORT_REFUSED'); }
  finally { contentKey?.fill(0); }
}

export function openConfidentialRecord({envelopeBytes, privateKeyPem, run, record,
  expectedRecipientPublicKeySha256, retentionDays}) {
  let contentKey;
  try {
    requireValue(envelopeBytes instanceof Uint8Array && envelopeBytes.length <= LIMIT * 1.4 + 4096);
    const envelope = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(envelopeBytes));
    requireValue(exactKeys(envelope, ['kind','algorithm','metadata','encryptedKey','nonce','tag','ciphertext'])
      && envelope.kind === ENVELOPE_KIND && envelope.algorithm === ALGORITHM);
    const metadata = metadataFor(run, record, expectedRecipientPublicKeySha256, retentionDays);
    requireValue(exactKeys(envelope.metadata, Object.keys(metadata))
      && Object.entries(metadata).every(([key, value]) => envelope.metadata[key] === value));
    const key = createPrivateKey(privateKeyPem), recipient = createPublicKey(key).export({type:'spki', format:'pem'});
    requireValue(recipientPublicKeySha256(recipient) === expectedRecipientPublicKeySha256);
    const associated = aad(metadata), nonce = decode64(envelope.nonce, 12), tag = decode64(envelope.tag, 16);
    requireValue(nonce.length === 12 && tag.length === 16);
    contentKey = privateDecrypt({key, padding:cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      oaepHash:'sha256', oaepLabel:associated}, decode64(envelope.encryptedKey, 512));
    requireValue(contentKey.length === 32);
    const decipher = createDecipheriv('aes-256-gcm', contentKey, nonce, {authTagLength:16});
    decipher.setAAD(associated); decipher.setAuthTag(tag);
    // No plaintext is returned until the complete GCM tag has been verified.
    const plaintext = Buffer.concat([decipher.update(decode64(envelope.ciphertext, LIMIT)), decipher.final()]);
    requireValue(plaintext.length > 0 && hash(plaintext) === metadata.sha256);
    return plaintext;
  } catch { throw Error('CONFIDENTIAL_TRANSPORT_REFUSED'); }
  finally { contentKey?.fill(0); }
}

/** Official ArtifactClient.uploadArtifact(name, files, rootDirectory, options).
 * The protected wrapper supplies a locked official SDK, not an HTTP substitute.
 * We invoke it once per immutable name and never retry/delete/overwrite. SDK
 * internal HTTP behavior belongs to the reviewed runtime binding. Its archive
 * digest differs from the envelope file digest; both are preserved separately.
 */
export function createEncryptedArtifactSink({run, recipientPublicKeyPem,
  expectedRecipientPublicKeySha256, retentionDays, artifactClient}) {
  let bound, upload;
  try {
    bound = runBinding(run);
    requireValue(recipientPublicKeySha256(recipientPublicKeyPem) === expectedRecipientPublicKeySha256
      && Number.isInteger(retentionDays) && retentionDays >= 1 && retentionDays <= 90
      && typeof artifactClient?.uploadArtifact === 'function');
    upload = artifactClient.uploadArtifact.bind(artifactClient);
  } catch { throw Error('CONFIDENTIAL_TRANSPORT_REFUSED'); }
  const attempted = new Set(), ids = new Set();
  let busy = false, failed = false;
  return Object.freeze({async write(record) {
    let directory;
    try {
      requireValue(!busy && !failed); busy = true;
      const row = recordBinding(record);
      requireValue(row.kind !== 'first-six-input-bundle');
      const name = `monaco-encrypted-${bound.runId}-${bound.sourceSha.slice(0,12)}-${row.caseId}-${row.kind}-${row.slot ?? 'final'}`;
      requireValue(!attempted.has(name)); attempted.add(name);
      const ciphertext = sealConfidentialRecord({run:bound, record, bytes:record.bytes,
        recipientPublicKeyPem, expectedRecipientPublicKeySha256, retentionDays});
      directory = await mkdtemp(join(tmpdir(), 'monaco-ciphertext-'));
      const path = join(directory, 'record.encrypted.json');
      const file = await open(path, fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL
        | fsConstants.O_NOFOLLOW, 0o600);
      try { await file.writeFile(ciphertext); await file.sync(); } finally { await file.close(); }
      const result = await upload(name, [path], directory, {retentionDays, compressionLevel:0});
      const archiveSha256 = typeof result?.digest === 'string' ? result.digest.replace(/^sha256:/, '') : '';
      requireValue(!failed && Number.isSafeInteger(result?.id) && result.id > 0 && !ids.has(result.id)
        && Number.isSafeInteger(result.size) && result.size > 0 && digest(archiveSha256));
      ids.add(result.id);
      return Object.freeze({retained:true, sha256:row.sha256, artifact:Object.freeze({
        repository:bound.repository, runId:bound.runId, id:result.id, name,
        archiveSha256, envelopeSha256:hash(ciphertext), retentionDays})});
    } catch { failed = true; throw Error('ENCRYPTED_ARTIFACT_RETENTION_REFUSED'); }
    finally {
      busy = false;
      if (directory) { try { await rm(directory, {recursive:true, force:true}); } catch { /* Ciphertext only. */ } }
    }
  }});
}

/** The public handoff must be recovered from this exact protected run's public
 * artifact. The private input key remains inside this closure and is consumed
 * on the first decryption attempt. The reviewed bundle hash is fixed beforehand.
 */
export function createInputHandoff({run, expectedBundleSha256}) {
  const bound = runBinding(run); requireValue(digest(expectedBundleSha256));
  let keys = generateRecipientKeyPair();
  const publicHandoff = Object.freeze({kind:'MONACO_FIRST_SIX_INPUT_HANDOFF_V1', ...bound,
    bundleSha256:expectedBundleSha256, publicKeyPem:keys.publicKeyPem, publicKeySha256:keys.publicKeySha256});
  return Object.freeze({publicHandoff, openOnce(envelopeBytes) {
    requireValue(keys !== null); const consumed = keys; keys = null;
    return openConfidentialRecord({envelopeBytes, privateKeyPem:consumed.privateKeyPem, run:bound,
      record:{kind:'first-six-input-bundle',caseId:null,slot:null,sha256:expectedBundleSha256},
      expectedRecipientPublicKeySha256:consumed.publicKeySha256, retentionDays:null});
  }});
}

export function sealInputBundle({publicHandoff, run, bytes, expectedBundleSha256}) {
  try {
    const bound = runBinding(run);
    requireValue(publicHandoff?.kind === 'MONACO_FIRST_SIX_INPUT_HANDOFF_V1'
      && Object.entries(bound).every(([key,value]) => publicHandoff[key] === value)
      && publicHandoff.bundleSha256 === expectedBundleSha256 && digest(expectedBundleSha256));
    return sealConfidentialRecord({run:bound, bytes, recipientPublicKeyPem:publicHandoff.publicKeyPem,
      expectedRecipientPublicKeySha256:publicHandoff.publicKeySha256, retentionDays:null,
      record:{kind:'first-six-input-bundle',caseId:null,slot:null,sha256:expectedBundleSha256}});
  } catch { throw Error('CONFIDENTIAL_TRANSPORT_REFUSED'); }
}
