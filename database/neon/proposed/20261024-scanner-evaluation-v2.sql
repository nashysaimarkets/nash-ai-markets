-- PROPOSED / UNINSTALLED. A future explicit extension approval is required.
-- No existing binding, approval, request pin, receipt or function is replaced.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $install$
BEGIN
 IF current_database()<>'monaco_ledger' OR session_user<>'monaco_ledger_owner'
  OR current_user<>'monaco_ledger_owner' THEN RAISE EXCEPTION 'Exact isolated owner required'; END IF;
 IF to_regclass('private.monaco_scanner_eval_v2_scopes') IS NOT NULL THEN
  RAISE EXCEPTION 'Evaluation v2 already installed; never reset'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='monaco_ledger_runner' AND NOT rolcanlogin
  AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls)
  OR EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='monaco_ledger_runner')
  OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename='monaco_ledger_runner') THEN
  RAISE EXCEPTION 'Inactive restricted existing runner required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.monaco_runner_binding WHERE singleton
  AND ledger_key='monaco-first-six-aggregate' AND runner_source_sha='9e82c6d25dcb7f589e2328b2efc7910033d8fcdc'
  AND binding_evidence_sha256='e4d5484e473dd4ac0884816e652f549d04127426a07056738d744a92fa50902e') THEN
  RAISE EXCEPTION 'Original admitted binding required'; END IF;
END $install$;

CREATE TABLE private.monaco_scanner_eval_v2_scopes (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 scope_id text NOT NULL UNIQUE CHECK(scope_id='pocket-scanner-evaluation-v2-20261024'),
 ledger_key text NOT NULL REFERENCES private.pocket_benchmark_pilot_ledgers(ledger_key)
  CHECK(ledger_key='monaco-first-six-aggregate'),
 approval_ref text NOT NULL CHECK(approval_ref ~ '^https://github[.]com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-[1-9][0-9]{8,19}$'
  AND approval_ref NOT IN ('https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6165012632','https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6309459418','https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6383327587','https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6383999765')),
 approval_evidence_sha256 text NOT NULL CHECK(approval_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 approval_document jsonb NOT NULL CHECK(jsonb_typeof(approval_document)='object'),
 app_source_sha text NOT NULL CHECK(app_source_sha ~ '^[a-f0-9]{40}$'),
 runtime_source_sha text NOT NULL CHECK(runtime_source_sha ~ '^[a-f0-9]{40}$'),
 plan_sha256 text NOT NULL CHECK(plan_sha256 ~ '^[a-f0-9]{64}$'),
 original_history_sha256 text NOT NULL CHECK(original_history_sha256 ~ '^[a-f0-9]{64}$'),
 original_pins_sha256 text NOT NULL CHECK(original_pins_sha256='90c4291252904ab977314d5c8010615bea2571c7efc5cddc0ae16df9f7d31165'),
 original_held_microusd bigint NOT NULL CHECK(original_held_microusd=1506400),
 maximum_additional_microusd bigint NOT NULL CHECK(maximum_additional_microusd=1980000),
 approved_at timestamptz NOT NULL,
 valid_until timestamptz NOT NULL CHECK(valid_until>approved_at AND valid_until<=approved_at+INTERVAL '7 days'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.monaco_scanner_eval_v2_scopes ADD CONSTRAINT exact_owner_extension CHECK ((
 app_source_sha='2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc'
 AND approval_document=jsonb_build_object('kind','POCKET_SCANNER_EVALUATION_V2_EXTENSION_APPROVAL','status','APPROVED','approvedBy','OWNER',
  'approvalRef',approval_ref,'scopeId',scope_id,'originalAllowanceRef','comment-6165012632','appSourceSha',app_source_sha,
  'runtimeSourceSha',runtime_source_sha,'planSha256',plan_sha256,'allowedCaseIds',jsonb_build_array('v2-d001','v2-d002','v2-d003','v2-d004','v2-d005','v2-d006'),
  'maximumAdditionalCases',6,'maximumAdditionalSends',18,'maximumAdditionalMicroUsd',1980000,'aggregateCapMicroUsd',5000000,
  'originalHeldMicroUsd',1506400,'retries',0,'approvedAt',approval_document->>'approvedAt','validUntil',approval_document->>'validUntil',
  'approvalBodySha256',approval_evidence_sha256)
 AND (approval_document->>'approvedAt')::timestamptz=approved_at
 AND (approval_document->>'validUntil')::timestamptz=valid_until
) IS TRUE);
CREATE TABLE private.monaco_scanner_eval_v2_pins (
 scope_id text NOT NULL REFERENCES private.monaco_scanner_eval_v2_scopes(scope_id),
 case_id text NOT NULL CHECK(case_id ~ '^v2-d00[1-6]$'),
 source_case_id text NOT NULL CHECK(source_case_id=substring(case_id FROM 4)),
 slot text NOT NULL CHECK(slot IN ('main','primary_precision','rescue_precision')),
 request_id text NOT NULL UNIQUE CHECK(request_id ~ '^v2-d00[1-6]-(main|primary_precision|rescue_precision)-[a-f0-9]{16}$'),
 fingerprint text NOT NULL UNIQUE CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 request_sha256 text NOT NULL CHECK(request_sha256 ~ '^[a-f0-9]{64}$'),
 max_output_tokens integer NOT NULL CHECK(max_output_tokens=CASE WHEN slot='main' THEN 7000 ELSE 4000 END),
 bound_microusd bigint NOT NULL CHECK(bound_microusd=CASE WHEN slot='main' THEN 114000 ELSE 108000 END),
 PRIMARY KEY(scope_id,case_id,slot)
);
CREATE TABLE private.monaco_scanner_eval_v2_permits (
 scope_id text NOT NULL REFERENCES private.monaco_scanner_eval_v2_scopes(scope_id),
 case_id text NOT NULL UNIQUE CHECK(case_id ~ '^v2-d00[1-6]$'),
 attempt_id text NOT NULL UNIQUE CHECK(attempt_id=case_id||'-attempt-1'),
 identity jsonb NOT NULL UNIQUE CHECK(jsonb_typeof(identity)='object'),
 admission_evidence_sha256 text NOT NULL CHECK(admission_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 reassessment_evidence_sha256 text NOT NULL CHECK(reassessment_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 previous_case_receipt_sha256 text CHECK(previous_case_receipt_sha256 ~ '^[a-f0-9]{64}$'),
 admitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 valid_until timestamptz NOT NULL CHECK(valid_until>admitted_at AND valid_until<=admitted_at+INTERVAL '60 minutes'),
 PRIMARY KEY(scope_id,case_id)
);
CREATE TABLE private.monaco_scanner_eval_v2_claims (
 scope_id text NOT NULL, case_id text NOT NULL,
 attempt_id text NOT NULL UNIQUE,
 reserved_microusd bigint NOT NULL DEFAULT 330000 CHECK(reserved_microusd=330000),
 claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(scope_id,case_id),
 FOREIGN KEY(scope_id,case_id) REFERENCES private.monaco_scanner_eval_v2_permits(scope_id,case_id)
);
CREATE TABLE private.monaco_scanner_eval_v2_submissions (
 scope_id text NOT NULL, case_id text NOT NULL, slot text NOT NULL,
 request_id text NOT NULL UNIQUE,
 fingerprint text NOT NULL,
 request_sha256 text NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(scope_id,case_id,slot),
 FOREIGN KEY(scope_id,case_id) REFERENCES private.monaco_scanner_eval_v2_claims(scope_id,case_id),
 FOREIGN KEY(scope_id,case_id,slot) REFERENCES private.monaco_scanner_eval_v2_pins(scope_id,case_id,slot)
);
CREATE TABLE private.monaco_scanner_eval_v2_receipts (
 scope_id text NOT NULL, case_id text NOT NULL, slot text NOT NULL,
 request_id text NOT NULL UNIQUE,
 provider_request_id text NOT NULL UNIQUE CHECK(provider_request_id ~ '^[a-zA-Z0-9_-]{1,200}$'),
 response_id text NOT NULL UNIQUE CHECK(response_id ~ '^[a-zA-Z0-9_-]{1,200}$'),
 model text NOT NULL CHECK(model='gpt-5-mini-2025-08-07'),
 service_tier text NOT NULL CHECK(service_tier='default'),
 usage jsonb NOT NULL CHECK(jsonb_typeof(usage)='object'
  AND usage-ARRAY['input_tokens','output_tokens','total_tokens']='{}'::jsonb),
 -- Exact raw provider-response JSON bytes; encrypted artifact/wrapper digests
 -- are separately retained by the runtime and are not interchangeable here.
 response_sha256 text NOT NULL CHECK(response_sha256 ~ '^[a-f0-9]{64}$'),
 receipted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(scope_id,case_id,slot),
 FOREIGN KEY(scope_id,case_id,slot) REFERENCES private.monaco_scanner_eval_v2_submissions(scope_id,case_id,slot)
);
CREATE TABLE private.monaco_scanner_eval_v2_accounts (
 scope_id text NOT NULL, case_id text NOT NULL,
 receipt_sha256 text NOT NULL CHECK(receipt_sha256 ~ '^[a-f0-9]{64}$'),
 diagnostic_sha256 text NOT NULL CHECK(diagnostic_sha256 ~ '^[a-f0-9]{64}$'),
 diagnostic_artifact_id text NOT NULL UNIQUE CHECK(diagnostic_artifact_id ~ '^[1-9][0-9]{0,19}$'),
 unused_rescue_voided boolean NOT NULL,
 reserved_microusd bigint NOT NULL DEFAULT 330000 CHECK(reserved_microusd=330000),
 accounted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(scope_id,case_id),
 FOREIGN KEY(scope_id,case_id) REFERENCES private.monaco_scanner_eval_v2_claims(scope_id,case_id)
);
CREATE TABLE private.monaco_scanner_eval_v2_stops (
 scope_id text NOT NULL, case_id text NOT NULL,
 reason text NOT NULL CHECK(reason IN ('CANCELLED','TRANSPORT_OUTCOME_UNKNOWN','SUBMIT_ACK_UNKNOWN',
  'RECEIPT_ACK_UNKNOWN','DIAGNOSTIC_RETENTION_FAILED','ACCOUNTING_ACK_UNKNOWN','RUNTIME_ERROR')),
 stopped_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(scope_id,case_id),
 FOREIGN KEY(scope_id,case_id) REFERENCES private.monaco_scanner_eval_v2_claims(scope_id,case_id)
);
CREATE TABLE private.monaco_scanner_eval_v2_revocations (
 scope_id text NOT NULL REFERENCES private.monaco_scanner_eval_v2_scopes(scope_id),
 target text NOT NULL CHECK(target='scope' OR target ~ '^v2-d00[1-6]-attempt-1$'),
 evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 revoked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(scope_id,target)
);
DO $protect$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['scopes','pins','permits','claims','submissions','receipts','accounts','stops','revocations'] LOOP
  EXECUTE format('ALTER TABLE private.%I ENABLE ROW LEVEL SECURITY','monaco_scanner_eval_v2_'||t);
  EXECUTE format('REVOKE ALL ON private.%I FROM public,monaco_ledger_runner','monaco_scanner_eval_v2_'||t);
  EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON private.%I FOR EACH ROW EXECUTE FUNCTION private.block_pocket_benchmark_budget_change()','monaco_scanner_eval_v2_'||t);
  EXECUTE format('CREATE TRIGGER no_reset BEFORE TRUNCATE ON private.%I FOR EACH STATEMENT EXECUTE FUNCTION private.block_pocket_benchmark_budget_change()','monaco_scanner_eval_v2_'||t);
 END LOOP;
END $protect$;

-- Stable database-native encoding of every original evidence/account row.
CREATE FUNCTION private.monaco_scanner_eval_v2_original_digest() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,private SET timezone='UTC' AS $$
DECLARE names text[]:=ARRAY['monaco_neon_identity','monaco_runner_binding','monaco_prior_budget','monaco_request_pins',
 'pocket_benchmark_pilot_ledgers','pocket_benchmark_pilot_cases','pocket_benchmark_pilot_calls',
 'pocket_benchmark_budget_accounts','pocket_benchmark_budget_configs','pocket_benchmark_pilot_cost_attestations'];
 t text; rows jsonb; document jsonb:='{}';
BEGIN
 FOREACH t IN ARRAY names LOOP
  EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM private.%I t',t) INTO rows;
  document:=document||jsonb_build_object(t,rows);
 END LOOP;
 IF to_regclass('private.monaco_first_six_continuation') IS NOT NULL THEN
  EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),''[]''::jsonb) FROM private.monaco_first_six_continuation t' INTO rows;
  document:=document||jsonb_build_object('monaco_first_six_continuation',rows);
 END IF;
 RETURN encode(extensions.digest(convert_to(document::text,'UTF8'),'sha256'),'hex');
END $$;
CREATE FUNCTION private.monaco_scanner_eval_v2_assert_original(p_digest text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE l private.pocket_benchmark_pilot_ledgers%rowtype; original bigint; pins text;
BEGIN
 SELECT * INTO STRICT l FROM private.pocket_benchmark_pilot_ledgers
  WHERE ledger_key='monaco-first-six-aggregate' FOR UPDATE;
 IF l.cap_microusd<>5000000 OR l.owner_approval_ref<>'comment-6165012632'
  OR l.candidate_sha<>'f5e820b0bd7bf095153e31d692a10fb3640ba16e'
  OR l.allowed_case_ids IS DISTINCT FROM ARRAY['d001','d002','d003','d004','d005','d006']::text[] THEN
  RAISE EXCEPTION 'Original aggregate approval changed'; END IF;
 SELECT encode(extensions.digest(convert_to(string_agg(case_id||':'||slot||':'||fingerprint,E'\n' ORDER BY case_id,slot),'UTF8'),'sha256'),'hex')
  INTO pins FROM private.monaco_request_pins;
 SELECT coalesce(sum(greatest(estimated_microusd,coalesce(actual_microusd,estimated_microusd))),0) INTO original
  FROM private.pocket_benchmark_pilot_calls WHERE ledger_key=l.ledger_key AND status IN ('reserved','submitted','settled');
 IF (SELECT count(*) FROM private.pocket_benchmark_pilot_ledgers)<>1
  OR (SELECT count(*) FROM private.pocket_benchmark_pilot_cases)<>6
  OR (SELECT count(*) FROM private.pocket_benchmark_pilot_calls)<>18
  OR (SELECT count(*) FROM private.monaco_request_pins)<>18
  OR pins IS DISTINCT FROM '90c4291252904ab977314d5c8010615bea2571c7efc5cddc0ae16df9f7d31165'
  OR (SELECT count(*) FROM private.pocket_benchmark_pilot_calls WHERE status='submitted' AND receipt_recorded_at IS NOT NULL
   AND provider_request_id IS NOT NULL AND provider_response_id IS NOT NULL AND provider_model=model AND provider_service_tier=service_tier AND provider_usage IS NOT NULL)<>14
  OR (SELECT count(*) FROM private.pocket_benchmark_pilot_calls WHERE status='voided' AND slot='rescue_precision'
   AND case_id IN ('d001','d002','d003','d006') AND submitted_at IS NULL AND receipt_recorded_at IS NULL)<>4
  OR (SELECT count(*) FROM private.pocket_benchmark_budget_accounts)<>6
  OR EXISTS(SELECT 1 FROM private.pocket_benchmark_budget_accounts a WHERE a.receipt_sha256 IS DISTINCT FROM private.pocket_benchmark_receipt_digest(a.ledger_key,a.case_id))
  OR (SELECT coalesce(sum(reserved_microusd),0) FROM private.pocket_benchmark_budget_accounts)<>1506400
  OR EXISTS(SELECT 1 FROM private.pocket_benchmark_pilot_cost_attestations)
  OR (SELECT spent_microusd+reserved_microusd+unresolved_microusd FROM private.monaco_prior_budget WHERE singleton) IS DISTINCT FROM 0
  OR original<>1506400
  OR private.monaco_scanner_eval_v2_original_digest() IS DISTINCT FROM p_digest THEN
  RAISE EXCEPTION 'Original six-case evidence/accounting changed; preserve and reassess'; END IF;
 RETURN original;
END $$;

-- Added guard, not a replacement of any original function. The same original
-- allowance row serializes original accounting changes and v2 reservations.
CREATE FUNCTION private.monaco_scanner_eval_v2_shared_cap_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE cap bigint; original bigint; extra bigint; previous bigint:=0; proposed bigint:=0;
BEGIN
 SELECT cap_microusd INTO STRICT cap FROM private.pocket_benchmark_pilot_ledgers WHERE ledger_key=NEW.ledger_key FOR UPDATE;
 SELECT coalesce(sum(reserved_microusd),0) INTO extra FROM private.monaco_scanner_eval_v2_claims;
 IF extra=0 THEN RETURN NEW; END IF;
 SELECT coalesce(sum(greatest(estimated_microusd,coalesce(actual_microusd,estimated_microusd))),0) INTO original
  FROM private.pocket_benchmark_pilot_calls WHERE ledger_key=NEW.ledger_key AND status IN ('reserved','submitted','settled');
 IF TG_OP='UPDATE' AND OLD.status IN ('reserved','submitted','settled') THEN previous:=greatest(OLD.estimated_microusd,coalesce(OLD.actual_microusd,OLD.estimated_microusd)); END IF;
 IF NEW.status IN ('reserved','submitted','settled') THEN proposed:=greatest(NEW.estimated_microusd,coalesce(NEW.actual_microusd,NEW.estimated_microusd)); END IF;
 IF original-previous+proposed+extra>cap THEN RAISE EXCEPTION 'Original plus evaluation commitments exceed the one aggregate cap'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER monaco_scanner_eval_v2_shared_cap BEFORE INSERT OR UPDATE ON private.pocket_benchmark_pilot_calls
 FOR EACH ROW EXECUTE FUNCTION private.monaco_scanner_eval_v2_shared_cap_guard();

CREATE FUNCTION private.monaco_scanner_eval_v2_receipt_digest(p_scope text,p_case text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,private SET timezone='UTC' AS $$
 SELECT encode(extensions.digest(convert_to(coalesce(jsonb_agg(to_jsonb(r) ORDER BY slot),'[]'::jsonb)::text,'UTF8'),'sha256'),'hex')
 FROM private.monaco_scanner_eval_v2_receipts r WHERE scope_id=p_scope AND case_id=p_case
$$;

CREATE FUNCTION public.monaco_scanner_evaluation_v2_rpc(p_neon jsonb,p_identity jsonb,p_operation text,p_args jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private AS $$
DECLARE n private.monaco_neon_identity%rowtype; b private.monaco_runner_binding%rowtype;
 s private.monaco_scanner_eval_v2_scopes%rowtype; p private.monaco_scanner_eval_v2_permits%rowtype;
 pin private.monaco_scanner_eval_v2_pins%rowtype; receipt private.monaco_scanner_eval_v2_receipts%rowtype;
 e jsonb; old bigint; held bigint; state text; denied text; result jsonb; ordinal integer; slot_name text; max_tokens integer;
BEGIN
 SELECT * INTO STRICT n FROM private.monaco_neon_identity WHERE singleton;
 SELECT * INTO STRICT b FROM private.monaco_runner_binding WHERE singleton;
 IF session_user<>n.runner_role OR current_database()<>n.database_name OR n.verified_at>clock_timestamp()
  OR p_neon IS DISTINCT FROM jsonb_build_object('organizationId',n.organization_id,'projectId',n.project_id,
   'branchId',n.branch_id,'endpointHost',n.endpoint_host,'databaseName',n.database_name,'roleName',n.runner_role,
   'controlPlaneEvidenceSha256',n.control_plane_evidence_sha256)
  OR jsonb_typeof(p_identity) IS DISTINCT FROM 'object' OR jsonb_typeof(p_args) IS DISTINCT FROM 'object'
  OR p_identity-ARRAY['environment','sourceSha','backendRef','projectRef','keyTrackingId','keyFingerprintSha256','planSha256','evaluation']<>'{}'::jsonb
  OR (SELECT count(*) FROM jsonb_object_keys(p_identity))<>8 THEN
  RAISE EXCEPTION 'Exact evaluation endpoint and identity required'; END IF;
 e:=p_identity->'evaluation';
 IF jsonb_typeof(e) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(e))<>11
  OR e-ARRAY['scopeId','attemptId','caseId','sourceCaseId','appSourceSha','evidenceSha','wrapperSha','runId','jobId','runAttempt','approvalRef']<>'{}'::jsonb THEN
  RAISE EXCEPTION 'Exact evaluation attempt fields required'; END IF;
 SELECT * INTO STRICT s FROM private.monaco_scanner_eval_v2_scopes WHERE scope_id=e->>'scopeId';
 old:=private.monaco_scanner_eval_v2_assert_original(s.original_history_sha256);
 SELECT * INTO STRICT p FROM private.monaco_scanner_eval_v2_permits WHERE scope_id=s.scope_id AND case_id=e->>'caseId';
 IF p_identity IS DISTINCT FROM p.identity
  OR row(p_identity->>'sourceSha',p_identity->>'backendRef',p_identity->>'projectRef',p_identity->>'keyTrackingId',p_identity->>'keyFingerprintSha256',p_identity->>'planSha256')
   IS DISTINCT FROM row(s.runtime_source_sha,b.backend_ref,b.project_ref,b.existing_key_tracking_id,b.key_fingerprint_sha256,s.plan_sha256)
  OR e->>'appSourceSha' IS DISTINCT FROM s.app_source_sha OR e->>'approvalRef' IS DISTINCT FROM s.approval_ref
  OR e->>'attemptId' IS DISTINCT FROM p.attempt_id OR e->>'sourceCaseId' IS DISTINCT FROM substring(p.case_id FROM 4)
  OR p_identity->>'environment' IS DISTINCT FROM 'monaco-first-six-inference'
  OR e->>'runAttempt' IS DISTINCT FROM '1'
  OR (SELECT count(*) FROM private.monaco_scanner_eval_v2_pins WHERE scope_id=s.scope_id)<>18 THEN
  RAISE EXCEPTION 'Evaluation identity is not the independently admitted attempt'; END IF;
 SELECT coalesce(sum(reserved_microusd),0) INTO held FROM private.monaco_scanner_eval_v2_claims;
 IF held>s.maximum_additional_microusd OR old+held>5000000 THEN RAISE EXCEPTION 'One aggregate allowance exhausted'; END IF;
 state:=CASE WHEN EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_accounts WHERE scope_id=s.scope_id AND case_id=p.case_id) THEN 'completed'
  WHEN EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_stops WHERE scope_id=s.scope_id AND case_id=p.case_id) THEN 'stopped'
  WHEN EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_claims WHERE scope_id=s.scope_id AND case_id=p.case_id) THEN 'running' ELSE NULL END;
 ordinal:=right(p.case_id,1)::integer;
 denied:=CASE WHEN EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_revocations WHERE scope_id=s.scope_id AND target IN ('scope',p.attempt_id)) THEN 'revoked'
  WHEN s.approved_at>clock_timestamp() OR s.valid_until<=clock_timestamp() OR p.admitted_at>clock_timestamp() OR p.valid_until<=clock_timestamp() THEN 'expired'
  WHEN ordinal>1 AND NOT EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_accounts a
   WHERE a.scope_id=s.scope_id AND a.case_id='v2-d00'||(ordinal-1)::text
    AND a.receipt_sha256 IS NOT DISTINCT FROM p.previous_case_receipt_sha256
    AND a.receipt_sha256=private.monaco_scanner_eval_v2_receipt_digest(a.scope_id,a.case_id)
    AND p.admitted_at>=a.accounted_at) THEN 'previous_case_unresolved'
  WHEN (SELECT count(*) FROM private.monaco_scanner_eval_v2_accounts WHERE scope_id=s.scope_id AND case_id<p.case_id)<>ordinal-1
   OR EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_claims c LEFT JOIN private.monaco_scanner_eval_v2_accounts a USING(scope_id,case_id) WHERE c.scope_id=s.scope_id AND c.case_id<>p.case_id AND a.case_id IS NULL) THEN 'previous_case_unresolved'
  ELSE NULL END;
 result:=jsonb_build_object('scopeId',s.scope_id,'caseId',p.case_id,'attemptId',p.attempt_id,'caseStatus',state,
  'originalCommitmentsMicroUsd',old,'evaluationCommitmentsMicroUsd',held,'aggregateCommittedMicroUsd',old+held,
  'remainingMicroUsd',5000000-old-held,'financiallySettled',false,'actualMicroUsd',NULL);
 IF p_operation='inspect' THEN
  IF p_args<>'{}'::jsonb THEN RAISE EXCEPTION 'Inspect has no arguments'; END IF;
  RETURN result||jsonb_build_object('allowed',denied IS NULL AND state IS NULL,'reason',coalesce(denied,CASE WHEN state IS NOT NULL THEN 'already_started' END),
   'slots',(SELECT coalesce(jsonb_agg(jsonb_build_object('slot',x.slot,'requestId',x.request_id,'fingerprint',x.fingerprint,'requestSha256',x.request_sha256,
    'status',CASE WHEN r.slot IS NOT NULL THEN 'receipted' WHEN d.slot IS NOT NULL THEN 'submitted' WHEN state='completed' AND x.slot='rescue_precision' THEN 'voided' ELSE 'reserved' END) ORDER BY x.slot),'[]'::jsonb)
    FROM private.monaco_scanner_eval_v2_pins x LEFT JOIN private.monaco_scanner_eval_v2_submissions d USING(scope_id,case_id,slot)
    LEFT JOIN private.monaco_scanner_eval_v2_receipts r USING(scope_id,case_id,slot) WHERE x.scope_id=s.scope_id AND x.case_id=p.case_id));
 ELSIF p_operation='begin_case' THEN
  IF p_args<>'{}'::jsonb THEN RAISE EXCEPTION 'Begin has no caller-selected case or allowance'; END IF;
  IF denied IS NOT NULL OR state IS NOT NULL THEN RETURN result||jsonb_build_object('allowed',false,'reason',coalesce(denied,'already_started')); END IF;
  IF held+330000>s.maximum_additional_microusd OR old+held+330000>5000000 THEN RAISE EXCEPTION 'Aggregate reservation denied'; END IF;
  INSERT INTO private.monaco_scanner_eval_v2_claims(scope_id,case_id,attempt_id) VALUES(s.scope_id,p.case_id,p.attempt_id);
  RETURN result||jsonb_build_object('allowed',true,'status','reserved','idempotent',false,'reservedMicroUsd',330000,
   'evaluationCommitmentsMicroUsd',held+330000,'aggregateCommittedMicroUsd',old+held+330000,'remainingMicroUsd',5000000-old-held-330000);
 ELSIF p_operation='submit_slot' THEN
  IF denied IS NOT NULL OR state IS DISTINCT FROM 'running' THEN RAISE EXCEPTION 'Current unrevoked running attempt required'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_args))<>4 OR p_args-ARRAY['slot','requestId','fingerprint','requestSha256']<>'{}'::jsonb THEN RAISE EXCEPTION 'Exact submission fields required'; END IF;
  SELECT * INTO STRICT pin FROM private.monaco_scanner_eval_v2_pins WHERE scope_id=s.scope_id AND case_id=p.case_id AND slot=p_args->>'slot';
  IF row(p_args->>'requestId',p_args->>'fingerprint',p_args->>'requestSha256') IS DISTINCT FROM row(pin.request_id,pin.fingerprint,pin.request_sha256) THEN RAISE EXCEPTION 'Pinned evaluation request required'; END IF;
  IF EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_submissions WHERE scope_id=s.scope_id AND case_id=p.case_id AND slot=pin.slot) THEN
   RETURN result||jsonb_build_object('ok',false,'claimed',false,'reason','already_submitted'); END IF;
  IF pin.slot='primary_precision' AND NOT EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_receipts WHERE scope_id=s.scope_id AND case_id=p.case_id AND slot='main')
   OR pin.slot='rescue_precision' AND (SELECT count(*) FROM private.monaco_scanner_eval_v2_receipts WHERE scope_id=s.scope_id AND case_id=p.case_id AND slot IN ('main','primary_precision'))<>2 THEN
   RAISE EXCEPTION 'Earlier mandatory receipt required'; END IF;
  INSERT INTO private.monaco_scanner_eval_v2_submissions(scope_id,case_id,slot,request_id,fingerprint,request_sha256)
   VALUES(s.scope_id,p.case_id,pin.slot,pin.request_id,pin.fingerprint,pin.request_sha256);
  RETURN result||jsonb_build_object('ok',true,'status','submitted','claimed',true);
 ELSIF p_operation='receipt_slot' THEN
  IF (SELECT count(*) FROM jsonb_object_keys(p_args))<>8 OR p_args-ARRAY['slot','requestId','providerRequestId','responseId','model','serviceTier','usage','responseSha256']<>'{}'::jsonb
   OR jsonb_typeof(p_args->'usage') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Exact receipt fields required'; END IF;
  slot_name:=p_args->>'slot';
  SELECT * INTO STRICT pin FROM private.monaco_scanner_eval_v2_pins WHERE scope_id=s.scope_id AND case_id=p.case_id AND slot=slot_name;
  IF p_args->>'requestId' IS DISTINCT FROM pin.request_id OR p_args->>'model' IS DISTINCT FROM 'gpt-5-mini-2025-08-07'
   OR p_args->>'serviceTier' IS DISTINCT FROM 'default' OR NOT EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_submissions WHERE scope_id=s.scope_id AND case_id=p.case_id AND slot=slot_name)
   OR (SELECT count(*) FROM jsonb_object_keys(p_args->'usage'))<>3
   OR (p_args->'usage')-ARRAY['input_tokens','output_tokens','total_tokens']<>'{}'::jsonb
   OR jsonb_typeof(p_args->'usage'->'input_tokens') IS DISTINCT FROM 'number'
   OR jsonb_typeof(p_args->'usage'->'output_tokens') IS DISTINCT FROM 'number'
   OR jsonb_typeof(p_args->'usage'->'total_tokens') IS DISTINCT FROM 'number'
   OR coalesce(p_args->'usage'->>'input_tokens','') !~ '^(0|[1-9][0-9]{0,6})$'
   OR coalesce(p_args->'usage'->>'output_tokens','') !~ '^(0|[1-9][0-9]{0,6})$'
   OR coalesce(p_args->'usage'->>'total_tokens','') !~ '^(0|[1-9][0-9]{0,6})$' THEN RAISE EXCEPTION 'Submitted exact bounded provider receipt required'; END IF;
  IF (p_args->'usage'->>'input_tokens')::bigint>400000 OR (p_args->'usage'->>'output_tokens')::bigint>pin.max_output_tokens
   OR (p_args->'usage'->>'total_tokens')::bigint<>(p_args->'usage'->>'input_tokens')::bigint+(p_args->'usage'->>'output_tokens')::bigint THEN RAISE EXCEPTION 'Provider token usage outside reservation'; END IF;
  SELECT * INTO receipt FROM private.monaco_scanner_eval_v2_receipts WHERE scope_id=s.scope_id AND case_id=p.case_id AND slot=slot_name;
  IF FOUND THEN
   IF row(receipt.request_id,receipt.provider_request_id,receipt.response_id,receipt.model,receipt.service_tier,receipt.usage,receipt.response_sha256)
    IS DISTINCT FROM row(p_args->>'requestId',p_args->>'providerRequestId',p_args->>'responseId',p_args->>'model',p_args->>'serviceTier',p_args->'usage',p_args->>'responseSha256') THEN RAISE EXCEPTION 'Receipt conflict'; END IF;
   RETURN result||jsonb_build_object('ok',true,'status','receipted','idempotent',true);
  END IF;
  IF EXISTS(SELECT 1 FROM private.pocket_benchmark_pilot_calls WHERE provider_request_id=p_args->>'providerRequestId' OR provider_response_id=p_args->>'responseId') THEN RAISE EXCEPTION 'Original provider identity cannot be reused'; END IF;
  INSERT INTO private.monaco_scanner_eval_v2_receipts(scope_id,case_id,slot,request_id,provider_request_id,response_id,model,service_tier,usage,response_sha256)
   VALUES(s.scope_id,p.case_id,slot_name,p_args->>'requestId',p_args->>'providerRequestId',p_args->>'responseId',p_args->>'model',p_args->>'serviceTier',p_args->'usage',p_args->>'responseSha256');
  RETURN result||jsonb_build_object('ok',true,'status','receipted','idempotent',false);
 ELSIF p_operation='finish_case' THEN
  IF (SELECT count(*) FROM jsonb_object_keys(p_args))<>2 OR p_args-ARRAY['diagnosticSha256','diagnosticArtifactId']<>'{}'::jsonb THEN RAISE EXCEPTION 'Retained diagnostic reference required'; END IF;
  IF state='completed' THEN
   IF NOT EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_accounts WHERE scope_id=s.scope_id AND case_id=p.case_id
    AND diagnostic_sha256=p_args->>'diagnosticSha256' AND diagnostic_artifact_id=p_args->>'diagnosticArtifactId') THEN RAISE EXCEPTION 'Accounting conflict'; END IF;
   RETURN result||jsonb_build_object('ok',true,'status','completed','accountingStatus','FULL_RESERVATION_HELD','reservedMicroUsd',330000,'idempotent',true);
  END IF;
  IF state IS DISTINCT FROM 'running' OR (SELECT count(*) FROM private.monaco_scanner_eval_v2_receipts WHERE scope_id=s.scope_id AND case_id=p.case_id AND slot IN ('main','primary_precision'))<>2
   OR EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_submissions d LEFT JOIN private.monaco_scanner_eval_v2_receipts r USING(scope_id,case_id,slot) WHERE d.scope_id=s.scope_id AND d.case_id=p.case_id AND r.slot IS NULL) THEN
   RAISE EXCEPTION 'Complete mandatory receipts and no unknown submission required'; END IF;
  INSERT INTO private.monaco_scanner_eval_v2_accounts(scope_id,case_id,receipt_sha256,diagnostic_sha256,diagnostic_artifact_id,unused_rescue_voided)
   VALUES(s.scope_id,p.case_id,private.monaco_scanner_eval_v2_receipt_digest(s.scope_id,p.case_id),p_args->>'diagnosticSha256',p_args->>'diagnosticArtifactId',
   NOT EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_submissions WHERE scope_id=s.scope_id AND case_id=p.case_id AND slot='rescue_precision'));
  RETURN result||jsonb_build_object('ok',true,'status','completed','accountingStatus','FULL_RESERVATION_HELD','reservedMicroUsd',330000,'idempotent',false);
 ELSIF p_operation='stop_case' THEN
  IF (SELECT count(*) FROM jsonb_object_keys(p_args))<>1 OR p_args-ARRAY['reason']<>'{}'::jsonb OR state IS NULL THEN RAISE EXCEPTION 'Claimed exact attempt required'; END IF;
  IF state='completed' THEN RETURN result||jsonb_build_object('ok',true,'status','completed','accountingStatus','FULL_RESERVATION_HELD'); END IF;
  INSERT INTO private.monaco_scanner_eval_v2_stops(scope_id,case_id,reason) VALUES(s.scope_id,p.case_id,p_args->>'reason') ON CONFLICT DO NOTHING;
  RETURN result||jsonb_build_object('ok',true,'status','stopped','accountingStatus','FULL_RESERVATION_HELD','reservedMicroUsd',330000);
 ELSE RAISE EXCEPTION 'Operation outside evaluation v2 allowlist';
 END IF;
END $$;
REVOKE ALL ON FUNCTION private.monaco_scanner_eval_v2_original_digest(),private.monaco_scanner_eval_v2_assert_original(text),
 private.monaco_scanner_eval_v2_shared_cap_guard(),private.monaco_scanner_eval_v2_receipt_digest(text,text),
 public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb) FROM public,monaco_ledger_runner;
GRANT EXECUTE ON FUNCTION public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb) TO monaco_ledger_runner;
COMMIT;
