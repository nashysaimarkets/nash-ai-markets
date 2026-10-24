-- OFFLINE PREPARED ONLY. Root executes after the actual d002 terminal run.
-- The returned identity must be independently matched to that new permit/run; this file grants no admission.
-- Independent owner read after terminal execution; no RPC or mutation.
BEGIN READ ONLY;
SET LOCAL timezone='UTC';
SET LOCAL statement_timeout='30s';
WITH s AS (SELECT * FROM private.monaco_scanner_eval_v2_scopes WHERE scope_id='pocket-scanner-evaluation-v2-20261024'),
p AS (SELECT * FROM private.monaco_scanner_eval_v2_permits WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND case_id='v2-d002'),
c AS (SELECT * FROM private.monaco_scanner_eval_v2_claims WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND case_id='v2-d002'),
a AS (SELECT * FROM private.monaco_scanner_eval_v2_accounts WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND case_id='v2-d002')
SELECT jsonb_build_object(
 'kind','POCKET_SCANNER_EVALUATION_V2_INDEPENDENT_LEDGER_RECONCILIATION',
 'observedAt',clock_timestamp(),'databaseName',current_database(),'sessionUser',session_user,'currentUser',current_user,
 'scope',(SELECT to_jsonb(s) FROM s),'permit',(SELECT to_jsonb(p) FROM p),'claim',(SELECT to_jsonb(c) FROM c),'account',(SELECT to_jsonb(a) FROM a),
 'submissions',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY slot),'[]'::jsonb) FROM private.monaco_scanner_eval_v2_submissions t WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND case_id='v2-d002'),
 'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY slot),'[]'::jsonb) FROM private.monaco_scanner_eval_v2_receipts t WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND case_id='v2-d002'),
 'stops',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM private.monaco_scanner_eval_v2_stops t WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND case_id='v2-d002'),
 'revocations',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM private.monaco_scanner_eval_v2_revocations t WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND target IN ('scope','v2-d002-attempt-1')),
 'originalHistorySha256',private.monaco_scanner_eval_v2_original_digest(),
 'computedReceiptSha256',private.monaco_scanner_eval_v2_receipt_digest('pocket-scanner-evaluation-v2-20261024','v2-d002'),
 'originalHeldMicroUsd',(SELECT coalesce(sum(greatest(estimated_microusd,coalesce(actual_microusd,estimated_microusd))),0) FROM private.pocket_benchmark_pilot_calls WHERE ledger_key='monaco-first-six-aggregate' AND status IN ('reserved','submitted','settled')),
 'evaluationHeldMicroUsd',(SELECT coalesce(sum(reserved_microusd),0) FROM private.monaco_scanner_eval_v2_claims),
 'aggregateCapMicroUsd',(SELECT cap_microusd FROM private.pocket_benchmark_pilot_ledgers WHERE ledger_key='monaco-first-six-aggregate'),
 'scopeCount',(SELECT count(*) FROM private.monaco_scanner_eval_v2_scopes),'permitCount',(SELECT count(*) FROM private.monaco_scanner_eval_v2_permits),
 'claimCount',(SELECT count(*) FROM private.monaco_scanner_eval_v2_claims),'accountCount',(SELECT count(*) FROM private.monaco_scanner_eval_v2_accounts),
 'previousCase',jsonb_build_object(
  'caseId','v2-d001',
  'permit',(SELECT to_jsonb(t) FROM private.monaco_scanner_eval_v2_permits t WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND case_id='v2-d001'),
  'claim',(SELECT to_jsonb(t) FROM private.monaco_scanner_eval_v2_claims t WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND case_id='v2-d001'),
  'account',(SELECT to_jsonb(t) FROM private.monaco_scanner_eval_v2_accounts t WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND case_id='v2-d001'),
  'submissions',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY slot),'[]'::jsonb) FROM private.monaco_scanner_eval_v2_submissions t WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND case_id='v2-d001'),
  'receipts',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY slot),'[]'::jsonb) FROM private.monaco_scanner_eval_v2_receipts t WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND case_id='v2-d001'),
  'stops',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM private.monaco_scanner_eval_v2_stops t WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND case_id='v2-d001'),
  'revocations',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM private.monaco_scanner_eval_v2_revocations t WHERE scope_id='pocket-scanner-evaluation-v2-20261024' AND target IN ('scope','v2-d001-attempt-1')),
  'computedReceiptSha256',private.monaco_scanner_eval_v2_receipt_digest('pocket-scanner-evaluation-v2-20261024','v2-d001')),
 'submissionCount',(SELECT count(*) FROM private.monaco_scanner_eval_v2_submissions),
 'receiptCount',(SELECT count(*) FROM private.monaco_scanner_eval_v2_receipts),
 'stopCount',(SELECT count(*) FROM private.monaco_scanner_eval_v2_stops),
 'unreceiptedSubmissionCount',(SELECT count(*) FROM private.monaco_scanner_eval_v2_submissions d LEFT JOIN private.monaco_scanner_eval_v2_receipts r USING(scope_id,case_id,slot) WHERE r.slot IS NULL),
 'unaccountedClaimCount',(SELECT count(*) FROM private.monaco_scanner_eval_v2_claims c LEFT JOIN private.monaco_scanner_eval_v2_accounts a USING(scope_id,case_id) WHERE a.case_id IS NULL),
 'runnerRestricted',(SELECT NOT(rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls)
  AND NOT EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid) AND NOT has_schema_privilege(r.oid,'private','USAGE')
  AND has_function_privilege(r.oid,'public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)','EXECUTE')
  FROM pg_roles r WHERE rolname='monaco_ledger_runner'),
 'recoveryPrior',jsonb_build_object(
  'permit',(SELECT to_jsonb(t) FROM private.monaco_scanner_eval_v2_permits t WHERE case_id='v2-d001'),
  'claim',(SELECT to_jsonb(t) FROM private.monaco_scanner_eval_v2_claims t WHERE case_id='v2-d001'),
  'account',(SELECT to_jsonb(t) FROM private.monaco_scanner_eval_v2_accounts t WHERE case_id='v2-d001'),
  'submissions',(SELECT jsonb_agg(to_jsonb(t) ORDER BY slot) FROM private.monaco_scanner_eval_v2_submissions t WHERE case_id='v2-d001'),
  'receipts',(SELECT jsonb_agg(to_jsonb(t) ORDER BY slot) FROM private.monaco_scanner_eval_v2_receipts t WHERE case_id='v2-d001'),
  'pins',(SELECT jsonb_agg(to_jsonb(t) ORDER BY case_id,slot) FROM private.monaco_scanner_eval_v2_pins t)),
 'recoveryInstalled',to_regclass('private.monaco_scanner_eval_v2_unused_leases') IS NOT NULL,
 'originalRpcBodySha256',(SELECT encode(extensions.digest(convert_to(prosrc,'UTF8'),'sha256'),'hex') FROM pg_proc WHERE oid='public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)'::regprocedure),
 'actualMicroUsd',NULL,'financiallySettled',false,
 'runner',(SELECT jsonb_build_object('canLogin',rolcanlogin,'validUntil',rolvaliduntil,
  'sessions',(SELECT count(*) FROM pg_stat_activity WHERE usename='monaco_ledger_runner')) FROM pg_roles WHERE rolname='monaco_ledger_runner')
) AS reconciliation;
COMMIT;
