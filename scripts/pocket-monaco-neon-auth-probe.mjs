/** Database authentication only. No OpenAI, ledger RPC, budget admission, SQL
 * mutation, retries or environment lookup. A reviewed caller supplies the
 * existing ledger password and pg-compatible client. Importing is inert. */
import {createHash} from 'node:crypto';
import {TLSSocket} from 'node:tls';

export const NEON_AUTH_PINS = Object.freeze({
  repository: 'nashysaimarkets/nash-ai-markets',
  organizationId: 'org-icy-butterfly-11039021',
  projectId: 'bitter-grass-28096464',
  branchId: 'br-aged-mode-zaa9u7lr',
  endpointHost: 'ep-silent-fire-za1s230f.c-2.eu-west-2.aws.neon.tech',
  databaseName: 'monaco_ledger', roleName: 'monaco_ledger_runner',
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const requireValue = ok => {if (!ok) throw Error('NEON_AUTH_PROBE_REFUSED');};

/** Catalogs only: the restricted role cannot read the private identity/budget
 * rows. Project/branch identity therefore comes from the accepted control-plane
 * record and pinned TLS endpoint, not a claim about SQL catalog contents. */
export const NEON_AUTH_CATALOG_SQL = `
with runner as (
  select * from pg_catalog.pg_roles where rolname = session_user
), rpc as (
  select * from pg_catalog.pg_proc
  where oid = pg_catalog.to_regprocedure('public.monaco_neon_rpc(jsonb,jsonb,text,jsonb)')
)
select current_database()::text as database_name,
  current_user::text as current_role, session_user::text as session_role,
  (select ssl from pg_catalog.pg_stat_ssl where pid = pg_catalog.pg_backend_pid()) is true as tls_active,
  r.rolcanlogin as can_login,
  not (r.rolsuper or r.rolcreatedb or r.rolcreaterole or r.rolinherit or r.rolreplication or r.rolbypassrls) as limited_role,
  not exists (select 1 from pg_catalog.pg_auth_members where member = r.oid) as no_memberships,
  pg_catalog.has_database_privilege(session_user, current_database(), 'CONNECT') as database_connect,
  not pg_catalog.has_database_privilege(session_user, current_database(), 'CREATE,TEMP') as database_no_create_or_temp,
  pg_catalog.has_schema_privilege(session_user, 'public', 'USAGE') as public_usage,
  not pg_catalog.has_schema_privilege(session_user, 'public', 'CREATE') as public_no_create,
  not pg_catalog.has_schema_privilege(session_user, 'private', 'USAGE,CREATE')
    and not pg_catalog.has_schema_privilege(session_user, 'extensions', 'USAGE,CREATE') as private_schemas_denied,
  (select count(*) = 1 and bool_and(prosecdef and cardinality(proconfig) = 1
    and replace(proconfig[1], ' ', '') = 'search_path=pg_catalog,private') from rpc) as rpc_shape,
  (select bool_and(pg_catalog.has_function_privilege(session_user, oid, 'EXECUTE')) from rpc) as rpc_execute,
  not exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('private', 'public') and p.oid not in (select oid from rpc)
      and pg_catalog.has_function_privilege(session_user, p.oid, 'EXECUTE')) as other_entrypoints_denied,
  not exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relkind in ('r','p','v','m','f')
      and pg_catalog.has_table_privilege(session_user, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) as private_tables_denied,
  not exists (select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relkind = 'S'
      and pg_catalog.has_sequence_privilege(session_user, c.oid, 'USAGE,SELECT,UPDATE')) as private_sequences_denied,
  (select count(*) = 10 and bool_and(c.relrowsecurity and c.relkind = 'r')
    from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relname in (
      'pocket_benchmark_pilot_ledgers','pocket_benchmark_pilot_cases','pocket_benchmark_pilot_calls',
      'pocket_benchmark_pilot_cost_attestations','pocket_benchmark_budget_configs','pocket_benchmark_budget_accounts',
      'monaco_runner_binding','monaco_prior_budget','monaco_request_pins','monaco_neon_identity')) as expected_tables_rls,
  (select count(*) = 8 and bool_and(not t.tgisinternal and t.tgenabled in ('O','A'))
    from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and (c.relname || ':' || t.tgname) in (
      'monaco_neon_identity:monaco_neon_identity_immutable','monaco_neon_identity:monaco_neon_identity_no_reset',
      'monaco_runner_binding:monaco_binding_immutable','monaco_runner_binding:monaco_binding_no_reset',
      'monaco_prior_budget:monaco_prior_immutable','monaco_prior_budget:monaco_prior_no_reset',
      'monaco_request_pins:monaco_pins_immutable','monaco_request_pins:monaco_pins_no_reset')) as immutable_guards_present
from runner r`;

const REQUIRED_TRUE = Object.freeze(['can_login','limited_role','no_memberships',
  'database_connect','database_no_create_or_temp','public_usage','public_no_create','private_schemas_denied',
  'rpc_shape','rpc_execute','other_entrypoints_denied','private_tables_denied','private_sequences_denied',
  'expected_tables_rls','immutable_guards_present']);

/** Also usable on a tool-returned row. This validates catalog facts only; it
 * does not attest which password or transport the external caller used. */
export function validateNeonAuthCatalog(rows) {
  requireValue(Array.isArray(rows) && rows.length === 1);
  const row = rows[0];
  requireValue(row && row.database_name === NEON_AUTH_PINS.databaseName &&
    row.current_role === NEON_AUTH_PINS.roleName && row.session_role === NEON_AUTH_PINS.roleName &&
    typeof row.tls_active === 'boolean' &&
    REQUIRED_TRUE.every(name => row[name] === true));
  return true;
}

/** Neon authenticates through a proxy. pg_stat_ssl describes Postgres's backend
 * connection, so retain it as an observation, not upstream TLS proof:
 * https://neon.com/docs/security/security-overview
 * https://www.postgresql.org/docs/current/monitoring-stats.html#MONITORING-PG-STAT-SSL-VIEW
 * pg 8.16.3 connection.stream is the node:tls socket created by tls.connect.
 * Inspect that connected socket; declared ssl configuration alone is not proof.
 */
function verifiedClientTls(client) {
  const socket = client?.connection?.stream;
  requireValue(socket instanceof TLSSocket && socket.encrypted === true && socket.authorized === true &&
    socket.servername === NEON_AUTH_PINS.endpointHost && !socket.authorizationError);
  return socket;
}

function validateContext(context, identityEvidenceBytes) {
  requireValue(context?.repository === NEON_AUTH_PINS.repository &&
    /^[a-f0-9]{40}$/.test(context.reviewedSourceSha ?? '') &&
    context.sourceSha === context.reviewedSourceSha &&
    /^[a-f0-9]{64}$/.test(context.reviewedIdentityEvidenceSha256 ?? '') &&
    identityEvidenceBytes instanceof Uint8Array);
  const bytes = Buffer.from(identityEvidenceBytes);
  requireValue(hash(bytes) === context.reviewedIdentityEvidenceSha256);
  const evidence = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
  requireValue(evidence.kind === 'VERIFIED_NEON_LEDGER_CONTROL_PLANE_V1' &&
    Object.entries(NEON_AUTH_PINS).filter(([key]) => key !== 'repository')
      .every(([key, value]) => evidence[key] === value));
  return {sourceSha: context.reviewedSourceSha, identityEvidenceSha256: hash(bytes)};
}

/** One connection, one fixed SELECT, one close. Budget/processor records may be
 * absent: this proves authentication and limited privileges, never admission.
 * Password reads occur only after the immutable source/evidence checks. */
export async function probeNeonAuthentication({context, identityEvidenceBytes, readLedgerPassword, createClient}) {
  let client;
  const common = {kind:'MONACO_NEON_AUTH_ONLY_V1', providerRequests:0, databaseWrites:0,
    paidDispatchEnabled:false, budgetHeadroom:'NOT_INSPECTED',
    githubSecretBinding:'NOT_ATTESTED_BY_THIS_LIBRARY',
    projectBranchIdentity:'REUSED_PINNED_CONTROL_PLANE_EVIDENCE'};
  try {
    const admission = validateContext(context, identityEvidenceBytes);
    requireValue(typeof readLedgerPassword === 'function' && typeof createClient === 'function');
    const password = readLedgerPassword();
    requireValue(typeof password === 'string' && password.length >= 24);
    client = createClient({host:NEON_AUTH_PINS.endpointHost, port:5432,
      database:NEON_AUTH_PINS.databaseName, user:NEON_AUTH_PINS.roleName, password,
      ssl:{rejectUnauthorized:true, servername:NEON_AUTH_PINS.endpointHost},
      options:'-c default_transaction_read_only=on', connectionTimeoutMillis:10000,
      statement_timeout:15000, query_timeout:20000, application_name:'monaco-neon-auth-only'});
    await client.connect();
    const tlsSocket = verifiedClientTls(client);
    const result = await client.query(NEON_AUTH_CATALOG_SQL);
    requireValue(verifiedClientTls(client) === tlsSocket);
    validateNeonAuthCatalog(result?.rows);
    return {...common, status:'PASS', ...admission, passwordAuthenticationVerified:true,
      limitedPrivilegesVerified:true, schemaShapeVerified:true, clientTlsVerified:true,
      backendTlsObserved:result.rows[0].tls_active};
  } catch {
    return {...common, status:'HOLD',
      reason:'Pinned source, identity evidence, authentication or catalog checks failed; no retry performed.'};
  } finally {
    if (client) {try {await client.end();} catch { /* Never expose driver errors. */ }}
  }
}
