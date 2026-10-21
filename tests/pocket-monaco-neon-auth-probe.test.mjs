import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {TLSSocket} from 'node:tls';
import {NEON_AUTH_PINS,NEON_AUTH_CATALOG_SQL,validateNeonAuthCatalog,probeNeonAuthentication}
  from '../scripts/pocket-monaco-neon-auth-probe.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const password = 'synthetic-ledger-password-never-output';
const flags = ['can_login','limited_role','no_memberships','database_connect',
  'database_no_create_or_temp','public_usage','public_no_create','private_schemas_denied',
  'rpc_shape','rpc_execute','other_entrypoints_denied','private_tables_denied',
  'private_sequences_denied','expected_tables_rls','immutable_guards_present'];
const goodRow = () => ({database_name:NEON_AUTH_PINS.databaseName,current_role:NEON_AUTH_PINS.roleName,
  session_role:NEON_AUTH_PINS.roleName,tls_active:true,...Object.fromEntries(flags.map(key => [key,true]))});

function fixture() {
  const evidence = {kind:'VERIFIED_NEON_LEDGER_CONTROL_PLANE_V1',...NEON_AUTH_PINS};
  delete evidence.repository;
  const bytes = Buffer.from(JSON.stringify(evidence));
  const observed = {passwordReads:0,creates:0,connects:0,queries:[],closes:0};
  // Synthetic socket state only: no handshake, server or network is created.
  const socket = new TLSSocket();
  Object.assign(socket,{authorized:true,servername:NEON_AUTH_PINS.endpointHost});
  const client = {connection:{stream:socket},async connect(){observed.connects++;},
    async query(sql){observed.queries.push(sql);return {rows:[goodRow()]};},
    async end(){observed.closes++;socket.destroy();}};
  return {evidence,observed,client,options:{
    context:{repository:NEON_AUTH_PINS.repository,reviewedSourceSha:'a'.repeat(40),sourceSha:'a'.repeat(40),
      reviewedIdentityEvidenceSha256:hash(bytes)},identityEvidenceBytes:bytes,
    readLedgerPassword(){observed.passwordReads++;return password;},
    createClient(config){observed.creates++;observed.connection=config;return client;},
  }};
}

test('auth-only succeeds without budget, processor or provider state; exactly one fixed catalog query',async()=>{
  const f=fixture();
  Object.defineProperty(f.options,'openaiKey',{get(){throw Error('OpenAI must not be read');}});
  Object.defineProperty(f.options,'budget',{get(){throw Error('Budget must not be read');}});
  const result=await probeNeonAuthentication(f.options);
  assert.equal(result.status,'PASS');assert.equal(result.passwordAuthenticationVerified,true);
  assert.equal(result.githubSecretBinding,'NOT_ATTESTED_BY_THIS_LIBRARY');
  assert.equal(result.budgetHeadroom,'NOT_INSPECTED');assert.equal(result.paidDispatchEnabled,false);
  assert.equal(result.clientTlsVerified,true);assert.equal(result.backendTlsObserved,true);
  assert.equal(result.providerRequests,0);assert.equal(result.databaseWrites,0);
  assert.equal(f.observed.passwordReads,1);assert.equal(f.observed.creates,1);assert.equal(f.observed.connects,1);
  assert.deepEqual(f.observed.queries,[NEON_AUTH_CATALOG_SQL]);assert.equal(f.observed.closes,1);
  assert.ok(!JSON.stringify(result).includes(password));
});

test('fixed connection uses only pinned endpoint, database and role with verified TLS, read-only mode and timeouts',async()=>{
  const f=fixture();await probeNeonAuthentication(f.options);const c=f.observed.connection;
  assert.equal(c.host,NEON_AUTH_PINS.endpointHost);assert.equal(c.database,NEON_AUTH_PINS.databaseName);
  assert.equal(c.user,NEON_AUTH_PINS.roleName);assert.equal(c.password,password);assert.equal(c.port,5432);
  assert.deepEqual(c.ssl,{rejectUnauthorized:true,servername:NEON_AUTH_PINS.endpointHost});
  assert.equal(c.options,'-c default_transaction_read_only=on');assert.ok(c.connectionTimeoutMillis>0);
  assert.ok(c.statement_timeout>0&&c.query_timeout>0);assert.equal('connectionString' in c,false);
});

test('wrong repository, unreviewed source and altered evidence refuse before any password access',async()=>{
  for(const change of [f=>f.options.context.repository='other/repo',f=>f.options.context.reviewedSourceSha='UNBOUND',
    f=>f.options.context.sourceSha='b'.repeat(40),f=>f.options.context.reviewedIdentityEvidenceSha256='b'.repeat(64),
    f=>f.options.identityEvidenceBytes=Buffer.from('{}')]) {
    const f=fixture();change(f);const result=await probeNeonAuthentication(f.options);
    assert.equal(result.status,'HOLD');assert.equal(f.observed.passwordReads,0);assert.equal(f.observed.creates,0);
  }
});

test('even hash-pinned evidence cannot substitute any configured Neon target field',async()=>{
  for(const field of Object.keys(NEON_AUTH_PINS).filter(key=>key!=='repository')) {
    const f=fixture();f.evidence[field]='wrong';f.options.identityEvidenceBytes=Buffer.from(JSON.stringify(f.evidence));
    f.options.context.reviewedIdentityEvidenceSha256=hash(f.options.identityEvidenceBytes);
    const result=await probeNeonAuthentication(f.options);
    assert.equal(result.status,'HOLD',field);assert.equal(f.observed.passwordReads,0);
  }
});

test('malformed evidence bytes and wrong evidence kind refuse without exposing parser input',async()=>{
  for(const bytes of [Buffer.from('{secret-invalid-json'),Buffer.from([0xff]),Buffer.from('null'),
    Buffer.from(JSON.stringify({kind:'wrong',...NEON_AUTH_PINS}))]) {
    const f=fixture();f.options.identityEvidenceBytes=bytes;f.options.context.reviewedIdentityEvidenceSha256=hash(bytes);
    const result=await probeNeonAuthentication(f.options);assert.equal(result.status,'HOLD');
    assert.equal(f.observed.passwordReads,0);assert.ok(!JSON.stringify(result).includes('secret-invalid-json'));
  }
});

test('missing or short ledger password never creates a database client',async()=>{
  for(const value of [undefined,'','short',123]) {const f=fixture();f.options.readLedgerPassword=()=>value;
    assert.equal((await probeNeonAuthentication(f.options)).status,'HOLD');assert.equal(f.observed.creates,0);}
});

test('every missing, null, false or string-valued security fact refuses catalog acceptance',()=>{
  for(const field of flags) for(const value of [false,null,undefined,'true']) {
    assert.throws(()=>validateNeonAuthCatalog([{...goodRow(),[field]:value}]),/REFUSED/);
  }
});

test('backend TLS false is observational; a certificate-verified client socket is still mandatory',async()=>{
  const f=fixture();f.client.query=async sql=>{f.observed.queries.push(sql);return {rows:[{...goodRow(),tls_active:false}]};};
  const result=await probeNeonAuthentication(f.options);
  assert.equal(result.status,'PASS');assert.equal(result.clientTlsVerified,true);assert.equal(result.backendTlsObserved,false);
  for(const value of [undefined,null,'false'])
    assert.throws(()=>validateNeonAuthCatalog([{...goodRow(),tls_active:value}]),/REFUSED/);
});

test('declared TLS config, plain objects and unverified/wrong-host client sockets cannot authenticate',async()=>{
  const changes=[f=>{f.client.connection=undefined;},
    f=>{f.client.connection.stream={encrypted:true,authorized:true,servername:NEON_AUTH_PINS.endpointHost};},
    f=>{f.client.connection.stream.authorized=false;},
    f=>{f.client.connection.stream.encrypted=false;},
    f=>{f.client.connection.stream.servername='wrong.neon.tech';},
    f=>{f.client.connection.stream.servername=null;},
    f=>{f.client.connection.stream.authorizationError=password;}];
  for(const change of changes) {const f=fixture();change(f);const result=await probeNeonAuthentication(f.options);
    assert.equal(result.status,'HOLD');assert.equal(f.observed.queries.length,0);assert.equal(f.observed.closes,1);
    assert.ok(!JSON.stringify(result).includes(password));}
});

test('client socket substitution during the query cannot reuse earlier TLS proof',async()=>{
  const f=fixture();f.client.query=async sql=>{f.observed.queries.push(sql);
    f.client.connection.stream={encrypted:true,authorized:true,servername:NEON_AUTH_PINS.endpointHost};
    return {rows:[goodRow()]};};
  assert.equal((await probeNeonAuthentication(f.options)).status,'HOLD');assert.equal(f.observed.closes,1);
});

test('wrong database, SET ROLE-style identity or extra/missing result rows refuse',()=>{
  for(const field of ['database_name','current_role','session_role'])
    assert.throws(()=>validateNeonAuthCatalog([{...goodRow(),[field]:'wrong'}]),/REFUSED/);
  for(const rows of [undefined,[],[goodRow(),goodRow()],[null]])assert.throws(()=>validateNeonAuthCatalog(rows),/REFUSED/);
});

test('connect failures never retry, query, or disclose credentials; the client is closed',async()=>{
  const f=fixture();f.client.connect=async()=>{f.observed.connects++;throw Error('postgres://'+password);};
  f.client.end=async()=>{f.observed.closes++;f.client.connection.stream.destroy();throw Error(password);};
  const result=await probeNeonAuthentication(f.options);assert.equal(result.status,'HOLD');
  assert.equal(f.observed.connects,1);assert.equal(f.observed.queries.length,0);assert.equal(f.observed.closes,1);
  assert.ok(!JSON.stringify(result).includes(password));
});

test('query failure and rejected catalog each close once and do not retry',async()=>{
  for(const fail of [true,false]) {const f=fixture();f.client.query=async sql=>{
    f.observed.queries.push(sql);if(fail)throw Error(password);return {rows:[{...goodRow(),private_tables_denied:false}]};};
    const result=await probeNeonAuthentication(f.options);assert.equal(result.status,'HOLD');
    assert.equal(f.observed.queries.length,1);assert.equal(f.observed.closes,1);
    assert.ok(!JSON.stringify(result).includes(password));}
});

test('accepted source/evidence identity cannot change across asynchronous connection',async()=>{
  const f=fixture();f.client.connect=async()=>{f.observed.connects++;f.options.context.sourceSha='b'.repeat(40);
    f.options.context.reviewedSourceSha='b'.repeat(40);f.options.identityEvidenceBytes.fill(0);};
  const expectedHash=f.options.context.reviewedIdentityEvidenceSha256;
  const result=await probeNeonAuthentication(f.options);assert.equal(result.status,'PASS');
  assert.equal(result.sourceSha,'a'.repeat(40));assert.equal(result.identityEvidenceSha256,expectedHash);
});

test('fixed SQL has no statement chaining, private table access or ledger/provider entrypoint invocation',()=>{
  assert.equal(NEON_AUTH_CATALOG_SQL.includes(';'),false);
  assert.doesNotMatch(NEON_AUTH_CATALOG_SQL,/\b(insert|update|delete|truncate|alter|grant|revoke|call)\s+(into|table|role|on|public\.|private\.)/i);
  assert.doesNotMatch(NEON_AUTH_CATALOG_SQL,/(from|join)\s+(private|public)\./i);
  assert.doesNotMatch(NEON_AUTH_CATALOG_SQL,/select\s+(private|public)\.[a-z_]+\(/i);
  const source=readFileSync(new URL('../scripts/pocket-monaco-neon-auth-probe.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/process\.env|MONACO_FIRST_SIX_OPENAI_API_KEY|fetch\(/);
});
