import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync, chmodSync, mkdirSync, readFileSync, readdirSync, lstatSync, rmSync, symlinkSync, renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createResponsesTransport, createPrivateArtifactSink} from '../scripts/pocket-monaco-executor-effects.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
function fixture(slot = 'main') {
  const body = {model:'gpt-5-mini-2025-08-07', store:false, service_tier:'default',
    max_output_tokens:slot === 'main' ? 7000 : 1400,
    input:[{role:'user', content:[{type:'input_image', image_url:'data:image/png;base64,synthetic'}]}]};
  const bytes = Buffer.from(JSON.stringify(body));
  const fingerprint = hash(JSON.stringify(body, (_key, value) =>
    typeof value === 'string' && value.startsWith('data:image/') ? `sha256:${hash(value)}` : value));
  return {body, args:{caseId:'d001', slot, requestBytes:bytes, requestSha256:hash(bytes), fingerprint}};
}
function client(create = async () => ({id:'synthetic_response'})) {
  return {project:'proj_LTmAIE2Ve7gUAFJ9M74ZxIBI', baseURL:'https://api.openai.com/v1',
    apiKey:'synthetic-key-one', maxRetries:0, responses:{create}};
}
function privateDirectory(t) {
  const root = mkdtempSync(join(tmpdir(), 'monaco-effects-synthetic-'));
  chmodSync(root, 0o700);
  t.after(() => rmSync(root, {recursive:true, force:true}));
  return root;
}
function artifact(extra = {}) {
  const bytes = Buffer.from('{"synthetic":true}');
  return {caseId:'d001', kind:'provider-response', slot:'main', bytes, sha256:hash(bytes),
    requestSha256:'a'.repeat(64), fingerprint:'b'.repeat(64), ...extra};
}

test('transport forwards one unchanged frozen body, no-retry option and cancellation signal', async () => {
  const f = fixture(), signal = new AbortController().signal, calls = [];
  const response = {_request_id:'synthetic_request', id:'synthetic_response', output_text:'{}',
    model:'gpt-5-mini-2025-08-07', service_tier:'default', usage:{input_tokens:1, output_tokens:1, total_tokens:2},
    status:'completed', output:[{synthetic:true}]};
  const c = client(async (...args) => { calls.push(args); return response; });
  const result = await createResponsesTransport(c).send({...f.args, signal});
  assert.deepEqual(result, response); assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [f.body, {maxRetries:0, signal}]);
});

test('non-enumerable SDK request ID and output text survive core cloning and private JSON retention', async () => {
  const response = {id:'synthetic_response', model:'gpt-5-mini-2025-08-07', service_tier:'default',
    usage:{input_tokens:1, output_tokens:1, total_tokens:2}, status:'completed', output:[{synthetic:true}]};
  Object.defineProperty(response, '_request_id', {value:'synthetic_hidden_id', enumerable:false});
  Object.defineProperty(response, 'output_text', {value:'{"synthetic":true}', enumerable:false});
  const result = await createResponsesTransport(client(async () => response)).send(fixture().args);
  const retained = JSON.parse(JSON.stringify(structuredClone(result)));
  assert.equal(retained._request_id, 'synthetic_hidden_id');
  assert.equal(retained.output_text, '{"synthetic":true}');
  assert.deepEqual(retained.output, response.output);
  assert.deepEqual(retained.usage, response.usage);
});

test('wrong project, endpoint, retries or missing client is refused before any attempt', () => {
  const cases = [null, {...client(), project:'other'}, {...client(), baseURL:'https://unapproved.invalid/v1'},
    {...client(), maxRetries:1}, {...client(), responses:{}}];
  for (const c of cases) assert.throws(() => createResponsesTransport(c), /EXECUTOR_EFFECT_REFUSED/);
});

test('client identity is rechecked immediately before send', async () => {
  let calls = 0;
  const c = client(async () => { calls++; }), transport = createResponsesTransport(c);
  c.maxRetries = 2;
  await assert.rejects(transport.send(fixture().args), /EXECUTOR_TRANSPORT_REFUSED/);
  assert.equal(calls, 0);
});

test('the initially admitted nonempty key stays bound across sends without exposing either key', async () => {
  assert.throws(() => createResponsesTransport({...client(), apiKey:''}), /EXECUTOR_EFFECT_REFUSED/);
  let calls = 0;
  const c = client(async () => { calls++; return {}; }), transport = createResponsesTransport(c);
  await transport.send(fixture().args);
  c.apiKey = 'synthetic-key-two';
  await assert.rejects(transport.send(fixture('primary_precision').args),
    error => error.message === 'EXECUTOR_TRANSPORT_REFUSED' && !error.message.includes('synthetic'));
  assert.equal(calls, 1);
});

test('request byte hash and canonical image-redacted fingerprint both bind the exact body', async () => {
  let calls = 0;
  const transport = createResponsesTransport(client(async () => { calls++; })), f = fixture();
  for (const bad of [{...f.args, requestSha256:'0'.repeat(64)}, {...f.args, fingerprint:'0'.repeat(64)},
    {...f.args, requestBytes:Buffer.from('private changed input')}]) {
    await assert.rejects(transport.send(bad), /EXECUTOR_TRANSPORT_REFUSED/);
  }
  assert.equal(calls, 0);
});

test('wrong request model, storage, tier and slot output limit fail before send', async () => {
  let calls = 0;
  for (const change of [{model:'other'}, {store:true}, {service_tier:'priority'}, {max_output_tokens:7001}]) {
    const f = fixture(), body = {...f.body, ...change}, bytes = Buffer.from(JSON.stringify(body));
    const fingerprint = hash(JSON.stringify(body, (_key, value) =>
      typeof value === 'string' && value.startsWith('data:image/') ? `sha256:${hash(value)}` : value));
    await assert.rejects(createResponsesTransport(client(async () => { calls++; })).send(
      {...f.args, requestBytes:bytes, requestSha256:hash(bytes), fingerprint}), /EXECUTOR_TRANSPORT_REFUSED/);
  }
  assert.equal(calls, 0);
});

test('aborted signals, unknown cases/slots and invalid UTF-8 never call the client', async () => {
  let calls = 0; const f = fixture(), controller = new AbortController(); controller.abort();
  const badUtf8 = Uint8Array.from([0xc0, 0xaf]);
  const transport = createResponsesTransport(client(async () => { calls++; }));
  for (const bad of [{...f.args, signal:controller.signal}, {...f.args, caseId:'d007'},
    {...f.args, slot:'fallback'}, {...f.args, signal:{aborted:false}},
    {...f.args, requestBytes:badUtf8, requestSha256:hash(badUtf8)}]) {
    await assert.rejects(transport.send(bad), /EXECUTOR_TRANSPORT_REFUSED/);
  }
  assert.equal(calls, 0);
});

test('provider failure is redacted and consumes the slot without retry or fallback', async () => {
  let calls = 0;
  const transport = createResponsesTransport(client(async () => { calls++; throw Error('secret-private-body'); }));
  await assert.rejects(transport.send(fixture().args), error => error.message === 'PROVIDER_ATTEMPT_FAILED_NO_RETRY');
  await assert.rejects(transport.send(fixture().args), /EXECUTOR_TRANSPORT_REFUSED/);
  assert.equal(calls, 1);
});

test('successful sends cannot replay the same slot; each admitted precision slot uses its pinned cap', async () => {
  const calls = [], transport = createResponsesTransport(client(async body => { calls.push(body); return {}; }));
  await transport.send(fixture().args);
  await assert.rejects(transport.send(fixture().args), /EXECUTOR_TRANSPORT_REFUSED/);
  await transport.send(fixture('primary_precision').args);
  await transport.send(fixture('rescue_precision').args);
  assert.deepEqual(calls.map(c => c.max_output_tokens), [7000, 1400, 1400]);
});

test('private sink retains exact bytes at an exclusive 0600 name with a digest acknowledgement', async t => {
  const directory = privateDirectory(t), sink = createPrivateArtifactSink({directory}), a = artifact();
  assert.deepEqual(await sink.write(a), {retained:true, sha256:a.sha256});
  const path = join(directory, 'd001-provider-response-main.json');
  assert.deepEqual(readFileSync(path), a.bytes);
  assert.equal(lstatSync(path).mode & 0o777, 0o600);
  assert.equal(lstatSync(directory).mode & 0o777, 0o700);
  await assert.rejects(sink.write(a), /PRIVATE_ARTIFACT_RETENTION_REFUSED/);
  assert.deepEqual(readFileSync(path), a.bytes);
});

test('diagnostic retention uses its separate immutable name and never adds a request envelope', async t => {
  const directory = privateDirectory(t), a = artifact({kind:'diagnostic-output', slot:null,
    requestSha256:undefined, fingerprint:undefined});
  await createPrivateArtifactSink({directory}).write(a);
  assert.deepEqual(readdirSync(directory), ['d001-diagnostic-output.json']);
  assert.deepEqual(readFileSync(join(directory, 'd001-diagnostic-output.json')), a.bytes);
});

test('artifact hash, case, kind, slot and metadata refusal creates no output file', async t => {
  const directory = privateDirectory(t), sink = createPrivateArtifactSink({directory});
  for (const a of [artifact({sha256:'0'.repeat(64)}), artifact({caseId:'../escape'}),
    artifact({kind:'../../escape'}), artifact({slot:'../escape'}), artifact({fingerprint:undefined}),
    artifact({kind:'diagnostic-output', slot:null})]) {
    await assert.rejects(sink.write(a), /PRIVATE_ARTIFACT_RETENTION_REFUSED/);
  }
  assert.deepEqual(readdirSync(directory), []);
});

test('sink rejects absent, relative, permissive and symlinked directories without fixing them', t => {
  const directory = privateDirectory(t), actual = join(directory, 'actual'), linked = join(directory, 'linked');
  mkdirSync(actual, {mode:0o700}); symlinkSync(actual, linked);
  for (const d of [join(directory, 'missing'), 'relative', linked, linked + '/../actual']) {
    assert.throws(() => createPrivateArtifactSink({directory:d}), /PRIVATE_ARTIFACT_DIRECTORY_REFUSED/);
  }
  chmodSync(actual, 0o755);
  assert.throws(() => createPrivateArtifactSink({directory:actual}), /PRIVATE_ARTIFACT_DIRECTORY_REFUSED/);
  assert.equal(lstatSync(actual).mode & 0o777, 0o755);
});

test('an existing output symlink is never followed or overwritten', async t => {
  const directory = privateDirectory(t), target = join(directory, 'untouched');
  symlinkSync(target, join(directory, 'd001-provider-response-main.json'));
  await assert.rejects(createPrivateArtifactSink({directory}).write(artifact()), /PRIVATE_ARTIFACT_RETENTION_REFUSED/);
  assert.equal(readdirSync(directory).length, 1);
});

test('directory replacement or permission widening after construction refuses writes', async t => {
  const directory = privateDirectory(t), selected = join(directory, 'selected');
  mkdirSync(selected, {mode:0o700});
  const sink = createPrivateArtifactSink({directory:selected});
  renameSync(selected, join(directory, 'old')); mkdirSync(selected, {mode:0o700});
  await assert.rejects(sink.write(artifact()), /PRIVATE_ARTIFACT_RETENTION_REFUSED/);
  const next = createPrivateArtifactSink({directory:selected}); chmodSync(selected, 0o755);
  await assert.rejects(next.write(artifact()), /PRIVATE_ARTIFACT_RETENTION_REFUSED/);
  assert.deepEqual(readdirSync(selected), []);
});
