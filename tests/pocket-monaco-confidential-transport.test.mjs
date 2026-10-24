/** Synthetic, offline transport checks. The upload client below is a mock:
 * these results do not attest hosted retention, SDK behavior or private inputs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomBytes} from 'node:crypto';
import {existsSync, lstatSync, readFileSync} from 'node:fs';
import {createBootstrapPrivateArtifacts} from '../scripts/pocket-monaco-executor-bootstrap.mjs';
import {createEncryptedArtifactSink, createInputHandoff, ENCRYPTED_ARTIFACT_KIND,
  generateRecipientKeyPair, openConfidentialRecord, sealConfidentialRecord, sealInputBundle}
  from '../scripts/pocket-monaco-confidential-transport.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const keys = generateRecipientKeyPair(), otherKeys = generateRecipientKeyPair();
const run = Object.freeze({repository:'nashysaimarkets/nash-ai-markets',runId:'123456789',
  runAttempt:'1',sourceSha:'a'.repeat(40)});
const recipient = {recipientPublicKeyPem:keys.publicKeyPem,expectedRecipientPublicKeySha256:keys.publicKeySha256};
const settings = {run,...recipient,retentionDays:7};
const record = (extra={}) => {
  const bytes = Buffer.from('{"syntheticPrivateResult":"never upload this plaintext"}');
  return {kind:'provider-response',caseId:'d001',slot:'main',bytes,sha256:hash(bytes),
    requestSha256:'b'.repeat(64),fingerprint:'c'.repeat(64),...extra};
};
const openRecord = (envelopeBytes,row,extra={}) => openConfidentialRecord({envelopeBytes,
  privateKeyPem:keys.privateKeyPem,...settings,record:row,...extra});
const validAck = id => ({id,size:1234,digest:'d'.repeat(64)});

test('several-MB envelopes round-trip exact bytes with fresh encryption and pinned recipient', () => {
  const bytes = randomBytes(4 * 1024 * 1024), row = record({bytes,sha256:hash(bytes)});
  const sealed = sealConfidentialRecord({...settings,record:row,bytes});
  assert.deepEqual(openRecord(sealed,row),bytes);
  const second = sealConfidentialRecord({...settings,record:row,bytes});
  assert.notDeepEqual(sealed,second);
  assert.equal(sealed.includes(bytes.subarray(0,80)),false);
  assert.equal(JSON.parse(sealed).metadata.recipientPublicKeySha256,keys.publicKeySha256);
});

test('ciphertext, key, nonce, tag, metadata and recipient changes reveal no partial plaintext', () => {
  const row = record(), sealed = sealConfidentialRecord({...settings,record:row,bytes:row.bytes});
  for (const field of ['encryptedKey','nonce','tag','ciphertext']) {
    const changed = JSON.parse(sealed), bytes = Buffer.from(changed[field],'base64');
    bytes[0] ^= 1; changed[field] = bytes.toString('base64');
    assert.throws(() => openRecord(Buffer.from(JSON.stringify(changed)),row),
      error => error.message === 'CONFIDENTIAL_TRANSPORT_REFUSED');
  }
  for (const [field,value] of [['runId','987'],['sourceSha','e'.repeat(40)],['caseId','d002'],
    ['slot','primary_precision'],['sha256','e'.repeat(64)],['retentionDays',8],['fingerprint','e'.repeat(64)]]) {
    const changed = JSON.parse(sealed); changed.metadata[field] = value;
    assert.throws(() => openRecord(Buffer.from(JSON.stringify(changed)),row));
  }
  assert.throws(() => openRecord(sealed,row,{privateKeyPem:otherKeys.privateKeyPem}));
  assert.throws(() => openRecord(sealed,row,{run:{...run,runId:'987'}}));
  assert.throws(() => openRecord(sealed,row,{record:{...row,slot:'primary_precision'}}));
});

test('wrong source bytes, public-key pin, scope, attempt and retention are refused before encryption', () => {
  const row = record();
  for (const change of [{bytes:Buffer.from('changed')},{expectedRecipientPublicKeySha256:otherKeys.publicKeySha256},
    {record:{...row,caseId:'e001'}},{run:{...run,runAttempt:'2'}},{retentionDays:0},{retentionDays:91}]) {
    assert.throws(() => sealConfidentialRecord({...settings,record:row,bytes:row.bytes,...change}),
      /CONFIDENTIAL_TRANSPORT_REFUSED/);
  }
});

test('retention waits for remote acknowledgement; official upload sees one ciphertext file only', async () => {
  const row = record(), captured = {}; let finish, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const completion = new Promise(resolve => { finish = resolve; });
  const sink = createEncryptedArtifactSink({...settings,artifactClient:{async uploadArtifact(name,files,directory,options) {
    Object.assign(captured,{name,files,directory,options,bytes:readFileSync(files[0])});
    assert.equal(files.length,1); assert.equal(lstatSync(directory).mode & 0o777,0o700);
    assert.equal(lstatSync(files[0]).mode & 0o777,0o600);
    assert.equal(captured.bytes.includes(row.bytes),false);
    assert.deepEqual(openRecord(captured.bytes,row),row.bytes);
    entered(); return completion;
  }}});
  let done = false; const pending = sink.write(row).then(value => { done = true; return value; });
  await started; assert.equal(done,false);
  assert.deepEqual(captured.options,{retentionDays:7,compressionLevel:0});
  finish(validAck(1001)); const result = await pending;
  assert.equal(result.retained,true); assert.equal(result.sha256,row.sha256);
  assert.equal(result.artifact.id,1001); assert.equal(result.artifact.envelopeSha256,hash(captured.bytes));
  assert.equal(result.artifact.archiveSha256,'d'.repeat(64));
  assert.equal(existsSync(captured.directory),false);
  await assert.rejects(sink.write(row),/ENCRYPTED_ARTIFACT_RETENTION_REFUSED/);
});

test('rejected or malformed remote acknowledgement permanently stops uploads without retry or raw errors', async () => {
  for (const ack of [null,{},validAck(0),{...validAck(1001),digest:null},
    {...validAck(1001),size:0},{...validAck(1001),id:1.5},'throw']) {
    let calls = 0;
    const sink = createEncryptedArtifactSink({...settings,artifactClient:{async uploadArtifact() {
      calls++; if (ack === 'throw') throw Error('synthetic secret / private response'); return ack;
    }}});
    await assert.rejects(sink.write(record()),error => error.message === 'ENCRYPTED_ARTIFACT_RETENTION_REFUSED');
    await assert.rejects(sink.write(record({caseId:'d002'})));
    assert.equal(calls,1);
  }
});

test('different records cannot share an immutable artifact ID', async () => {
  let calls = 0;
  const sink = createEncryptedArtifactSink({...settings,artifactClient:{async uploadArtifact() { calls++; return validAck(1001); }}});
  await sink.write(record());
  await assert.rejects(sink.write(record({caseId:'d002'})),/ENCRYPTED_ARTIFACT_RETENTION_REFUSED/);
  await assert.rejects(sink.write(record({caseId:'d003'})));
  assert.equal(calls,2);
});

test('diagnostics use their separate immutable record and concurrent writes fail closed', async () => {
  let finish, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const completion = new Promise(resolve => { finish = resolve; });
  const row = record({kind:'diagnostic-output',slot:null,requestSha256:undefined,fingerprint:undefined});
  const sink = createEncryptedArtifactSink({...settings,artifactClient:{async uploadArtifact(name,files) {
    assert.match(name,/d001-diagnostic-output-final$/); assert.deepEqual(openRecord(readFileSync(files[0]),row),row.bytes);
    entered(); return completion;
  }}});
  const pending = sink.write(row); await started;
  await assert.rejects(sink.write(record({caseId:'d002'})));
  finish(validAck(1001)); await assert.rejects(pending,/ENCRYPTED_ARTIFACT_RETENTION_REFUSED/);
});

test('input handoff binds the protected run and pre-pinned bundle and consumes its private key once', () => {
  const bytes = Buffer.from('synthetic bundle bytes'), expectedBundleSha256 = hash(bytes);
  const handoff = createInputHandoff({run,expectedBundleSha256});
  assert.equal(JSON.stringify(handoff.publicHandoff).includes('PRIVATE KEY'),false);
  assert.equal(handoff.privateKeyPem,undefined);
  const args = {publicHandoff:handoff.publicHandoff,run,bytes,expectedBundleSha256};
  assert.throws(() => sealInputBundle({...args,run:{...run,runId:'987'}}));
  assert.throws(() => sealInputBundle({...args,bytes:Buffer.from('different')}));
  const sealed = sealInputBundle(args);
  assert.deepEqual(handoff.openOnce(sealed),bytes);
  assert.throws(() => handoff.openOnce(sealed));
  const rejected = createInputHandoff({run,expectedBundleSha256});
  assert.throws(() => rejected.openOnce(Buffer.from('not an envelope')));
  assert.throws(() => rejected.openOnce(sealed));
});

test('bootstrap selects bound encrypted retention without requiring an invented persistent mount', () => {
  let calls = 0;
  const accepted = {kind:ENCRYPTED_ARTIFACT_KIND,repository:run.repository,
    recipientPublicKeySha256:keys.publicKeySha256,retentionDays:7,acceptanceRef:'synthetic-existing-acceptance'};
  const args = {evidence:{processorSecurityAcceptance:{privateArtifactLocation:accepted}},
    context:{...run,reviewedSourceSha:run.sourceSha},
    encryptedArtifacts:{recipientPublicKeyPem:keys.publicKeyPem,artifactClient:{async uploadArtifact() { calls++; }}}};
  assert.equal(typeof createBootstrapPrivateArtifacts(args).write,'function'); assert.equal(calls,0);
  for (const change of [{kind:'unaccepted'},{repository:'other/repo'},
    {recipientPublicKeySha256:otherKeys.publicKeySha256},{retentionDays:0},{acceptanceRef:''}]) {
    assert.throws(() => createBootstrapPrivateArtifacts({...args,evidence:{processorSecurityAcceptance:{
      privateArtifactLocation:{...accepted,...change}}}}));
  }
  assert.throws(() => createBootstrapPrivateArtifacts({...args,privateOutputDirectory:'/tmp/nonexistent'}));
  assert.throws(() => createBootstrapPrivateArtifacts({...args,context:{...args.context,sourceSha:'e'.repeat(40)}}));
  assert.equal(calls,0);
});
