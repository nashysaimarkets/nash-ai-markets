-- Owner-only, read-only carry-in BEFORE the proposed v2 migration/admission.
-- Exact database-native digest encoding from the accepted v2_original_digest.
-- The previous continuation table is known installed; absence must fail closed.
-- Retain the complete observation. Feed ONLY its carryIn object to the builder.
-- Every checks value must be true; later invocations still retain all old rows.
BEGIN READ ONLY;
SET LOCAL timezone='UTC';
SET LOCAL statement_timeout='30s';
WITH history_rows AS (
 SELECT 'monaco_neon_identity'::text AS name, coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM private.monaco_neon_identity t
 UNION ALL
 SELECT 'monaco_runner_binding'::text AS name, coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM private.monaco_runner_binding t
 UNION ALL
 SELECT 'monaco_prior_budget'::text AS name, coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM private.monaco_prior_budget t
 UNION ALL
 SELECT 'monaco_request_pins'::text AS name, coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM private.monaco_request_pins t
 UNION ALL
 SELECT 'pocket_benchmark_pilot_ledgers'::text AS name, coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM private.pocket_benchmark_pilot_ledgers t
 UNION ALL
 SELECT 'pocket_benchmark_pilot_cases'::text AS name, coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM private.pocket_benchmark_pilot_cases t
 UNION ALL
 SELECT 'pocket_benchmark_pilot_calls'::text AS name, coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM private.pocket_benchmark_pilot_calls t
 UNION ALL
 SELECT 'pocket_benchmark_budget_accounts'::text AS name, coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM private.pocket_benchmark_budget_accounts t
 UNION ALL
 SELECT 'pocket_benchmark_budget_configs'::text AS name, coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM private.pocket_benchmark_budget_configs t
 UNION ALL
 SELECT 'pocket_benchmark_pilot_cost_attestations'::text AS name, coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM private.pocket_benchmark_pilot_cost_attestations t
 UNION ALL
 SELECT 'monaco_first_six_continuation'::text AS name, coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows FROM private.monaco_first_six_continuation t
), history AS (
 SELECT encode(extensions.digest(convert_to(jsonb_object_agg(name,rows)::text,'UTF8'),'sha256'),'hex') AS sha256 FROM history_rows
), pins AS (
 SELECT encode(extensions.digest(convert_to(string_agg(case_id||':'||slot||':'||fingerprint,E'\n' ORDER BY case_id,slot),'UTF8'),'sha256'),'hex') AS sha256 FROM private.monaco_request_pins
), totals AS (
 SELECT coalesce(sum(greatest(estimated_microusd,coalesce(actual_microusd,estimated_microusd))) FILTER (WHERE status IN ('reserved','submitted','settled')),0) AS held,
 count(*) AS slots,
 count(*) FILTER (WHERE status='submitted' AND receipt_recorded_at IS NOT NULL AND provider_request_id IS NOT NULL
  AND provider_response_id IS NOT NULL AND provider_model=model AND provider_service_tier=service_tier AND provider_usage IS NOT NULL) AS receipts,
 count(*) FILTER (WHERE status='voided' AND slot='rescue_precision' AND case_id IN ('d001','d002','d003','d006')
  AND submitted_at IS NULL AND receipt_recorded_at IS NULL) AS voids,
 sum(actual_microusd) AS actual
 FROM private.pocket_benchmark_pilot_calls WHERE ledger_key='monaco-first-six-aggregate'
), runner AS (
 SELECT r.*,(SELECT count(*) FROM pg_auth_members m WHERE m.member=r.oid) AS memberships,
 (SELECT count(*) FROM pg_stat_activity a WHERE a.usename=r.rolname) AS sessions FROM pg_roles r WHERE r.rolname='monaco_ledger_runner'
), counts AS (
 SELECT (SELECT count(*) FROM private.pocket_benchmark_pilot_cases) AS cases,
 (SELECT count(*) FROM private.pocket_benchmark_budget_accounts) AS accounts,
 (SELECT count(*) FROM private.pocket_benchmark_pilot_cost_attestations) AS cost_attestations
), checks AS (
 SELECT
 current_database()='monaco_ledger' AND session_user='monaco_ledger_owner' AND current_user='monaco_ledger_owner' AS exact_owner,
 (SELECT count(*)=1 FROM private.pocket_benchmark_pilot_ledgers) AND EXISTS(
  SELECT 1 FROM private.pocket_benchmark_pilot_ledgers WHERE ledger_key='monaco-first-six-aggregate' AND cap_microusd=5000000
  AND owner_approval_ref='comment-6165012632' AND candidate_sha='f5e820b0bd7bf095153e31d692a10fb3640ba16e'
  AND allowed_case_ids=ARRAY['d001','d002','d003','d004','d005','d006']::text[]) AS exact_original_allowance,
 EXISTS(SELECT 1 FROM private.monaco_neon_identity WHERE singleton
  AND organization_id='org-icy-butterfly-11039021' AND project_id='bitter-grass-28096464' AND branch_id='br-aged-mode-zaa9u7lr'
  AND endpoint_host='ep-silent-fire-za1s230f.c-2.eu-west-2.aws.neon.tech' AND database_name='monaco_ledger'
  AND runner_role='monaco_ledger_runner' AND control_plane_evidence_sha256='32c788992c1909a8c704e35744f94ebb6df82fd121cff4878653a1d1da03dfc1') AS exact_neon_identity,
 EXISTS(SELECT 1 FROM private.monaco_runner_binding WHERE singleton AND ledger_key='monaco-first-six-aggregate'
  AND runner_source_sha='9e82c6d25dcb7f589e2328b2efc7910033d8fcdc'
  AND binding_evidence_sha256='e4d5484e473dd4ac0884816e652f549d04127426a07056738d744a92fa50902e'
  AND project_ref='proj_LTmAIE2Ve7gUAFJ9M74ZxIBI' AND existing_key_tracking_id='key_aD5pc20EZBLGECNC'
  AND key_fingerprint_sha256='107e0cb3265e15aa25e3fa49c91512096f84b43d5fa834761c73c3cce2c99d0e') AS exact_original_binding,
 (SELECT count(*)=1 FROM private.monaco_first_six_continuation) AS prior_continuation_present,
 counts.cases=6 AND totals.slots=18 AND (SELECT count(*)=18 FROM private.pocket_benchmark_pilot_calls)
  AND totals.receipts=14 AND totals.voids=4 AND counts.accounts=6 AS original_counts_match,
 (SELECT count(*)=18 FROM private.monaco_request_pins)
  AND pins.sha256='90c4291252904ab977314d5c8010615bea2571c7efc5cddc0ae16df9f7d31165' AS original_pins_match,
 totals.held=1506400 AND (SELECT coalesce(sum(reserved_microusd),0)=1506400 FROM private.pocket_benchmark_budget_accounts)
  AND NOT EXISTS(SELECT 1 FROM private.pocket_benchmark_budget_accounts a WHERE a.receipt_sha256 IS DISTINCT FROM private.pocket_benchmark_receipt_digest(a.ledger_key,a.case_id)) AS original_accounts_match,
 counts.cost_attestations=0 AND totals.actual IS NULL AS actual_cost_unknown,
 (SELECT spent_microusd+reserved_microusd+unresolved_microusd=0 FROM private.monaco_prior_budget WHERE singleton) AS prior_budget_zero,
 coalesce((SELECT NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit
  AND NOT rolreplication AND NOT rolbypassrls AND memberships=0 AND sessions=0 FROM runner),false) AS runner_inactive_restricted
 FROM counts,totals,pins
)
SELECT jsonb_build_object('observedAt',clock_timestamp(),'checks',to_jsonb(checks),
 'carryIn',jsonb_build_object('observedAt',clock_timestamp(),'originalHistorySha256',history.sha256,'originalPinsSha256',pins.sha256,
  'originalCases',counts.cases,'originalSlots',totals.slots,'originalReceipts',totals.receipts,'originalVoided',totals.voids,
  'originalAccounts',counts.accounts,'originalHeldMicroUsd',totals.held,'actualMicroUsd',totals.actual,
  'runnerCanLogin',(SELECT rolcanlogin FROM runner),'runnerSessions',(SELECT sessions FROM runner)),
 'role',coalesce((SELECT jsonb_build_object('rolname',rolname,'rolcanlogin',rolcanlogin,'rolvaliduntil',rolvaliduntil,
  'memberships',memberships,'runnerSessions',sessions) FROM runner),'null'::jsonb),
 'v2ScopeTableAlreadyInstalled',to_regclass('private.monaco_scanner_eval_v2_scopes') IS NOT NULL,
 'financiallySettled',false) AS observation
FROM history,pins,totals,counts,checks;
COMMIT;
