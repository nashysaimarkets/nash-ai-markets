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
  sha text := repeat('a',64);
begin
  insert into private.pocket_benchmark_pilot_ledgers(ledger_key,cap_microusd,project_ref,owner_approval_ref,candidate_sha,rate_tier,pricing_evidence_ref,allowed_case_ids,config_verified_at,enabled)
  values('qa-pilot',5000000,'proj_qa','comment-6165012632',repeat('b',40),'default','qa-pricing',array['range-clear'],now(),true);
  r:=public.claim_pocket_benchmark_case('qa-pilot','range-clear','proj_qa','comment-6165012632',repeat('b',40),plan);
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
