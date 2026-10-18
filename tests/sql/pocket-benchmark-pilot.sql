-- Execute after 20261014113000_pocket_benchmark_pilot.sql inside BEGIN/ROLLBACK.
do $$
declare
  plan jsonb := '[
    {"slot":"main","model":"verified-model","serviceTier":"default","maxOutputTokens":7000,"maxInputTextChars":1000,"maxSchemaBytes":1000,"maxImages":1,"maxImageBytes":1000,"maxImageWidth":100,"maxImageHeight":100,"maxImagePixels":10000,"maxCostMicroUsd":100000,"costBoundEvidenceRef":"qa-pricing"},
    {"slot":"primary_precision","model":"verified-model","serviceTier":"default","maxOutputTokens":1400,"maxInputTextChars":1000,"maxSchemaBytes":1000,"maxImages":1,"maxImageBytes":1000,"maxImageWidth":100,"maxImageHeight":100,"maxImagePixels":10000,"maxCostMicroUsd":100000,"costBoundEvidenceRef":"qa-pricing"},
    {"slot":"rescue_precision","model":"verified-model","serviceTier":"default","maxOutputTokens":1400,"maxInputTextChars":1000,"maxSchemaBytes":1000,"maxImages":2,"maxImageBytes":2000,"maxImageWidth":100,"maxImageHeight":100,"maxImagePixels":20000,"maxCostMicroUsd":100000,"costBoundEvidenceRef":"qa-pricing"}
  ]'::jsonb;
  usage jsonb := '{"input_tokens":10,"output_tokens":5,"total_tokens":15}'::jsonb;
  r jsonb;
  failed boolean;
  v_test_approval text;
  v_change text;
  sha text := repeat('a',64);
begin
  insert into private.pocket_benchmark_pilot_ledgers(ledger_key,cap_microusd,project_ref,owner_approval_ref,candidate_sha,rate_tier,pricing_evidence_ref,allowed_case_ids,config_verified_at,enabled)
  values('qa-pilot',5000000,'proj_qa','qa-benchmark-approval-20261018',repeat('b',40),'default','qa-pricing',array['range-clear'],now(),true);
  -- A separate ledger key MUST NOT reuse the same approved $5 allowance.
  -- This closes the independent-ledger aggregate spending loophole.
  failed:=false;
  begin
    insert into private.pocket_benchmark_pilot_ledgers
      (ledger_key,cap_microusd,project_ref,owner_approval_ref,candidate_sha,rate_tier,pricing_evidence_ref,allowed_case_ids,config_verified_at,enabled)
    values('qa-duplicate-ledger',5000000,'proj_qa','qa-benchmark-approval-20261018',repeat('b',40),'default','qa-pricing',array['range-clear'],now(),true);
  exception when unique_violation then failed:=true; end;
  assert failed,'second ledger reused owner approval with another ledger key';

  -- Case/whitespace aliases are rejected instead of silently treated as a
  -- second independently spendable authorisation.
  for v_test_approval in select unnest(array[
    'QA-BENCHMARK-APPROVAL-20261018',
    ' qa-benchmark-approval-20261018',
    'qa-benchmark-approval-20261018 ',
    'comment-06165012632'
  ]) loop
    failed:=false;
    begin
      insert into private.pocket_benchmark_pilot_ledgers
        (ledger_key,cap_microusd,project_ref,owner_approval_ref,candidate_sha,rate_tier,pricing_evidence_ref,allowed_case_ids,config_verified_at,enabled)
      values('qa-alias-ledger',5000000,'proj_qa',v_test_approval,repeat('b',40),'default','qa-pricing',array['range-clear'],now(),true);
    exception when check_violation then failed:=true; end;
    assert failed,'approval alias created independent allowance';
  end loop;

  -- Neither approval identity, max dollars, application/model scope, evidence,
  -- nor allowed cases may be edited to reset prior spent/reserved budget.
  for v_change in select unnest(array[
    'cap_microusd=4000000',
    'project_ref=''other-project''',
    'owner_approval_ref=''qa-unrelated-approval''',
    'candidate_sha=repeat(''a'',40)',
    'pricing_evidence_ref=''other-pricing''',
    'allowed_case_ids=ARRAY[''double-top'']::text[]',
    'created_at=created_at + interval ''1 day'''
  ]) loop
    failed:=false;
    begin
      execute 'update private.pocket_benchmark_pilot_ledgers set ' || v_change || ' where ledger_key=''qa-pilot''';
    exception when others then failed:=true; end;
    assert failed,'immutable approval scope changed';
  end loop;

  failed:=false;
  begin delete from private.pocket_benchmark_pilot_ledgers where ledger_key='qa-pilot';
  exception when others then failed:=true; end;
  assert failed,'approved ledger could be deleted and recreated for fresh allowance';

  -- Even the approval verification timestamp cannot be reset after approval.
  failed:=false;
  begin update private.pocket_benchmark_pilot_ledgers set config_verified_at=null where ledger_key='qa-pilot';
  exception when others then failed:=true; end;
  assert failed,'approved ledger verification could be cleared';

  r:=public.claim_pocket_benchmark_case('qa-pilot','range-clear','proj_qa','qa-benchmark-approval-20261018',repeat('b',40),plan);
  assert r->>'status'='reserved' and (r->>'committed_microusd')::bigint=300000,'complete reservation missing';
  assert public.submit_pocket_benchmark_call('qa-pilot','range-clear','main',sha)->>'claimed'='true';
  assert public.submit_pocket_benchmark_call('qa-pilot','range-clear','primary_precision',sha)->>'claimed'='true';

  failed:=false;
  begin perform public.record_pocket_benchmark_receipt('qa-pilot','range-clear','main','req-main','resp-main','verified-model','default',null,sha);
  exception when others then failed:=true; end;
  assert failed,'NULL provider usage accepted';
  perform public.record_pocket_benchmark_receipt('qa-pilot','range-clear','main','req-main','resp-main','verified-model','default',usage,sha);
  perform public.record_pocket_benchmark_receipt('qa-pilot','range-clear','main','req-main','resp-main','verified-model','default',usage,sha);
  failed:=false;
  begin perform public.record_pocket_benchmark_receipt('qa-pilot','range-clear','main','req-main','resp-main','verified-model','default','{"input_tokens":999,"output_tokens":5,"total_tokens":1004}',sha);
  exception when others then failed:=true; end;
  assert failed,'changed usage accepted on receipt replay';
  failed:=false;
  begin perform public.record_pocket_benchmark_receipt('qa-pilot','range-clear','primary_precision','req-main','resp-main','verified-model','default',usage,sha);
  exception when others then failed:=true; end;
  assert failed,'provider IDs reused across slots';
  perform public.record_pocket_benchmark_receipt('qa-pilot','range-clear','primary_precision','req-precision','resp-precision','verified-model','default',usage,sha);

  failed:=false;
  begin perform public.settle_pocket_benchmark_call('qa-pilot','range-clear','main',null,'req-main');
  exception when others then failed:=true; end;
  assert failed,'NULL authoritative settlement accepted';
  assert (select status='submitted' and actual_microusd is null from private.pocket_benchmark_pilot_calls where ledger_key='qa-pilot' and case_id='range-clear' and slot='main'),'failed settlement changed call';
  perform public.void_pocket_benchmark_call('qa-pilot','range-clear','rescue_precision','not required');
  perform public.record_pocket_benchmark_measurement('qa-pilot','range-clear','{"tp":1,"fp":0,"fn":0,"precision":1,"recall":1,"latency_ms":10}'::jsonb);
  perform public.settle_pocket_benchmark_call('qa-pilot','range-clear','main',100,'req-main');
  perform public.settle_pocket_benchmark_call('qa-pilot','range-clear','primary_precision',200,'req-precision');
  r:=public.assert_pocket_benchmark_case_reconciled('qa-pilot','range-clear');
  assert r->>'reconciled'='true' and (r->>'committed_microusd')::bigint=300,'authoritative settlement did not reconcile';

  update private.pocket_benchmark_pilot_ledgers set enabled=false where ledger_key='qa-pilot';
  r:=public.release_pocket_benchmark_measurement('qa-pilot','range-clear');
  assert r->>'released'='false' and r->>'reason'='benchmark_ledger_disabled','disabled ledger released measurement';
  r:=public.assert_pocket_benchmark_case_reconciled('qa-pilot','range-clear');
  assert r->>'reconciled'='false' and r->>'reason'='benchmark_ledger_disabled','disabled ledger remained reconciled';
  update private.pocket_benchmark_pilot_ledgers set enabled=true where ledger_key='qa-pilot';

  -- Even a directly corrupted settled row must fail closed and retain its reserve.
  update private.pocket_benchmark_pilot_calls set actual_microusd=null where ledger_key='qa-pilot' and case_id='range-clear' and slot='main';
  r:=public.assert_pocket_benchmark_case_reconciled('qa-pilot','range-clear');
  assert r->>'reconciled'='false' and (r->>'unknown_settlements')::int=1,'unknown settlement released';
  assert (r->>'committed_microusd')::bigint=100200,'unknown settlement reserve not retained';
end $$;
select 'pocket_benchmark_pilot_sql_pass' as result;
