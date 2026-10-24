-- NEW PROTOCOL AMENDMENT; requires independent owner review before execution.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; SET LOCAL timezone='UTC';
SELECT set_config('monaco.unused_lease_amendment','{"kind":"POCKET_SCANNER_EVALUATION_V2_UNUSED_PERMIT_RECOVERY_AMENDMENT","approvedBy":"OWNER","approvalRef":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6387959150","approvalBodySha256":"165808d342e28e0e2a21bf603b9c7d6b85e50a959997af2a7eaf694f2381d2e1","approvedAt":"2026-10-24T18:30:58Z","proposalSha256":"b70a4e2371e6832ed7f7b717f0b4b8a0e9665a24ba45c9fe565f1cafe5820602","approvalRequestSha256":"b7acff72ac5374e7a901952dcfe72ad82eba8bb4e3b449d541a40c3f858556d7","ownerResponseSha256":"85a39ab345d672ff8ca9b9c6876f3adcacf45ee7c1e2dbd2408fd338bd55e07e","targetIdentity":{"sourceSha":"20783ed5e8eb95a11df86b0d60766ffcbbf4fa79","backendRef":"neon:bitter-grass-28096464/br-aged-mode-zaa9u7lr/monaco_ledger","evaluation":{"jobId":"120905891814","runId":"40105387615","caseId":"v2-d002","scopeId":"pocket-scanner-evaluation-v2-20261024","attemptId":"v2-d002-attempt-1","runAttempt":"1","wrapperSha":"b7f2927f2c9438b18a9ce042904259a4acd11323","approvalRef":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029","evidenceSha":"778a47fce8405dca6b22f14a3c7b55e858f5e71e","appSourceSha":"2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc","sourceCaseId":"d002"},"planSha256":"cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109","projectRef":"proj_LTmAIE2Ve7gUAFJ9M74ZxIBI","environment":"monaco-first-six-inference","keyTrackingId":"key_aD5pc20EZBLGECNC","keyFingerprintSha256":"107e0cb3265e15aa25e3fa49c91512096f84b43d5fa834761c73c3cce2c99d0e"},"originalPermit":{"case_id":"v2-d002","identity":{"sourceSha":"20783ed5e8eb95a11df86b0d60766ffcbbf4fa79","backendRef":"neon:bitter-grass-28096464/br-aged-mode-zaa9u7lr/monaco_ledger","evaluation":{"jobId":"120905891814","runId":"40105387615","caseId":"v2-d002","scopeId":"pocket-scanner-evaluation-v2-20261024","attemptId":"v2-d002-attempt-1","runAttempt":"1","wrapperSha":"b7f2927f2c9438b18a9ce042904259a4acd11323","approvalRef":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029","evidenceSha":"778a47fce8405dca6b22f14a3c7b55e858f5e71e","appSourceSha":"2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc","sourceCaseId":"d002"},"planSha256":"cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109","projectRef":"proj_LTmAIE2Ve7gUAFJ9M74ZxIBI","environment":"monaco-first-six-inference","keyTrackingId":"key_aD5pc20EZBLGECNC","keyFingerprintSha256":"107e0cb3265e15aa25e3fa49c91512096f84b43d5fa834761c73c3cce2c99d0e"},"scope_id":"pocket-scanner-evaluation-v2-20261024","attempt_id":"v2-d002-attempt-1","admitted_at":"2026-10-24T15:07:25.068435+00:00","valid_until":"2026-10-24T15:50:00+00:00","admission_evidence_sha256":"19f1d10da46e434799b7582ede0e213a0e77f01187eec3740020dd0e002a2773","previous_case_receipt_sha256":"58b6efba5a71217e7a2f06c9c95362f79dfea50da4033e589245378717438447","reassessment_evidence_sha256":"26f4def92e19eda7b9715afc7e4383229314f64b3275758711a896b8fdba816c"},"originalScope":{"scope_id":"pocket-scanner-evaluation-v2-20261024","singleton":true,"created_at":"2026-10-24T12:56:53.928999+00:00","ledger_key":"monaco-first-six-aggregate","approved_at":"2026-10-24T12:40:25+00:00","plan_sha256":"cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109","valid_until":"2026-10-25T12:40:25+00:00","approval_ref":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029","app_source_sha":"2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc","approval_document":{"kind":"POCKET_SCANNER_EVALUATION_V2_EXTENSION_APPROVAL","status":"APPROVED","retries":0,"scopeId":"pocket-scanner-evaluation-v2-20261024","approvedAt":"2026-10-24T12:40:25.000Z","approvedBy":"OWNER","planSha256":"cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109","validUntil":"2026-10-25T12:40:25.000Z","approvalRef":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029","appSourceSha":"2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc","allowedCaseIds":["v2-d001","v2-d002","v2-d003","v2-d004","v2-d005","v2-d006"],"runtimeSourceSha":"20783ed5e8eb95a11df86b0d60766ffcbbf4fa79","approvalBodySha256":"f04851163218136baa0a633f00dd6398424fd32cd56ad6e19011b9b6d77311a2","aggregateCapMicroUsd":5000000,"originalAllowanceRef":"comment-6165012632","originalHeldMicroUsd":1506400,"maximumAdditionalCases":6,"maximumAdditionalSends":18,"maximumAdditionalMicroUsd":1980000},"runtime_source_sha":"20783ed5e8eb95a11df86b0d60766ffcbbf4fa79","original_pins_sha256":"90c4291252904ab977314d5c8010615bea2571c7efc5cddc0ae16df9f7d31165","original_held_microusd":1506400,"original_history_sha256":"4031aa388eecdac651a539a1af5ed861f0edc1944c748917001ba6546e4c2e64","approval_evidence_sha256":"f04851163218136baa0a633f00dd6398424fd32cd56ad6e19011b9b6d77311a2","maximum_additional_microusd":1980000},"previousCaseReceiptSha256":"58b6efba5a71217e7a2f06c9c95362f79dfea50da4033e589245378717438447","maximumLeases":1,"maximumLeaseSeconds":3600,"maximumLoginSeconds":1200,"retries":0,"caseBoundMicroUsd":330000,"aggregateCapMicroUsd":5000000}',true);
SELECT set_config('monaco.unused_lease_proposal_sha256','b70a4e2371e6832ed7f7b717f0b4b8a0e9665a24ba45c9fe565f1cafe5820602',true);
-- OFFLINE PROPOSAL. Not installed or authorized by the original scope approval.
-- The materializer supplies a separately observed new owner amendment in this
-- transaction. No permit/history row, trigger, role, password or grant is reset.
DO $recovery_install$
DECLARE f pg_proc%rowtype; a jsonb; r pg_roles%rowtype;
BEGIN
 IF current_database()<>'monaco_ledger' OR session_user<>'monaco_ledger_owner'
  OR current_user<>'monaco_ledger_owner' THEN RAISE EXCEPTION 'Exact isolated owner required'; END IF;
 a:=nullif(current_setting('monaco.unused_lease_amendment',true),'')::jsonb;
 IF a IS NULL OR a->>'kind' IS DISTINCT FROM 'POCKET_SCANNER_EVALUATION_V2_UNUSED_PERMIT_RECOVERY_AMENDMENT'
  OR a->>'approvedBy' IS DISTINCT FROM 'OWNER'
  OR coalesce(a->>'approvalRef','') !~ '^https://github[.]com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-[1-9][0-9]{8,19}$'
  OR a->>'approvalRef' IN ('https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6165012632',
   'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6309459418',
   'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6383327587',
   'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6383999765',
   'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029')
  OR coalesce(a->>'approvalBodySha256','') !~ '^[a-f0-9]{64}$'
  OR coalesce(a->>'proposalSha256','') !~ '^[a-f0-9]{64}$'
  OR a->>'proposalSha256' IS DISTINCT FROM current_setting('monaco.unused_lease_proposal_sha256',true) THEN
  RAISE EXCEPTION 'New separately recorded owner amendment required; original approval is insufficient'; END IF;
 SELECT * INTO STRICT r FROM pg_roles WHERE rolname='monaco_ledger_runner';
 IF r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolinherit OR r.rolreplication OR r.rolbypassrls
  OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
  OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename=r.rolname) THEN RAISE EXCEPTION 'Inactive restricted runner required'; END IF;
 SELECT * INTO STRICT f FROM pg_proc WHERE oid='public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)'::regprocedure;
 IF encode(extensions.digest(convert_to(f.prosrc,'UTF8'),'sha256'),'hex')<>'00fd1d5ef2f81cc022c31f6160ca7022bef794513bec4ef8efbe66e98a0feb87'
  OR pg_get_userbyid(f.proowner)<>'monaco_ledger_owner' OR NOT f.prosecdef
  OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, private']::text[]
  OR f.proacl::text IS DISTINCT FROM '{monaco_ledger_owner=X/monaco_ledger_owner,monaco_ledger_runner=X/monaco_ledger_owner}'
  OR (SELECT lanname FROM pg_language WHERE oid=f.prolang)<>'plpgsql'
  OR f.prorettype<>'jsonb'::regtype OR f.provolatile<>'v' THEN RAISE EXCEPTION 'Installed original RPC preimage or attributes changed'; END IF;
 IF to_regclass('private.monaco_scanner_eval_v2_unused_leases') IS NOT NULL THEN RAISE EXCEPTION 'Recovery already installed; never reset or renew'; END IF;
END $recovery_install$;

CREATE TABLE private.monaco_scanner_eval_v2_unused_leases (
 scope_id text NOT NULL CHECK(scope_id='pocket-scanner-evaluation-v2-20261024'),
 case_id text NOT NULL CHECK(case_id='v2-d002'),
 attempt_id text NOT NULL UNIQUE CHECK(attempt_id='v2-d002-attempt-1'),
 original_scope jsonb NOT NULL,
 original_permit jsonb NOT NULL,
 prior_evidence jsonb NOT NULL,
 original_history_sha256 text NOT NULL CHECK(original_history_sha256 ~ '^[a-f0-9]{64}$'),
 amendment jsonb NOT NULL,
 owner_comment jsonb NOT NULL,
 owner_decision jsonb NOT NULL,
 proposal_sha256 text NOT NULL CHECK(proposal_sha256 ~ '^[a-f0-9]{64}$'),
 review_evidence_sha256 text NOT NULL CHECK(review_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 pending_evidence_sha256 text NOT NULL CHECK(pending_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 pending_observed_at timestamptz NOT NULL,
 ledger_evidence_sha256 text NOT NULL CHECK(ledger_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 ledger_observed_at timestamptz NOT NULL,
 granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 valid_until timestamptz NOT NULL,
 PRIMARY KEY(scope_id,case_id),
 FOREIGN KEY(scope_id,case_id) REFERENCES private.monaco_scanner_eval_v2_permits(scope_id,case_id),
 CHECK(valid_until>granted_at AND valid_until<=granted_at+INTERVAL '60 minutes')
);
ALTER TABLE private.monaco_scanner_eval_v2_unused_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.monaco_scanner_eval_v2_unused_leases FROM public,monaco_ledger_runner;
CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON private.monaco_scanner_eval_v2_unused_leases
 FOR EACH ROW EXECUTE FUNCTION private.block_pocket_benchmark_budget_change();
CREATE TRIGGER no_reset BEFORE TRUNCATE ON private.monaco_scanner_eval_v2_unused_leases
 FOR EACH STATEMENT EXECUTE FUNCTION private.block_pocket_benchmark_budget_change();

-- Typed row/set equality avoids timestamp-display and JSON-key-order ambiguity.
CREATE FUNCTION private.monaco_scanner_eval_v2_recovery_prior_matches(w jsonb) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,private SET timezone='UTC' AS $$
DECLARE t text; ok boolean;
BEGIN
 IF w IS NULL OR jsonb_typeof(w)<>'object'
  OR w-ARRAY['permit','claim','account','submissions','receipts','pins']<>'{}'::jsonb
  OR (SELECT count(*) FROM jsonb_object_keys(w))<>6 THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_permits p WHERE p.case_id='v2-d001'
   AND p IS NOT DISTINCT FROM jsonb_populate_record(NULL::private.monaco_scanner_eval_v2_permits,w->'permit'))
  OR NOT EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_claims c WHERE c.case_id='v2-d001'
   AND c IS NOT DISTINCT FROM jsonb_populate_record(NULL::private.monaco_scanner_eval_v2_claims,w->'claim'))
  OR NOT EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_accounts a WHERE a.case_id='v2-d001'
   AND a IS NOT DISTINCT FROM jsonb_populate_record(NULL::private.monaco_scanner_eval_v2_accounts,w->'account')
   AND a.receipt_sha256=private.monaco_scanner_eval_v2_receipt_digest(a.scope_id,a.case_id)) THEN RETURN false; END IF;
 FOREACH t IN ARRAY ARRAY['submissions','receipts','pins'] LOOP
  IF jsonb_typeof(w->t) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  EXECUTE format('SELECT NOT EXISTS((SELECT * FROM private.%1$I WHERE %2$s) EXCEPT (SELECT * FROM jsonb_populate_recordset(NULL::private.%1$I,$1))) AND NOT EXISTS((SELECT * FROM jsonb_populate_recordset(NULL::private.%1$I,$1)) EXCEPT (SELECT * FROM private.%1$I WHERE %2$s))',
   'monaco_scanner_eval_v2_'||t,CASE WHEN t='pins' THEN 'true' ELSE 'case_id=''v2-d001''' END) INTO ok USING w->t;
  IF ok IS DISTINCT FROM true THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;

CREATE FUNCTION private.monaco_scanner_eval_v2_validate_unused_lease() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,private SET timezone='UTC' AS $$
DECLARE s private.monaco_scanner_eval_v2_scopes%rowtype; p private.monaco_scanner_eval_v2_permits%rowtype;
 r pg_roles%rowtype; a jsonb; n timestamptz; expected jsonb; approval_body text; approval_request text;
BEGIN
 IF current_database()<>'monaco_ledger' OR session_user<>'monaco_ledger_owner' OR current_user<>'monaco_ledger_owner' THEN
  RAISE EXCEPTION 'Only the exact isolated owner can grant recovery'; END IF;
 -- This lock is the same authoritative aggregate lock held by begin/submit.
 PERFORM private.monaco_scanner_eval_v2_assert_original(NEW.original_history_sha256);
 SELECT * INTO STRICT s FROM private.monaco_scanner_eval_v2_scopes WHERE scope_id=NEW.scope_id;
 SELECT * INTO STRICT p FROM private.monaco_scanner_eval_v2_permits WHERE scope_id=NEW.scope_id AND case_id=NEW.case_id;
 n:=clock_timestamp(); NEW.granted_at:=n; a:=NEW.amendment;
 IF NEW.case_id<>'v2-d002' OR NEW.attempt_id<>'v2-d002-attempt-1'
  OR p IS DISTINCT FROM jsonb_populate_record(NULL::private.monaco_scanner_eval_v2_permits,NEW.original_permit)
  OR s IS DISTINCT FROM jsonb_populate_record(NULL::private.monaco_scanner_eval_v2_scopes,NEW.original_scope)
  OR s.original_history_sha256<>NEW.original_history_sha256
  OR p.identity->>'sourceSha' IS DISTINCT FROM '20783ed5e8eb95a11df86b0d60766ffcbbf4fa79'
  OR p.identity->'evaluation'->>'appSourceSha' IS DISTINCT FROM '2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc'
  OR p.identity->>'planSha256' IS DISTINCT FROM 'cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109'
  OR p.identity->'evaluation'->>'runId' IS DISTINCT FROM '40105387615' OR p.identity->'evaluation'->>'jobId' IS DISTINCT FROM '120905891814'
  OR p.identity->'evaluation'->>'runAttempt' IS DISTINCT FROM '1'
  OR p.identity->'evaluation'->>'wrapperSha' IS DISTINCT FROM 'b7f2927f2c9438b18a9ce042904259a4acd11323'
  OR p.identity->'evaluation'->>'evidenceSha' IS DISTINCT FROM '778a47fce8405dca6b22f14a3c7b55e858f5e71e'
  OR s.approval_ref<>'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029'
  OR s.valid_until>s.approved_at+INTERVAL '24 hours'
  OR p.valid_until>n OR p.admitted_at>n OR s.approved_at>n OR s.valid_until<=n
  OR NEW.valid_until<=n OR NEW.valid_until>n+INTERVAL '60 minutes' OR NEW.valid_until>s.valid_until
  OR (SELECT count(*) FROM private.monaco_scanner_eval_v2_scopes)<>1
  OR (SELECT count(*) FROM private.monaco_scanner_eval_v2_permits)<>2
  OR (SELECT count(*) FROM private.monaco_scanner_eval_v2_pins)<>18 THEN RAISE EXCEPTION 'Exact expired unused permit and unchanged scope required'; END IF;
 IF EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_unused_leases)
  OR (SELECT count(*) FROM private.monaco_scanner_eval_v2_claims)<>1
  OR (SELECT count(*) FROM private.monaco_scanner_eval_v2_accounts)<>1
  OR (SELECT count(*) FROM private.monaco_scanner_eval_v2_submissions)<>3
  OR (SELECT count(*) FROM private.monaco_scanner_eval_v2_receipts)<>3
  OR EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_claims WHERE case_id=p.case_id)
  OR EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_submissions WHERE case_id=p.case_id)
  OR EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_receipts WHERE case_id=p.case_id)
  OR EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_accounts WHERE case_id=p.case_id)
  OR EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_stops)
  OR EXISTS(SELECT 1 FROM private.monaco_scanner_eval_v2_revocations WHERE scope_id=s.scope_id AND target IN ('scope',p.attempt_id))
  OR NOT coalesce(private.monaco_scanner_eval_v2_recovery_prior_matches(NEW.prior_evidence),false)
  OR p.previous_case_receipt_sha256 IS DISTINCT FROM NEW.prior_evidence->'account'->>'receipt_sha256'
  OR (SELECT coalesce(sum(reserved_microusd),0) FROM private.monaco_scanner_eval_v2_claims)<>330000 THEN
  RAISE EXCEPTION 'One immutable prior account and a never claimed/sent/stopped target required; no second lease'; END IF;
 SELECT * INTO STRICT r FROM pg_roles WHERE rolname='monaco_ledger_runner';
 IF r.rolcanlogin OR r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolinherit OR r.rolreplication OR r.rolbypassrls
  OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=r.oid)
  OR EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename=r.rolname)
  OR has_schema_privilege(r.oid,'private','USAGE')
  OR NOT has_function_privilege(r.oid,'public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'Inactive restricted existing runner with zero sessions required'; END IF;
 expected:=jsonb_build_object('kind','POCKET_SCANNER_EVALUATION_V2_UNUSED_PERMIT_RECOVERY_AMENDMENT','approvedBy','OWNER',
  'approvalRef',a->>'approvalRef','approvalBodySha256',a->>'approvalBodySha256','approvedAt',a->>'approvedAt',
  'approvalRequestSha256',a->>'approvalRequestSha256','ownerResponseSha256',a->>'ownerResponseSha256',
  'proposalSha256',NEW.proposal_sha256,'targetIdentity',p.identity,'originalPermit',NEW.original_permit,
  'originalScope',NEW.original_scope,'previousCaseReceiptSha256',p.previous_case_receipt_sha256,
  'maximumLeases',1,'maximumLeaseSeconds',3600,'maximumLoginSeconds',1200,'retries',0,
  'caseBoundMicroUsd',330000,'aggregateCapMicroUsd',5000000);
 approval_request:='Do you approve the reviewed protocol amendment proposal-sha256: '||NEW.proposal_sha256
  ||' for v2-d002 / run 40105387615 / job 120905891814 / attempt 1? This authorizes one non-renewable execution lease of at most 60 minutes, within the existing scope ending 2026-10-25T12:40:25Z, and one login window of at most 20 minutes inside that lease. The expired original permit and prior history remain unchanged. The same runtime, app, credentials, case cost bound and existing total budget remain in force, with no retry or new attempt. Reply Yes to approve this amendment.';
 approval_body:='APPROVED OWNER AMENDMENT: POCKET_SCANNER_UNUSED_PERMIT_RECOVERY_V1'||E'\n'
  ||'decision: APPROVED'||E'\n'||'approval-request-sha256: '||(a->>'approvalRequestSha256')||E'\n'
  ||'owner-response-sha256: '||(a->>'ownerResponseSha256')||E'\n'||'proposal-sha256: '||NEW.proposal_sha256||E'\n'
  ||'target: v2-d002 / run 40105387615 / job 120905891814 / attempt 1'||E'\n'
  ||'One non-renewable lease of at most 60 minutes, inside the unchanged original scope; login at most 20 minutes inside that lease.'||E'\n'
  ||'The expired original permit and all prior history remain unchanged. No retry, new attempt, new keys, added budget, or changed runtime.';
 IF jsonb_typeof(a) IS DISTINCT FROM 'object' OR jsonb_typeof(NEW.owner_comment) IS DISTINCT FROM 'object'
  OR jsonb_typeof(NEW.owner_decision) IS DISTINCT FROM 'object'
  OR NEW.owner_decision-ARRAY['decision','requestText','ownerResponseText','recordedAt']<>'{}'::jsonb
  OR (SELECT count(*) FROM jsonb_object_keys(NEW.owner_decision))<>4
  OR NEW.owner_comment-ARRAY['url','author','body','createdAt']<>'{}'::jsonb
  OR (SELECT count(*) FROM jsonb_object_keys(NEW.owner_comment))<>4
  OR NEW.owner_decision->>'decision' IS DISTINCT FROM 'APPROVED'
  OR NEW.owner_decision->>'requestText' IS DISTINCT FROM approval_request
  OR coalesce(NEW.owner_decision->>'ownerResponseText','') !~* '^[[:space:]]*(yes|yea|yeah)[!.[:space:]]*$'
  OR coalesce(a->>'approvalRequestSha256','') !~ '^[a-f0-9]{64}$'
  OR coalesce(a->>'ownerResponseSha256','') !~ '^[a-f0-9]{64}$'
  OR encode(extensions.digest(convert_to(NEW.owner_decision->>'requestText','UTF8'),'sha256'),'hex') IS DISTINCT FROM a->>'approvalRequestSha256'
  OR encode(extensions.digest(convert_to(NEW.owner_decision->>'ownerResponseText','UTF8'),'sha256'),'hex') IS DISTINCT FROM a->>'ownerResponseSha256'
  OR position(NEW.proposal_sha256 IN coalesce(NEW.owner_decision->>'requestText',''))=0
  OR position('v2-d002 / run 40105387615 / job 120905891814 / attempt 1' IN coalesce(NEW.owner_decision->>'requestText',''))=0
  OR jsonb_typeof(NEW.owner_decision->'recordedAt') IS DISTINCT FROM 'string'
  OR coalesce(NEW.owner_decision->>'recordedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
  OR (NEW.owner_decision->>'recordedAt')::timestamptz>n
  OR (NEW.owner_decision->>'recordedAt')::timestamptz> (a->>'approvedAt')::timestamptz
  OR (NEW.owner_decision->>'recordedAt')::timestamptz<p.valid_until
  OR NEW.owner_comment->>'body' IS DISTINCT FROM approval_body
  OR jsonb_typeof(a->'approvedAt') IS DISTINCT FROM 'string'
  OR jsonb_typeof(NEW.owner_comment->'createdAt') IS DISTINCT FROM 'string'
  OR coalesce(a->>'approvedAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
  OR coalesce(NEW.owner_comment->>'createdAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
  OR a IS DISTINCT FROM expected OR a IS DISTINCT FROM nullif(current_setting('monaco.unused_lease_amendment',true),'')::jsonb
  OR NEW.proposal_sha256 IS DISTINCT FROM current_setting('monaco.unused_lease_proposal_sha256',true)
  OR coalesce(a->>'approvalRef','') !~ '^https://github[.]com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-[1-9][0-9]{8,19}$'
  OR a->>'approvalRef'=s.approval_ref OR a->>'approvalRef' IN ('https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6165012632',
   'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6309459418','https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6383327587',
   'https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6383999765')
  OR coalesce(a->>'approvalBodySha256','') !~ '^[a-f0-9]{64}$'
  OR NEW.owner_comment->>'url' IS DISTINCT FROM a->>'approvalRef'
  OR NEW.owner_comment->>'author' IS DISTINCT FROM 'nashysaimarkets'
  OR (NEW.owner_comment->>'createdAt')::timestamptz IS DISTINCT FROM (a->>'approvedAt')::timestamptz
  OR (a->>'approvedAt')::timestamptz>n OR (a->>'approvedAt')::timestamptz<p.valid_until
  OR encode(extensions.digest(convert_to(NEW.owner_comment->>'body','UTF8'),'sha256'),'hex') IS DISTINCT FROM a->>'approvalBodySha256'
  OR position('proposal-sha256: '||NEW.proposal_sha256 IN coalesce(NEW.owner_comment->>'body',''))=0
  OR position('v2-d002 / run 40105387615 / job 120905891814 / attempt 1' IN coalesce(NEW.owner_comment->>'body',''))=0
  OR NEW.pending_observed_at>n OR NEW.pending_observed_at<n-INTERVAL '15 minutes'
  OR NEW.ledger_observed_at>n OR NEW.ledger_observed_at<n-INTERVAL '15 minutes'
  OR NEW.pending_observed_at<(a->>'approvedAt')::timestamptz OR NEW.ledger_observed_at<(a->>'approvedAt')::timestamptz THEN
  RAISE EXCEPTION 'Exact new owner amendment, source review and fresh pending/ledger evidence required'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_grant BEFORE INSERT ON private.monaco_scanner_eval_v2_unused_leases
 FOR EACH ROW EXECUTE FUNCTION private.monaco_scanner_eval_v2_validate_unused_lease();

-- Never-used eligibility is checked once at grant. The same lease remains usable
-- for this first claim's later slots; all existing RPC revocation/cap/state guards
-- still execute. Missing or mismatched evidence is an explicit FALSE, never NULL.
CREATE FUNCTION private.monaco_scanner_eval_v2_unused_lease_active(p private.monaco_scanner_eval_v2_permits) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,private SET timezone='UTC' AS $$
DECLARE l private.monaco_scanner_eval_v2_unused_leases%rowtype; s private.monaco_scanner_eval_v2_scopes%rowtype;
BEGIN
 SELECT * INTO l FROM private.monaco_scanner_eval_v2_unused_leases WHERE scope_id=p.scope_id AND case_id=p.case_id AND attempt_id=p.attempt_id;
 IF NOT FOUND THEN RETURN false; END IF;
 SELECT * INTO STRICT s FROM private.monaco_scanner_eval_v2_scopes WHERE scope_id=p.scope_id;
 RETURN coalesce(l.granted_at<=clock_timestamp() AND clock_timestamp()<l.valid_until AND l.valid_until<=s.valid_until
  AND p IS NOT DISTINCT FROM jsonb_populate_record(NULL::private.monaco_scanner_eval_v2_permits,l.original_permit)
  AND s IS NOT DISTINCT FROM jsonb_populate_record(NULL::private.monaco_scanner_eval_v2_scopes,l.original_scope)
  AND l.amendment->'targetIdentity'=p.identity
  AND l.amendment->>'proposalSha256'=l.proposal_sha256
  AND l.amendment->'originalPermit'=l.original_permit AND l.amendment->'originalScope'=l.original_scope
  AND l.owner_comment->>'url'=l.amendment->>'approvalRef' AND l.amendment->>'approvalRef'<>s.approval_ref
  AND encode(extensions.digest(convert_to(l.owner_comment->>'body','UTF8'),'sha256'),'hex')=l.amendment->>'approvalBodySha256'
  AND private.monaco_scanner_eval_v2_recovery_prior_matches(l.prior_evidence),false);
END $$;
REVOKE ALL ON FUNCTION private.monaco_scanner_eval_v2_recovery_prior_matches(jsonb),
 private.monaco_scanner_eval_v2_validate_unused_lease(),
 private.monaco_scanner_eval_v2_unused_lease_active(private.monaco_scanner_eval_v2_permits) FROM public,monaco_ledger_runner;

CREATE OR REPLACE FUNCTION public.monaco_scanner_evaluation_v2_rpc(p_neon jsonb,p_identity jsonb,p_operation text,p_args jsonb) RETURNS jsonb
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
  WHEN s.approved_at>clock_timestamp() OR s.valid_until<=clock_timestamp() OR p.admitted_at>clock_timestamp() OR (p.valid_until<=clock_timestamp() AND NOT coalesce(private.monaco_scanner_eval_v2_unused_lease_active(p),false)) THEN 'expired'
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
   -- The runtime compares its static evidence with these independently stored
   -- immutable owner records before any chart transfer or provider operation.
   'admission',jsonb_build_object('approvalRef',s.approval_ref,'approvalBodySha256',s.approval_evidence_sha256,
    'admissionEvidenceSha256',p.admission_evidence_sha256,'reassessmentEvidenceSha256',p.reassessment_evidence_sha256,
    'previousCaseReceiptSha256',p.previous_case_receipt_sha256),
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
DO $post_rpc$
DECLARE f pg_proc%rowtype;
BEGIN
 SELECT * INTO STRICT f FROM pg_proc WHERE oid='public.monaco_scanner_evaluation_v2_rpc(jsonb,jsonb,text,jsonb)'::regprocedure;
 IF encode(extensions.digest(convert_to(f.prosrc,'UTF8'),'sha256'),'hex')<>'f3d5660d04f08facf5409c8484e0d4f13a70e33508975df4a6dadda9add3b4df'
  OR pg_get_userbyid(f.proowner)<>'monaco_ledger_owner' OR NOT f.prosecdef
  OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, private']::text[]
  OR f.proacl::text IS DISTINCT FROM '{monaco_ledger_owner=X/monaco_ledger_owner,monaco_ledger_runner=X/monaco_ledger_owner}'
 THEN RAISE EXCEPTION 'Amended RPC body/attributes differ'; END IF;
END $post_rpc$;

INSERT INTO private.monaco_scanner_eval_v2_unused_leases(scope_id,case_id,attempt_id,original_scope,original_permit,prior_evidence,original_history_sha256,amendment,owner_comment,owner_decision,proposal_sha256,review_evidence_sha256,pending_evidence_sha256,pending_observed_at,ledger_evidence_sha256,ledger_observed_at,valid_until) VALUES('pocket-scanner-evaluation-v2-20261024','v2-d002','v2-d002-attempt-1','{"scope_id":"pocket-scanner-evaluation-v2-20261024","singleton":true,"created_at":"2026-10-24T12:56:53.928999+00:00","ledger_key":"monaco-first-six-aggregate","approved_at":"2026-10-24T12:40:25+00:00","plan_sha256":"cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109","valid_until":"2026-10-25T12:40:25+00:00","approval_ref":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029","app_source_sha":"2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc","approval_document":{"kind":"POCKET_SCANNER_EVALUATION_V2_EXTENSION_APPROVAL","status":"APPROVED","retries":0,"scopeId":"pocket-scanner-evaluation-v2-20261024","approvedAt":"2026-10-24T12:40:25.000Z","approvedBy":"OWNER","planSha256":"cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109","validUntil":"2026-10-25T12:40:25.000Z","approvalRef":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029","appSourceSha":"2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc","allowedCaseIds":["v2-d001","v2-d002","v2-d003","v2-d004","v2-d005","v2-d006"],"runtimeSourceSha":"20783ed5e8eb95a11df86b0d60766ffcbbf4fa79","approvalBodySha256":"f04851163218136baa0a633f00dd6398424fd32cd56ad6e19011b9b6d77311a2","aggregateCapMicroUsd":5000000,"originalAllowanceRef":"comment-6165012632","originalHeldMicroUsd":1506400,"maximumAdditionalCases":6,"maximumAdditionalSends":18,"maximumAdditionalMicroUsd":1980000},"runtime_source_sha":"20783ed5e8eb95a11df86b0d60766ffcbbf4fa79","original_pins_sha256":"90c4291252904ab977314d5c8010615bea2571c7efc5cddc0ae16df9f7d31165","original_held_microusd":1506400,"original_history_sha256":"4031aa388eecdac651a539a1af5ed861f0edc1944c748917001ba6546e4c2e64","approval_evidence_sha256":"f04851163218136baa0a633f00dd6398424fd32cd56ad6e19011b9b6d77311a2","maximum_additional_microusd":1980000}'::jsonb,'{"case_id":"v2-d002","identity":{"sourceSha":"20783ed5e8eb95a11df86b0d60766ffcbbf4fa79","backendRef":"neon:bitter-grass-28096464/br-aged-mode-zaa9u7lr/monaco_ledger","evaluation":{"jobId":"120905891814","runId":"40105387615","caseId":"v2-d002","scopeId":"pocket-scanner-evaluation-v2-20261024","attemptId":"v2-d002-attempt-1","runAttempt":"1","wrapperSha":"b7f2927f2c9438b18a9ce042904259a4acd11323","approvalRef":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029","evidenceSha":"778a47fce8405dca6b22f14a3c7b55e858f5e71e","appSourceSha":"2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc","sourceCaseId":"d002"},"planSha256":"cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109","projectRef":"proj_LTmAIE2Ve7gUAFJ9M74ZxIBI","environment":"monaco-first-six-inference","keyTrackingId":"key_aD5pc20EZBLGECNC","keyFingerprintSha256":"107e0cb3265e15aa25e3fa49c91512096f84b43d5fa834761c73c3cce2c99d0e"},"scope_id":"pocket-scanner-evaluation-v2-20261024","attempt_id":"v2-d002-attempt-1","admitted_at":"2026-10-24T15:07:25.068435+00:00","valid_until":"2026-10-24T15:50:00+00:00","admission_evidence_sha256":"19f1d10da46e434799b7582ede0e213a0e77f01187eec3740020dd0e002a2773","previous_case_receipt_sha256":"58b6efba5a71217e7a2f06c9c95362f79dfea50da4033e589245378717438447","reassessment_evidence_sha256":"26f4def92e19eda7b9715afc7e4383229314f64b3275758711a896b8fdba816c"}'::jsonb,'{"permit":{"case_id":"v2-d001","identity":{"sourceSha":"20783ed5e8eb95a11df86b0d60766ffcbbf4fa79","backendRef":"neon:bitter-grass-28096464/br-aged-mode-zaa9u7lr/monaco_ledger","evaluation":{"jobId":"120877741515","runId":"40095819408","caseId":"v2-d001","scopeId":"pocket-scanner-evaluation-v2-20261024","attemptId":"v2-d001-attempt-1","runAttempt":"1","wrapperSha":"6702f4c153b18b4caa1df82565c8bbf24bfb573b","approvalRef":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029","evidenceSha":"0d510d37af89e09b0360e1f1a555304d8ba46190","appSourceSha":"2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc","sourceCaseId":"d001"},"planSha256":"cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109","projectRef":"proj_LTmAIE2Ve7gUAFJ9M74ZxIBI","environment":"monaco-first-six-inference","keyTrackingId":"key_aD5pc20EZBLGECNC","keyFingerprintSha256":"107e0cb3265e15aa25e3fa49c91512096f84b43d5fa834761c73c3cce2c99d0e"},"scope_id":"pocket-scanner-evaluation-v2-20261024","attempt_id":"v2-d001-attempt-1","admitted_at":"2026-10-24T12:56:53.94601+00:00","valid_until":"2026-10-24T13:40:00+00:00","admission_evidence_sha256":"e6474ca7873819e5112e6a24189e4e971ffdf74b994f314bbd2ddea057cadb9b","previous_case_receipt_sha256":null,"reassessment_evidence_sha256":"8c7e599768a74ef23cbb40d384a4ec942e308e6dd8e0d73ac4a1aba0e217196d"},"claim":{"case_id":"v2-d001","scope_id":"pocket-scanner-evaluation-v2-20261024","attempt_id":"v2-d001-attempt-1","claimed_at":"2026-10-24T13:00:01.028768+00:00","reserved_microusd":330000},"account":{"case_id":"v2-d001","scope_id":"pocket-scanner-evaluation-v2-20261024","accounted_at":"2026-10-24T13:00:59.426395+00:00","receipt_sha256":"58b6efba5a71217e7a2f06c9c95362f79dfea50da4033e589245378717438447","diagnostic_sha256":"4db39e031c3ed48b09f9a49e3b1cd79039b32922eec109709d076bbf17464250","reserved_microusd":330000,"unused_rescue_voided":false,"diagnostic_artifact_id":"12560523103"},"submissions":[{"slot":"main","case_id":"v2-d001","scope_id":"pocket-scanner-evaluation-v2-20261024","request_id":"v2-d001-main-17b26f3b09a97a71","fingerprint":"e93220c8132bdf5c330792a2d710d9d19a28d5236fc8570ceffc6f3b93891fbe","submitted_at":"2026-10-24T13:00:01.123935+00:00","request_sha256":"17b26f3b09a97a71ba7dea6cbbcc4c524b887db031ba4db7d50b7c4eca6e38cc"},{"slot":"primary_precision","case_id":"v2-d001","scope_id":"pocket-scanner-evaluation-v2-20261024","request_id":"v2-d001-primary_precision-49e111df97816cc5","fingerprint":"3f3395ddd597ad1bc3afcac85b32215d602cbab9cc56394307cfdd0157f025f5","submitted_at":"2026-10-24T13:00:27.551879+00:00","request_sha256":"49e111df97816cc59b7486f4668dab4ef41c654305d0495382522997abe5fc93"},{"slot":"rescue_precision","case_id":"v2-d001","scope_id":"pocket-scanner-evaluation-v2-20261024","request_id":"v2-d001-rescue_precision-9b5edc72cc5ed49d","fingerprint":"b30acc1ee43d694ed6817f2b5253a52c5713e6d2661ca900c30c50a2b73f6a86","submitted_at":"2026-10-24T13:00:43.220181+00:00","request_sha256":"9b5edc72cc5ed49d6ee5ce606d57bd20620657dfc7a6cbb7938361639cf205bb"}],"receipts":[{"slot":"main","model":"gpt-5-mini-2025-08-07","usage":{"input_tokens":4711,"total_tokens":6979,"output_tokens":2268},"case_id":"v2-d001","scope_id":"pocket-scanner-evaluation-v2-20261024","request_id":"v2-d001-main-17b26f3b09a97a71","response_id":"resp_01b820449810e32d016adcabd2ad9487d29410bfa322665a26","receipted_at":"2026-10-24T13:00:27.454403+00:00","service_tier":"default","response_sha256":"6a271af7026e5b6c6447437d32ce4c67a262965a1df9c962439d892575468f06","provider_request_id":"req_ec63e5e91f7b4895af5ae29b507dd7ea"},{"slot":"primary_precision","model":"gpt-5-mini-2025-08-07","usage":{"input_tokens":2025,"total_tokens":4115,"output_tokens":2090},"case_id":"v2-d001","scope_id":"pocket-scanner-evaluation-v2-20261024","request_id":"v2-d001-primary_precision-49e111df97816cc5","response_id":"resp_025188363648e640016adcabebad1887d2a7d44753c75377f0","receipted_at":"2026-10-24T13:00:43.135507+00:00","service_tier":"default","response_sha256":"cdaaf844e6c51ab0f33d0f3c9d12392c7d97c45ad95b7a5385cc2fe276c29803","provider_request_id":"req_6d358e29b7784cea9f2544320c72227c"},{"slot":"rescue_precision","model":"gpt-5-mini-2025-08-07","usage":{"input_tokens":2070,"total_tokens":3862,"output_tokens":1792},"case_id":"v2-d001","scope_id":"pocket-scanner-evaluation-v2-20261024","request_id":"v2-d001-rescue_precision-9b5edc72cc5ed49d","response_id":"resp_009824200f655527016adcabfb5b3c87d2a3315d29edaeb5f0","receipted_at":"2026-10-24T13:00:58.725875+00:00","service_tier":"default","response_sha256":"5575ffbe4d18e9fe4ca42a0637e43388590b99ed79cdc63966dc00b66090ab58","provider_request_id":"req_e3ff39baa2394eabab33ac765bd43482"}],"pins":[{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d001","source_case_id":"d001","slot":"main","request_id":"v2-d001-main-17b26f3b09a97a71","fingerprint":"e93220c8132bdf5c330792a2d710d9d19a28d5236fc8570ceffc6f3b93891fbe","request_sha256":"17b26f3b09a97a71ba7dea6cbbcc4c524b887db031ba4db7d50b7c4eca6e38cc","max_output_tokens":7000,"bound_microusd":114000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d001","source_case_id":"d001","slot":"primary_precision","request_id":"v2-d001-primary_precision-49e111df97816cc5","fingerprint":"3f3395ddd597ad1bc3afcac85b32215d602cbab9cc56394307cfdd0157f025f5","request_sha256":"49e111df97816cc59b7486f4668dab4ef41c654305d0495382522997abe5fc93","max_output_tokens":4000,"bound_microusd":108000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d001","source_case_id":"d001","slot":"rescue_precision","request_id":"v2-d001-rescue_precision-9b5edc72cc5ed49d","fingerprint":"b30acc1ee43d694ed6817f2b5253a52c5713e6d2661ca900c30c50a2b73f6a86","request_sha256":"9b5edc72cc5ed49d6ee5ce606d57bd20620657dfc7a6cbb7938361639cf205bb","max_output_tokens":4000,"bound_microusd":108000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d002","source_case_id":"d002","slot":"main","request_id":"v2-d002-main-2a5a3eb40c635e70","fingerprint":"661b5ad27df69a887b6aac1a9b1365efcab0be17c73607a0bd56669338486488","request_sha256":"2a5a3eb40c635e7030f71bc792220ea4d3f80d726d7fa0efbe065a1102cfec76","max_output_tokens":7000,"bound_microusd":114000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d002","source_case_id":"d002","slot":"primary_precision","request_id":"v2-d002-primary_precision-55aba81625d4ae64","fingerprint":"af01d2aa8a11b6eba8c5987ae4139d420a7cfdab4b4ef4195d3a6e9cf3a34471","request_sha256":"55aba81625d4ae641a737698127b59e7eaae1c3473728b2cc375f44cc2a98cfa","max_output_tokens":4000,"bound_microusd":108000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d002","source_case_id":"d002","slot":"rescue_precision","request_id":"v2-d002-rescue_precision-4e7529d88cf5d859","fingerprint":"1321e10e57a516828b3e1773c071646fa6c6a9c13ca3818d8de9942638a87cc3","request_sha256":"4e7529d88cf5d8591c20facd937be1eb301692c4c79a9fe4fc6f60a1c20204b8","max_output_tokens":4000,"bound_microusd":108000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d003","source_case_id":"d003","slot":"main","request_id":"v2-d003-main-807048716f1af99a","fingerprint":"0cdfc26d28995f73eca477893107b72c4966a23e09eef65cecfec0302eec3e80","request_sha256":"807048716f1af99a15274601d2042862a1ed969de51ee4d9d259c1be64fe9045","max_output_tokens":7000,"bound_microusd":114000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d003","source_case_id":"d003","slot":"primary_precision","request_id":"v2-d003-primary_precision-c86fd9fc5ea9d287","fingerprint":"d9790b011fd2a3137555e9d94ded3b6bb9d960ebd602f97129e49c90422506af","request_sha256":"c86fd9fc5ea9d287db317d0b826b4e0238afa53a14af503c35dac9afd8a4de98","max_output_tokens":4000,"bound_microusd":108000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d003","source_case_id":"d003","slot":"rescue_precision","request_id":"v2-d003-rescue_precision-4858027d39ef4f8e","fingerprint":"c80ef66b838b378d968e9381aae13db17672827f4626fedca97a77de05097eb0","request_sha256":"4858027d39ef4f8e55ce97895f98d2d853d4d98c464f5f9bb315e958e2de935b","max_output_tokens":4000,"bound_microusd":108000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d004","source_case_id":"d004","slot":"main","request_id":"v2-d004-main-431b755f741c1caa","fingerprint":"75cf8302ac9f26e849bfa39d0b59e39525bca07632d5a456a9e8da1cc85dee62","request_sha256":"431b755f741c1caa5fbb0476515793db0384adaa913642d44222fefcb41e0e0b","max_output_tokens":7000,"bound_microusd":114000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d004","source_case_id":"d004","slot":"primary_precision","request_id":"v2-d004-primary_precision-d1ea4e6b0c05f818","fingerprint":"bd0a20f54de69ecb33deb406e82fca539a60c0cf1375d7e9e8ae8a1b614a0ddc","request_sha256":"d1ea4e6b0c05f818cac94941e62b9066f8184d9d68b80e8b0de3c7524e2daa84","max_output_tokens":4000,"bound_microusd":108000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d004","source_case_id":"d004","slot":"rescue_precision","request_id":"v2-d004-rescue_precision-bf0c936c1bec942a","fingerprint":"106fef123c1a0521af01f3048480c9e46c0ae30c62ec8448a74d9b92574302d3","request_sha256":"bf0c936c1bec942a3bb3827917227fb0a728ee4c5fc3f2f9134ed006f2b8e509","max_output_tokens":4000,"bound_microusd":108000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d005","source_case_id":"d005","slot":"main","request_id":"v2-d005-main-e6b8fa4a559b1aa7","fingerprint":"79363f22442658d65bca698fa754f95aa1b30966a238fe8f41c1b43ccb6efca8","request_sha256":"e6b8fa4a559b1aa751c765428900198ce03725dcafe5ad9e3d4b09d461cab59c","max_output_tokens":7000,"bound_microusd":114000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d005","source_case_id":"d005","slot":"primary_precision","request_id":"v2-d005-primary_precision-e6a1f67418b06550","fingerprint":"738ad4874c4efbe657a65cf7578aa870856394ae2503c475f87f3e44de02c849","request_sha256":"e6a1f67418b06550ec28b4f57033ecbc5789041fcc85c2d563f3024b4255517c","max_output_tokens":4000,"bound_microusd":108000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d005","source_case_id":"d005","slot":"rescue_precision","request_id":"v2-d005-rescue_precision-cbf492efa208a4f1","fingerprint":"d6cde76335fd7b05ed9911e3698c768b562bfc42e3c95ea3a6677c11f5eefd9b","request_sha256":"cbf492efa208a4f1023d79669a74c0d84a2421a07fb6e10bc94ed435a6ff64ba","max_output_tokens":4000,"bound_microusd":108000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d006","source_case_id":"d006","slot":"main","request_id":"v2-d006-main-b03bf9eb613dd0db","fingerprint":"25543b25cb54d36e559f433e5ac54fadb549b2bf7939ead6692c82d07cbd6b17","request_sha256":"b03bf9eb613dd0db2c7510bef89f6f006f26c0b0e7fda5b20fe8e4ca05d728ed","max_output_tokens":7000,"bound_microusd":114000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d006","source_case_id":"d006","slot":"primary_precision","request_id":"v2-d006-primary_precision-ef220e16148b70eb","fingerprint":"500cd6fe73cee9fee7706506aa91be22e83ba20404e54c61deb4d979f606d94a","request_sha256":"ef220e16148b70ebfc699c362ea77e493e8d56263bcf49ce195d254a1ff0c508","max_output_tokens":4000,"bound_microusd":108000},{"scope_id":"pocket-scanner-evaluation-v2-20261024","case_id":"v2-d006","source_case_id":"d006","slot":"rescue_precision","request_id":"v2-d006-rescue_precision-8f0fb5e7ea25be21","fingerprint":"b094dba321a9a99cb64b9d44d0a7843d8d642fa070f5fb1dd33c5eb4ad415d71","request_sha256":"8f0fb5e7ea25be21da91afe53a1a848386010743028978a1c27b0b1253abc408","max_output_tokens":4000,"bound_microusd":108000}]}'::jsonb,'4031aa388eecdac651a539a1af5ed861f0edc1944c748917001ba6546e4c2e64','{"kind":"POCKET_SCANNER_EVALUATION_V2_UNUSED_PERMIT_RECOVERY_AMENDMENT","approvedBy":"OWNER","approvalRef":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6387959150","approvalBodySha256":"165808d342e28e0e2a21bf603b9c7d6b85e50a959997af2a7eaf694f2381d2e1","approvedAt":"2026-10-24T18:30:58Z","proposalSha256":"b70a4e2371e6832ed7f7b717f0b4b8a0e9665a24ba45c9fe565f1cafe5820602","approvalRequestSha256":"b7acff72ac5374e7a901952dcfe72ad82eba8bb4e3b449d541a40c3f858556d7","ownerResponseSha256":"85a39ab345d672ff8ca9b9c6876f3adcacf45ee7c1e2dbd2408fd338bd55e07e","targetIdentity":{"sourceSha":"20783ed5e8eb95a11df86b0d60766ffcbbf4fa79","backendRef":"neon:bitter-grass-28096464/br-aged-mode-zaa9u7lr/monaco_ledger","evaluation":{"jobId":"120905891814","runId":"40105387615","caseId":"v2-d002","scopeId":"pocket-scanner-evaluation-v2-20261024","attemptId":"v2-d002-attempt-1","runAttempt":"1","wrapperSha":"b7f2927f2c9438b18a9ce042904259a4acd11323","approvalRef":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029","evidenceSha":"778a47fce8405dca6b22f14a3c7b55e858f5e71e","appSourceSha":"2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc","sourceCaseId":"d002"},"planSha256":"cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109","projectRef":"proj_LTmAIE2Ve7gUAFJ9M74ZxIBI","environment":"monaco-first-six-inference","keyTrackingId":"key_aD5pc20EZBLGECNC","keyFingerprintSha256":"107e0cb3265e15aa25e3fa49c91512096f84b43d5fa834761c73c3cce2c99d0e"},"originalPermit":{"case_id":"v2-d002","identity":{"sourceSha":"20783ed5e8eb95a11df86b0d60766ffcbbf4fa79","backendRef":"neon:bitter-grass-28096464/br-aged-mode-zaa9u7lr/monaco_ledger","evaluation":{"jobId":"120905891814","runId":"40105387615","caseId":"v2-d002","scopeId":"pocket-scanner-evaluation-v2-20261024","attemptId":"v2-d002-attempt-1","runAttempt":"1","wrapperSha":"b7f2927f2c9438b18a9ce042904259a4acd11323","approvalRef":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029","evidenceSha":"778a47fce8405dca6b22f14a3c7b55e858f5e71e","appSourceSha":"2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc","sourceCaseId":"d002"},"planSha256":"cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109","projectRef":"proj_LTmAIE2Ve7gUAFJ9M74ZxIBI","environment":"monaco-first-six-inference","keyTrackingId":"key_aD5pc20EZBLGECNC","keyFingerprintSha256":"107e0cb3265e15aa25e3fa49c91512096f84b43d5fa834761c73c3cce2c99d0e"},"scope_id":"pocket-scanner-evaluation-v2-20261024","attempt_id":"v2-d002-attempt-1","admitted_at":"2026-10-24T15:07:25.068435+00:00","valid_until":"2026-10-24T15:50:00+00:00","admission_evidence_sha256":"19f1d10da46e434799b7582ede0e213a0e77f01187eec3740020dd0e002a2773","previous_case_receipt_sha256":"58b6efba5a71217e7a2f06c9c95362f79dfea50da4033e589245378717438447","reassessment_evidence_sha256":"26f4def92e19eda7b9715afc7e4383229314f64b3275758711a896b8fdba816c"},"originalScope":{"scope_id":"pocket-scanner-evaluation-v2-20261024","singleton":true,"created_at":"2026-10-24T12:56:53.928999+00:00","ledger_key":"monaco-first-six-aggregate","approved_at":"2026-10-24T12:40:25+00:00","plan_sha256":"cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109","valid_until":"2026-10-25T12:40:25+00:00","approval_ref":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029","app_source_sha":"2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc","approval_document":{"kind":"POCKET_SCANNER_EVALUATION_V2_EXTENSION_APPROVAL","status":"APPROVED","retries":0,"scopeId":"pocket-scanner-evaluation-v2-20261024","approvedAt":"2026-10-24T12:40:25.000Z","approvedBy":"OWNER","planSha256":"cb2a6588759abd36b0cacf5972515dbd2a114d52c9e3224754d01af6b8a3e109","validUntil":"2026-10-25T12:40:25.000Z","approvalRef":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6384333029","appSourceSha":"2812bfbc6e8f62e93d0bc56957fd5ce71cc819dc","allowedCaseIds":["v2-d001","v2-d002","v2-d003","v2-d004","v2-d005","v2-d006"],"runtimeSourceSha":"20783ed5e8eb95a11df86b0d60766ffcbbf4fa79","approvalBodySha256":"f04851163218136baa0a633f00dd6398424fd32cd56ad6e19011b9b6d77311a2","aggregateCapMicroUsd":5000000,"originalAllowanceRef":"comment-6165012632","originalHeldMicroUsd":1506400,"maximumAdditionalCases":6,"maximumAdditionalSends":18,"maximumAdditionalMicroUsd":1980000},"runtime_source_sha":"20783ed5e8eb95a11df86b0d60766ffcbbf4fa79","original_pins_sha256":"90c4291252904ab977314d5c8010615bea2571c7efc5cddc0ae16df9f7d31165","original_held_microusd":1506400,"original_history_sha256":"4031aa388eecdac651a539a1af5ed861f0edc1944c748917001ba6546e4c2e64","approval_evidence_sha256":"f04851163218136baa0a633f00dd6398424fd32cd56ad6e19011b9b6d77311a2","maximum_additional_microusd":1980000},"previousCaseReceiptSha256":"58b6efba5a71217e7a2f06c9c95362f79dfea50da4033e589245378717438447","maximumLeases":1,"maximumLeaseSeconds":3600,"maximumLoginSeconds":1200,"retries":0,"caseBoundMicroUsd":330000,"aggregateCapMicroUsd":5000000}'::jsonb,'{"url":"https://github.com/nashysaimarkets/nash-ai-markets/issues/126#issuecomment-6387959150","author":"nashysaimarkets","body":"APPROVED OWNER AMENDMENT: POCKET_SCANNER_UNUSED_PERMIT_RECOVERY_V1\ndecision: APPROVED\napproval-request-sha256: b7acff72ac5374e7a901952dcfe72ad82eba8bb4e3b449d541a40c3f858556d7\nowner-response-sha256: 85a39ab345d672ff8ca9b9c6876f3adcacf45ee7c1e2dbd2408fd338bd55e07e\nproposal-sha256: b70a4e2371e6832ed7f7b717f0b4b8a0e9665a24ba45c9fe565f1cafe5820602\ntarget: v2-d002 / run 40105387615 / job 120905891814 / attempt 1\nOne non-renewable lease of at most 60 minutes, inside the unchanged original scope; login at most 20 minutes inside that lease.\nThe expired original permit and all prior history remain unchanged. No retry, new attempt, new keys, added budget, or changed runtime.","createdAt":"2026-10-24T18:30:58Z"}'::jsonb,'{"decision":"APPROVED","requestText":"Do you approve the reviewed protocol amendment proposal-sha256: b70a4e2371e6832ed7f7b717f0b4b8a0e9665a24ba45c9fe565f1cafe5820602 for v2-d002 / run 40105387615 / job 120905891814 / attempt 1? This authorizes one non-renewable execution lease of at most 60 minutes, within the existing scope ending 2026-10-25T12:40:25Z, and one login window of at most 20 minutes inside that lease. The expired original permit and prior history remain unchanged. The same runtime, app, credentials, case cost bound and existing total budget remain in force, with no retry or new attempt. Reply Yes to approve this amendment.","ownerResponseText":"Yes","recordedAt":"2026-10-24T18:30:51Z"}'::jsonb,'b70a4e2371e6832ed7f7b717f0b4b8a0e9665a24ba45c9fe565f1cafe5820602','8685ccd61ec3999a9b6c3a8178d853e8c6d7b94907a6ea78be1f8d669eace41e','368e2db5a9ff347bb3d06a11e4dc8a9b284d15bdf6444f724a9ad250d0d11b88','2026-10-24T19:19:45.234Z','63feca5e80a5d068cb4d5d9a7aaac0f0434593ba31ce4e84feea55bb4ae4fad1','2026-10-24T19:19:01.766766+00:00','2026-10-24T20:15:15.213499Z');
COMMIT;
