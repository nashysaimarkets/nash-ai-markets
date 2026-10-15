-- Run after the migration inside a transaction; this file always rolls back.
-- All project/approval identifiers are simulated, never expenditure authority.
DO $$
DECLARE r jsonb; blocked boolean; n integer;
BEGIN
  IF (public.reserve_pocket_test_spend('qa-rollback-ledger','a','TEST-NO-PROVIDER','TEST-NOT-APPROVAL',100000)->>'allowed')::boolean THEN
    RAISE EXCEPTION 'unconfigured ledger permitted spend';
  END IF;
  INSERT INTO private.pocket_test_spend_ledgers(ledger_key,project_ref,cap_microusd,historical_spend_microusd,historical_attribution_complete,owner_approval_ref,owner_approved_at,enabled)
    VALUES('qa-rollback-ledger','TEST-NO-PROVIDER',2000000,500000,true,'TEST-NOT-APPROVAL',now(),true);
  r := public.reserve_pocket_test_spend('qa-rollback-ledger','a','TEST-NO-PROVIDER','TEST-NOT-APPROVAL',500000);
  IF r->>'status' <> 'reserved' OR (r->>'remaining_microusd')::bigint <> 1000000 THEN RAISE EXCEPTION 'history not counted'; END IF;
  r := public.reserve_pocket_test_spend('qa-rollback-ledger','a','TEST-NO-PROVIDER','TEST-NOT-APPROVAL',500000);
  IF NOT (r->>'idempotent')::boolean THEN RAISE EXCEPTION 'reservation not idempotent'; END IF;
  r := public.reserve_pocket_test_spend('qa-rollback-ledger','wrong','WRONG-PROJECT','TEST-NOT-APPROVAL',100000);
  IF r->>'reason' <> 'scope_mismatch' THEN RAISE EXCEPTION 'wrong project accepted'; END IF;
  UPDATE private.pocket_test_spend_ledgers SET enabled=false WHERE ledger_key='qa-rollback-ledger';
  blocked := false;
  BEGIN PERFORM public.submit_pocket_test_spend('qa-rollback-ledger','a'); EXCEPTION WHEN OTHERS THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'disabled ledger claimed dispatch'; END IF;
  UPDATE private.pocket_test_spend_ledgers SET enabled=true,owner_approval_ref='REPLACEMENT-TEST-APPROVAL' WHERE ledger_key='qa-rollback-ledger';
  blocked := false;
  BEGIN PERFORM public.submit_pocket_test_spend('qa-rollback-ledger','a'); EXCEPTION WHEN OTHERS THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'revoked approval claimed dispatch'; END IF;
  UPDATE private.pocket_test_spend_ledgers SET owner_approval_ref='TEST-NOT-APPROVAL' WHERE ledger_key='qa-rollback-ledger';
  r := public.submit_pocket_test_spend('qa-rollback-ledger','a');
  IF NOT (r->>'claimed')::boolean THEN RAISE EXCEPTION 'first dispatch not claimed'; END IF;
  r := public.submit_pocket_test_spend('qa-rollback-ledger','a');
  IF (r->>'claimed')::boolean THEN RAISE EXCEPTION 'duplicate dispatch claimed'; END IF;
  blocked := false;
  BEGIN PERFORM public.void_pocket_test_spend('qa-rollback-ledger','a','unsafe release'); EXCEPTION WHEN OTHERS THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'uncertain submitted spend released'; END IF;
  r := public.reserve_pocket_test_spend('qa-rollback-ledger','b','TEST-NO-PROVIDER','TEST-NOT-APPROVAL',1000000);
  IF (r->>'remaining_microusd')::bigint <> 0 THEN RAISE EXCEPTION 'pending spend not counted'; END IF;
  r := public.reserve_pocket_test_spend('qa-rollback-ledger','c','TEST-NO-PROVIDER','TEST-NOT-APPROVAL',1);
  IF r->>'reason' <> 'cumulative_cap_exceeded' THEN RAISE EXCEPTION 'cap exceeded'; END IF;
  r := public.settle_pocket_test_spend('qa-rollback-ledger','a',2100000,'TEST-PROVIDER-NO-CALL');
  IF NOT (r->>'cap_exceeded')::boolean OR (r->>'actual_microusd')::bigint <> 2100000 THEN RAISE EXCEPTION 'actual overrun concealed'; END IF;
  blocked := false;
  BEGIN PERFORM public.submit_pocket_test_spend('qa-rollback-ledger','b'); EXCEPTION WHEN OTHERS THEN blocked := true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'dispatch after overrun'; END IF;
  PERFORM public.void_pocket_test_spend('qa-rollback-ledger','b','never dispatched');
  FOR n IN 1..3 LOOP
    IF has_function_privilege((ARRAY['anon','authenticated','service_role'])[n], 'public.reserve_pocket_test_spend(text,text,text,text,bigint)', 'EXECUTE') <> (n=3) THEN
      RAISE EXCEPTION 'incorrect RPC grant';
    END IF;
    IF has_table_privilege((ARRAY['anon','authenticated','service_role'])[n], 'private.pocket_test_spend_ledgers', 'SELECT') THEN RAISE EXCEPTION 'private ledger exposed'; END IF;
  END LOOP;
END;
$$;
SELECT 'PASS: history, scope, revocation, duplicate dispatch, unresolved spend, cap, overrun, grants' AS ledger_regressions;
ROLLBACK;
