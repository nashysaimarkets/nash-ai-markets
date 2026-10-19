-- New v2 regression cases. Run after migration in a disposable transaction.
create function pg_temp.qa_plan(p_each bigint default 0) returns jsonb language sql as $$
select jsonb_agg(jsonb_build_object('slot',s,'model','gpt-5-mini-2025-08-07','serviceTier','default',
 'maxOutputTokens',case when s='main' then 7000 else 1400 end,'maxInputTextChars',50000,'maxSchemaBytes',50000,
 'maxImages',2,'maxImageBytes',4000000,'maxImageWidth',4096,'maxImageHeight',4096,'maxImagePixels',16777216,
 'maxCostMicroUsd',case when p_each>0 then p_each when s='main' then 114000 else 102800 end,
 'costBoundEvidenceRef','qa-pricing-evidence')) from unnest(array['main','primary_precision','rescue_precision']) s $$;
create function pg_temp.qa_ledger(p_key text,p_cap bigint default 5000000,p_config boolean default true,p_expired boolean default false) returns void language plpgsql as $$
begin
 insert into private.pocket_benchmark_pilot_ledgers(ledger_key,cap_microusd,project_ref,owner_approval_ref,candidate_sha,
  rate_tier,pricing_evidence_ref,allowed_case_ids,config_verified_at,enabled)
 values(p_key,p_cap,'proj_qa',p_key||'-approval',repeat('b',40),'default','qa-pricing-evidence',
  array['case-01','case-02','case-03','case-04','case-05','case-06'],now(),true);
 if p_config then
  insert into private.pocket_benchmark_budget_configs(ledger_key,project_ref,candidate_sha,staging_ref,key_tracking_id,key_fingerprint_sha256,
   model,service_tier,pricing_evidence_ref,runtime_evidence_sha256,reviewer_ref,verified_at,valid_until)
  values(p_key,'proj_qa',repeat('b',40),'pxlqvaddvghjjhenqmdh','key_qa_only',repeat('d',64),'gpt-5-mini-2025-08-07','default',
   'qa-pricing-evidence',repeat('c',64),'qa-independent-review',now()-case when p_expired then interval '2 hours' else interval '0 hours' end,
   now()+case when p_expired then interval '-1 hour' else interval '1 hour' end);
 end if;
end; $$;
create function pg_temp.qa_receipts(p_key text,p_case text,p_rescue boolean default false) returns void language plpgsql as $$
declare s text;
begin
 foreach s in array array['main','primary_precision','rescue_precision'] loop
  if s='rescue_precision' and not p_rescue then
   perform public.void_pocket_benchmark_call(p_key,p_case,s,'qa conditional path unused');
  else
   perform public.submit_pocket_benchmark_call(p_key,p_case,s,repeat('a',64));
   perform public.record_pocket_benchmark_receipt(p_key,p_case,s,'qa-req-'||p_key||p_case||s,'qa-resp-'||p_key||p_case||s,
    'gpt-5-mini-2025-08-07','default','{"input_tokens":10,"output_tokens":5,"total_tokens":15}',repeat('a',64));
  end if;
 end loop;
end; $$;
do $$
declare r jsonb; p jsonb:=pg_temp.qa_plan(); failed boolean; s text; i integer; v_before bigint;
begin
 perform pg_temp.qa_ledger('qa-budget');
 perform pg_temp.qa_ledger('qa-no-config',5000000,false);
 perform pg_temp.qa_ledger('qa-expired',5000000,true,true);
 foreach s in array array['qa-no-config','qa-expired'] loop
  failed:=false;begin perform public.claim_pocket_benchmark_case(s,'case-01','proj_qa',s||'-approval',repeat('b',40),p);
  exception when raise_exception then failed:=true;end; assert failed,'missing/expired verification admitted spend';
 end loop;
 failed:=false;begin perform public.claim_pocket_benchmark_case('qa-budget','case-01','proj_qa','qa-budget-approval',repeat('b',40),pg_temp.qa_plan(1));
 exception when raise_exception then failed:=true;end;assert failed,'caller under-reserved full context';
 failed:=false;begin perform public.claim_pocket_benchmark_case('qa-budget','case-01','proj_qa','qa-budget-approval',repeat('b',40),
  jsonb_set(p,'{0,model}','"gpt-5-mini"'));
 exception when raise_exception then failed:=true;end;assert failed,'mutable model alias admitted';
 failed:=false;begin perform public.claim_pocket_benchmark_case('qa-budget','case-01','proj_qa','qa-budget-approval',repeat('b',40),
  jsonb_set(p,'{0,serviceTier}','"priority"'));
 exception when raise_exception then failed:=true;end;assert failed,'unpriced tier admitted';
 r:=public.claim_pocket_benchmark_case('qa-budget','case-01','proj_qa','qa-budget-approval',repeat('b',40),p);
 assert r->>'allowed'='true' and (r->>'committed_microusd')::bigint=319600,'full worst-case reservation not held';
 r:=public.claim_pocket_benchmark_case('qa-budget','case-02','proj_qa','qa-budget-approval',repeat('b',40),p);
 assert r->>'reason'='previous_case_unresolved','unresolved reservation allowed next case';
 perform public.submit_pocket_benchmark_call('qa-budget','case-01','main',repeat('a',64));
 r:=public.submit_pocket_benchmark_call('qa-budget','case-01','main',repeat('a',64));
 assert r->>'claimed'='false','duplicate dispatch permitted';
 failed:=false;begin perform public.void_pocket_benchmark_call('qa-budget','case-01','main','timeout');
 exception when raise_exception then failed:=true;end;assert failed,'possibly incurred cost was voided';
 failed:=false;begin perform public.account_pocket_benchmark_reserved_case('qa-budget','case-01');
 exception when raise_exception then failed:=true;end;assert failed,'unknown receipt financially bypassed';
 perform pg_temp.qa_receipts('qa-budget','case-01');
 failed:=false;begin perform public.settle_pocket_benchmark_call('qa-budget','case-01','main',0,'qa-req-qa-budgetcase-01main');
 exception when raise_exception then failed:=true;end;assert failed,'unsupported zero accepted as independent settlement';
 r:=public.account_pocket_benchmark_reserved_case('qa-budget','case-01');
 assert r->>'accounted'='true' and r->>'financially_settled'='false' and r->>'actual_microusd' is null
  and (r->>'reserved_microusd')::bigint=216800,'reservation was labelled actual dollars';
 assert not exists(select 1 from private.pocket_benchmark_pilot_calls where ledger_key='qa-budget' and (status='settled' or actual_microusd is not null)),
  'reservation accounting altered financial settlement';
 perform public.record_pocket_benchmark_measurement('qa-budget','case-01','{"caseId":"case-01","scored":false}');
 r:=public.read_pocket_benchmark_reserved_measurement('qa-budget','case-01');
 assert r->>'available'='true' and r->>'financially_settled'='false' and r->>'actual_microusd' is null,'provisional evidence mislabelled';
 r:=public.release_pocket_benchmark_measurement('qa-budget','case-01');assert r->>'released'='false','original financial release veto bypassed';
 r:=public.claim_pocket_benchmark_case('qa-budget','case-02','proj_qa','qa-budget-approval',repeat('b',40),p);
 assert r->>'allowed'='true' and (r->>'committed_microusd')::bigint=536400,'accounted reservations not cumulative';
 perform pg_temp.qa_ledger('qa-cap');
 r:=public.claim_pocket_benchmark_case('qa-cap','case-01','proj_qa','qa-cap-approval',repeat('b',40),pg_temp.qa_plan(1000000));
 assert r->>'allowed'='true','cap setup failed';
 perform pg_temp.qa_receipts('qa-cap','case-01',true);perform public.account_pocket_benchmark_reserved_case('qa-cap','case-01');
 -- Separately inserted synthetic DBA evidence tests genuine settlement without
 -- refunding reservation headroom. Never use this QA row for an actual call.
 insert into private.pocket_benchmark_pilot_cost_attestations(ledger_key,case_id,slot,project_ref,provider_request_id,provider_response_id,
  model,service_tier,actual_microusd,external_billing_evidence_ref,external_billing_evidence_sha256,reviewer_ref)
 values('qa-cap','case-01','main','proj_qa','qa-req-qa-capcase-01main','qa-resp-qa-capcase-01main',
  'gpt-5-mini-2025-08-07','default',0,'qa-synthetic-zero-evidence',repeat('f',64),'qa-separate-reviewer');
 r:=public.settle_pocket_benchmark_call('qa-cap','case-01','main',0,'qa-req-qa-capcase-01main');
 assert (r->>'committed_microusd')::bigint=3000000,'actual zero recycled worst-case budget';
 update private.pocket_benchmark_pilot_ledgers set enabled=false where ledger_key='qa-cap';
 failed:=false;begin perform public.read_pocket_benchmark_reserved_measurement('qa-cap','case-01');
 exception when raise_exception then failed:=true;end;assert failed,'disabled ledger read bypass';
 update private.pocket_benchmark_pilot_ledgers set enabled=true where ledger_key='qa-cap';
 r:=public.claim_pocket_benchmark_case('qa-cap','case-02','proj_qa','qa-cap-approval',repeat('b',40),pg_temp.qa_plan(1000000));
 assert r->>'reason'='pilot_cap_exceeded' and (r->>'committed_microusd')::bigint=3000000,'aggregate cap reset or bypass';
 failed:=false;begin insert into private.pocket_benchmark_pilot_ledgers(ledger_key,cap_microusd,project_ref,owner_approval_ref,candidate_sha,
  rate_tier,pricing_evidence_ref,allowed_case_ids) values('qa-duplicate',5000000,'proj_qa','qa-cap-approval',repeat('b',40),'default','qa-pricing-evidence',array['case-01']);
 exception when unique_violation then failed:=true;end;assert failed,'same owner approval created another allowance';
 foreach s in array array[
  'update private.pocket_benchmark_pilot_ledgers set cap_microusd=4999999 where ledger_key=''qa-cap''',
  'delete from private.pocket_benchmark_budget_accounts where ledger_key=''qa-cap''',
  'update private.pocket_benchmark_budget_configs set valid_until=valid_until+interval ''1 hour'' where ledger_key=''qa-cap''',
  'update private.pocket_benchmark_pilot_calls set estimated_microusd=1 where ledger_key=''qa-cap''',
  'delete from private.pocket_benchmark_pilot_calls where ledger_key=''qa-cap''',
  'truncate private.pocket_benchmark_pilot_calls cascade',
  'truncate private.pocket_benchmark_budget_accounts',
  'truncate private.pocket_benchmark_budget_configs'
 ] loop failed:=false;begin execute s;exception when raise_exception then failed:=true;end;assert failed,'immutable history reset allowed';end loop;
 -- Six receipt-backed cases remain reserved, never financially settled.
 perform pg_temp.qa_ledger('qa-six');
 for i in 1..6 loop
  s:='case-0'||i;r:=public.claim_pocket_benchmark_case('qa-six',s,'proj_qa','qa-six-approval',repeat('b',40),p);
  assert r->>'allowed'='true','six-case reservation failed';perform pg_temp.qa_receipts('qa-six',s,true);
  perform public.account_pocket_benchmark_reserved_case('qa-six',s);
 end loop;
 assert (select sum(estimated_microusd) from private.pocket_benchmark_pilot_calls where ledger_key='qa-six')=1917600,
  'six-case worst-case total differs from independent arithmetic';
 assert (select count(*) from private.pocket_benchmark_pilot_calls where ledger_key='qa-six' and actual_microusd is null and status='submitted')=18,
  'estimated costs were written as actual settlement';
 -- Missing timestamp, wrong fingerprint and stale metadata cannot prove binding.
 foreach s in array array['{}','{"verifiedAt":"2020-01-01T00:00:00Z"}'] loop
  failed:=false;begin perform public.assert_pocket_benchmark_runtime_binding('qa-six',s::jsonb);
  exception when raise_exception then failed:=true;end;assert failed,'invalid runtime binding accepted';
 end loop;
 -- A valid structured binding matches DBA-reviewed metadata; omitted/stale
 -- timestamps and a different credential fingerprint do not.
 r:=jsonb_build_object('projectId','proj_qa','candidateSha',repeat('b',40),'keyTrackingId','key_qa_only',
  'keyFingerprintSha256',repeat('d',64),'backendProjectRef','pxlqvaddvghjjhenqmdh','model','gpt-5-mini-2025-08-07',
  'organisationId','org-5vLRRzXwcigUx96TVE0rI3RW','keyTrackingVerification','UNIQUE_REDACTED_METADATA_AND_PROJECT_AUTHORIZATION',
  'verifiedAt',clock_timestamp());
 assert public.assert_pocket_benchmark_runtime_binding('qa-six',r)->>'binding_matches'='true','matching reviewed binding denied';
 failed:=false;begin perform public.assert_pocket_benchmark_runtime_binding('qa-six',r-'verifiedAt');
 exception when raise_exception then failed:=true;end;assert failed,'missing timestamp accepted';
 failed:=false;begin perform public.assert_pocket_benchmark_runtime_binding('qa-six',r||jsonb_build_object('keyFingerprintSha256',repeat('e',64)));
 exception when raise_exception then failed:=true;end;assert failed,'different key fingerprint accepted';
 -- Re-verification appends evidence, without changing the allowance or held costs.
 insert into private.pocket_benchmark_budget_configs select ledger_key,project_ref,candidate_sha,staging_ref,key_tracking_id,key_fingerprint_sha256,
  model,service_tier,pricing_evidence_ref,repeat('e',64),reviewer_ref,clock_timestamp(),clock_timestamp()+interval '1 hour'
 from private.pocket_benchmark_budget_configs where ledger_key='qa-cap';
 r:=public.claim_pocket_benchmark_case('qa-cap','case-02','proj_qa','qa-cap-approval',repeat('b',40),pg_temp.qa_plan(1000000));
 assert r->>'reason'='pilot_cap_exceeded' and (r->>'committed_microusd')::bigint=3000000,'metadata refresh reset allowance';
 assert (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'
  and c.relname in ('pocket_benchmark_budget_configs','pocket_benchmark_budget_accounts') and c.relrowsecurity)=2,'RLS absent';
 foreach s in array array['anon','authenticated','service_role'] loop
  assert not has_table_privilege(s,'private.pocket_benchmark_budget_configs','INSERT'), 'app can self-verify runtime/pricing';
  assert not has_table_privilege(s,'private.pocket_benchmark_budget_accounts','INSERT'), 'app can forge budget accounting';
  assert not has_table_privilege(s,'private.pocket_benchmark_pilot_cost_attestations','INSERT'),'app can forge actual bills';
 end loop;
 foreach s in array array['anon','authenticated'] loop
  assert not has_function_privilege(s,'public.account_pocket_benchmark_reserved_case(text,text)','EXECUTE'),'public budget RPC exposure';
  assert not has_function_privilege(s,'public.read_pocket_benchmark_reserved_measurement(text,text)','EXECUTE'),'public measurement exposure';
 end loop;
 assert has_function_privilege('service_role','public.account_pocket_benchmark_reserved_case(text,text)','EXECUTE'),'server RPC missing';
end; $$;
set local role service_role;
select public.read_pocket_benchmark_reserved_measurement('qa-budget','case-01')->>'accounting_status' as service_role_budget_status;
reset role;
select 'PASS: v2 reservations, six cases, unknown charges, immutable $5 cap, financial veto, RLS and permissions' as result;

savepoint qa_operational_rollback;
update private.pocket_benchmark_pilot_ledgers set enabled=false;
revoke execute on function public.claim_pocket_benchmark_case(text,text,text,text,text,jsonb),
 private.claim_pocket_benchmark_case(text,text,text,text,text,jsonb),public.submit_pocket_benchmark_call(text,text,text,text),
 private.submit_pocket_benchmark_call(text,text,text,text),public.read_pocket_benchmark_reserved_measurement(text,text),
 private.read_pocket_benchmark_reserved_measurement(text,text) from service_role;
set local role service_role;
do $$begin
 assert not has_function_privilege('service_role','public.claim_pocket_benchmark_case(text,text,text,text,text,jsonb)','EXECUTE'),'rollback left claims enabled';
 assert not has_function_privilege('service_role','private.submit_pocket_benchmark_call(text,text,text,text)','EXECUTE'),'rollback left private dispatch enabled';
end;$$;
reset role;
do $$begin
 assert (select sum(estimated_microusd) from private.pocket_benchmark_pilot_calls where ledger_key='qa-six')=1917600,'operational rollback lost reservations';
 assert (select count(*) from private.pocket_benchmark_budget_accounts where ledger_key='qa-six')=6,'operational rollback lost evidence';
end;$$;
rollback to savepoint qa_operational_rollback;
select 'PASS: shutdown revoked dispatch and preserved all ledger/evidence history' as rollback_result;
