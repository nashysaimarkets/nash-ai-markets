-- Run after both migrations inside BEGIN; all simulated data rolls back.
DO $$ DECLARE r jsonb; blocked boolean; BEGIN
INSERT INTO private.pocket_test_spend_ledgers(ledger_key,project_ref,cap_microusd,historical_spend_microusd,historical_attribution_complete,owner_approval_ref,owner_approved_at,enabled) VALUES('receipt-rollback-QA','SIMULATED-NO-PROVIDER',2000000,0,true,'SIMULATED-NOT-APPROVAL',now(),true);
PERFORM public.reserve_pocket_test_spend('receipt-rollback-QA','a','SIMULATED-NO-PROVIDER','SIMULATED-NOT-APPROVAL',100000);
PERFORM public.submit_pocket_test_spend('receipt-rollback-QA','a');
r:= public.record_pocket_test_spend_receipt('receipt-rollback-QA','a','TEST-REQUEST','TEST-RESPONSE','TEST-MODEL','{"input_tokens":10}'::jsonb);
IF r->>'status' <> 'submitted' THEN RAISE EXCEPTION 'receipt wrongly settled spend'; END IF;
PERFORM public.record_pocket_test_spend_receipt('receipt-rollback-QA','a','TEST-REQUEST','TEST-RESPONSE','TEST-MODEL','{"input_tokens":10}'::jsonb);
blocked:=false; BEGIN PERFORM public.record_pocket_test_spend_receipt('receipt-rollback-QA','a','DIFFERENT','TEST-RESPONSE','TEST-MODEL',null); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
IF NOT blocked THEN RAISE EXCEPTION 'receipt conflict accepted'; END IF;
blocked:=false; BEGIN PERFORM public.settle_pocket_test_spend('receipt-rollback-QA','a',100,'DIFFERENT'); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
IF NOT blocked THEN RAISE EXCEPTION 'settlement changed receipt identity'; END IF;
IF (SELECT actual_microusd IS NOT NULL FROM private.pocket_test_spend_reservations WHERE ledger_key='receipt-rollback-QA') THEN RAISE EXCEPTION 'usage inferred charged dollars'; END IF;
PERFORM public.settle_pocket_test_spend('receipt-rollback-QA','a',100,'TEST-REQUEST');
END; $$;
SELECT 'PASS: immutable receipt, no guessed cost, idempotency, conflicting settlement rejected' AS receipt_regressions;
ROLLBACK;
