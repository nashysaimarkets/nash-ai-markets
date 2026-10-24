-- Proposed continuation of the SAME first-six allowance, after d001 stopped.
-- No original binding, receipt, reservation, account, request pin or key changes.
-- The existing role keeps exactly its existing public RPC permission.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $install$
BEGIN
 IF current_database()<>'monaco_ledger' OR session_user<>'monaco_ledger_owner'
  OR current_user<>'monaco_ledger_owner' THEN RAISE EXCEPTION 'Exact isolated owner required'; END IF;
 IF to_regclass('private.monaco_first_six_continuation') IS NOT NULL THEN
  RAISE EXCEPTION 'Continuation schema already exists; never repeat installation'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.monaco_neon_identity WHERE singleton
  AND organization_id='org-icy-butterfly-11039021' AND project_id='bitter-grass-28096464'
  AND branch_id='br-aged-mode-zaa9u7lr' AND database_name=current_database()
  AND endpoint_host='ep-silent-fire-za1s230f.c-2.eu-west-2.aws.neon.tech'
  AND runner_role='monaco_ledger_runner'
  AND control_plane_evidence_sha256='32c788992c1909a8c704e35744f94ebb6df82fd121cff4878653a1d1da03dfc1')
  OR NOT EXISTS(SELECT 1 FROM private.monaco_runner_binding WHERE singleton
   AND ledger_key='monaco-first-six-aggregate'
   AND runner_source_sha='9e82c6d25dcb7f589e2328b2efc7910033d8fcdc'
   AND binding_evidence_sha256='e4d5484e473dd4ac0884816e652f549d04127426a07056738d744a92fa50902e') THEN
  RAISE EXCEPTION 'Original admitted identity required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='monaco_ledger_runner' AND NOT rolcanlogin
  AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit
  AND NOT rolreplication AND NOT rolbypassrls)
  OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='monaco_ledger_runner')
  OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='monaco_ledger_runner') THEN
  RAISE EXCEPTION 'Inactive restricted runner required'; END IF;
END $install$;

CREATE TABLE private.monaco_first_six_continuation (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton)
  REFERENCES private.monaco_runner_binding(singleton),
 ledger_key text NOT NULL CHECK(ledger_key='monaco-first-six-aggregate'),
 original_source_sha text NOT NULL CHECK(original_source_sha='9e82c6d25dcb7f589e2328b2efc7910033d8fcdc'),
 original_run_id text NOT NULL CHECK(original_run_id='40083992183'),
 original_evidence_sha text NOT NULL CHECK(original_evidence_sha='4ebb6a4023d7a01ca5188d54f592264acf48644b'),
 original_binding_evidence_sha256 text NOT NULL
  CHECK(original_binding_evidence_sha256='e4d5484e473dd4ac0884816e652f549d04127426a07056738d744a92fa50902e'),
 successor_source_sha text NOT NULL CHECK(successor_source_sha ~ '^[a-f0-9]{40}$' AND successor_source_sha<>original_source_sha),
 evidence_sha text NOT NULL CHECK(evidence_sha ~ '^[a-f0-9]{40}$'),
 run_id text NOT NULL CHECK(run_id ~ '^[1-9][0-9]{0,19}$' AND run_id<>original_run_id),
 run_attempt integer NOT NULL CHECK(run_attempt=1),
 prior_receipt_sha256 text NOT NULL CHECK(prior_receipt_sha256 ~ '^[a-f0-9]{64}$'),
 prior_committed_microusd bigint NOT NULL CHECK(prior_committed_microusd=216800),
 request_pins_sha256 text NOT NULL CHECK(request_pins_sha256 ~ '^[a-f0-9]{64}$'),
 prior_budget_evidence_sha256 text NOT NULL CHECK(prior_budget_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 binding_evidence_sha256 text NOT NULL CHECK(binding_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 authorization_evidence_sha256 text NOT NULL CHECK(authorization_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 allowed_case_ids text[] NOT NULL CHECK(allowed_case_ids=ARRAY['d002','d003','d004','d005','d006']::text[]),
 maximum_additional_sends integer NOT NULL CHECK(maximum_additional_sends=15),
 maximum_additional_microusd bigint NOT NULL CHECK(maximum_additional_microusd=1598000),
 maximum_combined_microusd bigint NOT NULL CHECK(maximum_combined_microusd=1814800),
 authorized_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 valid_until timestamptz NOT NULL,
 CHECK(valid_until>authorized_at AND valid_until<=authorized_at+INTERVAL '60 minutes')
);
ALTER TABLE private.monaco_first_six_continuation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.monaco_first_six_continuation FROM public,monaco_ledger_runner;
CREATE TRIGGER monaco_continuation_immutable BEFORE UPDATE OR DELETE ON private.monaco_first_six_continuation
 FOR EACH ROW EXECUTE FUNCTION private.block_pocket_benchmark_budget_change();
CREATE TRIGGER monaco_continuation_no_reset BEFORE TRUNCATE ON private.monaco_first_six_continuation
 FOR EACH STATEMENT EXECUTE FUNCTION private.block_pocket_benchmark_budget_change();

CREATE FUNCTION private.monaco_first_six_pin_digest() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
 SELECT encode(extensions.digest(convert_to(string_agg(case_id||':'||slot||':'||fingerprint,E'\n'
  ORDER BY case_id,slot),'UTF8'),'sha256'),'hex') FROM private.monaco_request_pins
$$;

-- Validate the immutable predecessor without changing its financial state.
CREATE FUNCTION private.monaco_first_six_d001_accounted(p_digest text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,private AS $$
 SELECT EXISTS(SELECT 1 FROM private.pocket_benchmark_budget_accounts
  WHERE ledger_key='monaco-first-six-aggregate' AND case_id='d001'
   AND reserved_microusd=216800 AND receipt_sha256=p_digest)
 AND private.pocket_benchmark_receipt_digest('monaco-first-six-aggregate','d001')=p_digest
 AND (SELECT count(*) FROM private.pocket_benchmark_pilot_cases
  WHERE ledger_key='monaco-first-six-aggregate' AND case_id='d001'
   AND candidate_sha='f5e820b0bd7bf095153e31d692a10fb3640ba16e')=1
 AND (SELECT count(*) FROM private.pocket_benchmark_pilot_calls
  WHERE ledger_key='monaco-first-six-aggregate' AND case_id='d001')=3
 AND (SELECT count(*) FROM private.pocket_benchmark_pilot_calls
  WHERE ledger_key='monaco-first-six-aggregate' AND case_id='d001'
   AND slot IN ('main','primary_precision') AND status='submitted'
   AND receipt_recorded_at IS NOT NULL AND provider_request_id IS NOT NULL
   AND provider_response_id IS NOT NULL AND provider_model=model
   AND provider_service_tier=service_tier AND provider_usage IS NOT NULL)=2
 AND EXISTS(SELECT 1 FROM private.pocket_benchmark_pilot_calls
  WHERE ledger_key='monaco-first-six-aggregate' AND case_id='d001' AND slot='rescue_precision'
   AND status='voided' AND submitted_at IS NULL AND voided_at IS NOT NULL
   AND receipt_recorded_at IS NULL AND provider_request_id IS NULL AND provider_response_id IS NULL)
$$;

CREATE FUNCTION private.assert_monaco_first_six_continuation(p_key text,p_identity jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE b private.monaco_runner_binding%rowtype; c private.monaco_first_six_continuation%rowtype;
 p private.monaco_prior_budget%rowtype; cfg private.pocket_benchmark_budget_configs%rowtype;
 x jsonb; s jsonb;
BEGIN
 IF jsonb_typeof(p_identity) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Continuation identity required'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(p_identity))<>8
  OR p_identity-ARRAY['environment','sourceSha','backendRef','projectRef','keyTrackingId','keyFingerprintSha256','planSha256','continuation']<>'{}'::jsonb THEN
  RAISE EXCEPTION 'Exact continuation identity fields required'; END IF;
 x:=p_identity->'continuation';
 IF jsonb_typeof(x) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Bound continuation context required'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(x))<>6
  OR x-ARRAY['originalSourceSha','originalRunId','evidenceSha','runId','runAttempt','priorReceiptSha256']<>'{}'::jsonb THEN
  RAISE EXCEPTION 'Exact continuation context fields required'; END IF;
 SELECT * INTO STRICT b FROM private.monaco_runner_binding WHERE singleton;
 SELECT * INTO STRICT c FROM private.monaco_first_six_continuation WHERE singleton;
 SELECT * INTO STRICT p FROM private.monaco_prior_budget WHERE singleton;
 IF p_key IS DISTINCT FROM c.ledger_key OR b.ledger_key IS DISTINCT FROM c.ledger_key
  OR b.runner_source_sha IS DISTINCT FROM c.original_source_sha
  OR b.binding_evidence_sha256 IS DISTINCT FROM c.original_binding_evidence_sha256
  OR p.evidence_sha256 IS DISTINCT FROM c.prior_budget_evidence_sha256
  OR p.spent_microusd+p.reserved_microusd+p.unresolved_microusd<>0
  OR row(p_identity->>'environment',p_identity->>'sourceSha',p_identity->>'backendRef',
   p_identity->>'projectRef',p_identity->>'keyTrackingId',p_identity->>'keyFingerprintSha256',p_identity->>'planSha256')
   IS DISTINCT FROM row(b.environment_name,c.successor_source_sha,b.backend_ref,
    b.project_ref,b.existing_key_tracking_id,b.key_fingerprint_sha256,b.plan_sha256)
  OR row(x->>'originalSourceSha',x->>'originalRunId',x->>'evidenceSha',x->>'runId',x->>'runAttempt',x->>'priorReceiptSha256')
   IS DISTINCT FROM row(c.original_source_sha,c.original_run_id,c.evidence_sha,c.run_id,'1',c.prior_receipt_sha256)
  OR c.authorized_at>clock_timestamp() OR c.valid_until<=clock_timestamp() THEN
  RAISE EXCEPTION 'Exact current continuation admission required'; END IF;
 IF (SELECT count(*) FROM private.monaco_request_pins)<>18
  OR private.monaco_first_six_pin_digest() IS DISTINCT FROM c.request_pins_sha256
  OR private.monaco_first_six_d001_accounted(c.prior_receipt_sha256) IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'Original requests and predecessor accounting must be unchanged'; END IF;
 s:=private.monaco_budget_state(p_key);
 PERFORM private.assert_pocket_benchmark_budget_config(p_key);
 SELECT * INTO STRICT cfg FROM private.pocket_benchmark_budget_configs WHERE ledger_key=p_key
  ORDER BY verified_at DESC,runtime_evidence_sha256 DESC LIMIT 1;
 IF cfg.runtime_evidence_sha256 IS DISTINCT FROM c.binding_evidence_sha256
  OR cfg.valid_until IS DISTINCT FROM c.valid_until
  OR (s->>'prior_exposure_microusd')::bigint IS DISTINCT FROM 0
  OR (s->>'new_commitments_microusd')::bigint<c.prior_committed_microusd
  OR (s->>'new_commitments_microusd')::bigint>c.maximum_combined_microusd
  OR (SELECT count(*) FROM private.pocket_benchmark_pilot_cases
   WHERE ledger_key=p_key AND case_id=ANY(c.allowed_case_ids))>5
  OR (SELECT count(*) FROM private.pocket_benchmark_pilot_calls
   WHERE ledger_key=p_key AND case_id=ANY(c.allowed_case_ids))>c.maximum_additional_sends THEN
  RAISE EXCEPTION 'Continuation exposure or reviewed configuration changed'; END IF;
 RETURN s||jsonb_build_object('binding_matches',true,'setup_only',true,
  'continuation_allowed',true,'continuation_case_ids',to_jsonb(c.allowed_case_ids),
  'predecessor_source_sha',c.original_source_sha,'predecessor_run_id',c.original_run_id,
  'prior_receipt_sha256',c.prior_receipt_sha256,'continuation_run_id',c.run_id,
  'continuation_evidence_sha',c.evidence_sha,'continuation_source_sha',c.successor_source_sha,
  'continuation_valid_until',c.valid_until,'continuation_previous_commitments_microusd',c.prior_committed_microusd);
END $$;

-- The original source continues through its original checks. A different source
-- is recognised honestly only by the separately recorded continuation identity.
CREATE OR REPLACE FUNCTION private.inspect_monaco_isolated_runner(p_key text,p_identity jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE b private.monaco_runner_binding%rowtype; s jsonb;
BEGIN
 SELECT * INTO b FROM private.monaco_runner_binding WHERE singleton;
 IF p_identity->>'sourceSha' IS DISTINCT FROM b.runner_source_sha THEN
  RETURN private.assert_monaco_first_six_continuation(p_key,p_identity);
 END IF;
 IF jsonb_typeof(p_identity) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Exact original identity required'; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(p_identity))<>7
  OR p_identity-ARRAY['environment','sourceSha','backendRef','projectRef','keyTrackingId','keyFingerprintSha256','planSha256']<>'{}'::jsonb THEN
  RAISE EXCEPTION 'Exact original identity required; continuation cannot impersonate its predecessor'; END IF;
 s:=private.monaco_budget_state(p_key);
 PERFORM private.assert_pocket_benchmark_budget_config(p_key);
 IF p_identity IS NULL OR row(p_identity->>'environment',p_identity->>'sourceSha',p_identity->>'backendRef',
   p_identity->>'projectRef',p_identity->>'keyTrackingId',p_identity->>'keyFingerprintSha256',p_identity->>'planSha256')
  IS DISTINCT FROM row(b.environment_name,b.runner_source_sha,b.backend_ref,b.project_ref,b.existing_key_tracking_id,b.key_fingerprint_sha256,b.plan_sha256) THEN
  RAISE EXCEPTION 'protected runner identity mismatch'; END IF;
 RETURN s||jsonb_build_object('binding_matches',true,'setup_only',true);
END $$;

-- Same public signature, grants, fixed physical identity and operations. The
-- successor adds a case restriction before calling UNCHANGED financial helpers.
CREATE OR REPLACE FUNCTION public.monaco_neon_rpc(p_neon jsonb,p_identity jsonb,p_operation text,p_args jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE n private.monaco_neon_identity%rowtype; budget jsonb; k text;
BEGIN
 SELECT * INTO n FROM private.monaco_neon_identity WHERE singleton;
 IF NOT FOUND OR session_user<>n.runner_role OR current_database()<>n.database_name
  OR n.verified_at>clock_timestamp()
  OR p_neon IS DISTINCT FROM jsonb_build_object('organizationId',n.organization_id,'projectId',n.project_id,
   'branchId',n.branch_id,'endpointHost',n.endpoint_host,'databaseName',n.database_name,
   'roleName',n.runner_role,'controlPlaneEvidenceSha256',n.control_plane_evidence_sha256)
  OR p_identity->>'backendRef' IS DISTINCT FROM n.backend_ref THEN
  RAISE EXCEPTION 'Verified Neon endpoint/database/role binding required'; END IF;
 k:=CASE WHEN p_operation='inspect_monaco_isolated_runner' THEN p_args->>'p_key' ELSE p_args->>'p_ledger_key' END;
 budget:=private.inspect_monaco_isolated_runner(k,p_identity);
 IF budget->>'continuation_allowed'='true' AND p_operation<>'inspect_monaco_isolated_runner'
  AND NOT coalesce(p_args->>'p_case_id'=ANY(ARRAY['d002','d003','d004','d005','d006']),false) THEN
  RAISE EXCEPTION 'Continuation cannot operate on predecessor or held-out cases'; END IF;
 CASE p_operation
 WHEN 'inspect_monaco_isolated_runner' THEN RETURN budget;
 WHEN 'claim_pocket_benchmark_case' THEN
  RETURN private.claim_pocket_benchmark_case(k,p_args->>'p_case_id',p_args->>'p_project_ref',
   p_args->>'p_owner_approval_ref',p_args->>'p_candidate_sha',p_args->'p_plan');
 WHEN 'submit_pocket_benchmark_call' THEN
  RETURN private.submit_pocket_benchmark_call(k,p_args->>'p_case_id',p_args->>'p_slot',p_args->>'p_envelope_sha256');
 WHEN 'record_pocket_benchmark_receipt' THEN
  RETURN private.record_pocket_benchmark_receipt(k,p_args->>'p_case_id',p_args->>'p_slot',p_args->>'p_provider_request_id',
   p_args->>'p_response_id',p_args->>'p_model',p_args->>'p_service_tier',p_args->'p_usage',p_args->>'p_envelope_sha256');
 WHEN 'void_pocket_benchmark_call' THEN
  RETURN private.void_pocket_benchmark_call(k,p_args->>'p_case_id',p_args->>'p_slot',p_args->>'p_reason');
 WHEN 'account_pocket_benchmark_reserved_case' THEN
  RETURN private.account_pocket_benchmark_reserved_case(k,p_args->>'p_case_id');
 ELSE RAISE EXCEPTION 'Operation outside isolated ledger allowlist';
 END CASE;
END $$;
REVOKE ALL ON FUNCTION private.monaco_first_six_pin_digest(),private.monaco_first_six_d001_accounted(text),
 private.assert_monaco_first_six_continuation(text,jsonb) FROM public,monaco_ledger_runner;
COMMIT;
