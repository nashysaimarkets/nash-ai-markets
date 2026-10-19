-- All data synthetic; wrap in BEGIN/ROLLBACK in disposable PG only.
insert into auth.users(id,email,email_confirmed_at) values
 ('11111111-1111-4111-8111-111111111111','one@example.test',now()),
 ('22222222-2222-4222-8222-222222222222','two@example.test',now()),
 ('33333333-3333-4333-8333-333333333333','three@example.test',now()),
 ('44444444-4444-4444-8444-444444444444','four@example.test',now());
insert into private.pocket_web_identities values
 ('11111111-1111-4111-8111-111111111111','cus_QA1'),
 ('22222222-2222-4222-8222-222222222222','cus_QA2'),
 ('44444444-4444-4444-8444-444444444444','cus_QA4');
do $$ declare a jsonb;b jsonb;c jsonb;i uuid;s jsonb; begin
  assert not has_table_privilege('service_role','private.pocket_checkout_intents','INSERT'), 'runtime bypass-RLS must not bypass ACL';
  assert not has_table_privilege('service_role','private.pocket_checkout_baselines','INSERT'), 'runtime cannot manufacture baseline';
  assert not has_function_privilege('service_role','public.attest_pocket_checkout_baseline(uuid,uuid,text,text,boolean,text,text,text,timestamptz,timestamptz,timestamptz,boolean,integer,integer)','EXECUTE'), 'runtime cannot attest';
  assert has_function_privilege('pocket_checkout_verifier','public.attest_pocket_checkout_baseline(uuid,uuid,text,text,boolean,text,text,text,timestamptz,timestamptz,timestamptz,boolean,integer,integer)','EXECUTE'), 'separate verifier authority required';
  assert not pg_has_role('service_role','pocket_checkout_verifier','MEMBER'), 'authority separation required';
  a:=public.qa_prepare_checkout('11111111-1111-4111-8111-111111111111','cus_QA1','one@example.test');
  assert a->>'reason'='BASELINE_REQUIRED','no row is not a legacy-session clearance';
  b:=public.qa_prepare_checkout('11111111-1111-4111-8111-111111111111','cus_QA1','one@example.test');
  assert a->>'intent_id'=b->>'intent_id','parallel preparation must reuse one UUID intent';
  assert (select count(*) from private.pocket_checkout_intents)=1;
  b:=public.qa_prepare_checkout('33333333-3333-4333-8333-333333333333','cus_QA1','three@example.test');
  assert b->>'reason'='VERIFIED_BOUND_IDENTITY_REQUIRED','customer cannot be shared/transferred by caller';
  b:=public.qa_prepare_checkout('11111111-1111-4111-8111-111111111111','cus_QA1','wrong@example.test');
  assert b->>'reason'='VERIFIED_BOUND_IDENTITY_REQUIRED';
  i:=(a->>'intent_id')::uuid;
  begin
    perform public.attest_pocket_checkout_baseline(i,'11111111-1111-4111-8111-111111111111','cus_QA1','acct_OTHER',false,repeat('a',40),repeat('1',64),repeat('f',64),now(),now(),now(),true,0,0);
    raise exception 'bad account proof accepted';
  exception when raise_exception then assert sqlerrm='checkout_baseline_scope_invalid'; end;
  perform public.attest_pocket_checkout_baseline(i,'11111111-1111-4111-8111-111111111111','cus_QA1','acct_QA',false,repeat('a',40),repeat('1',64),repeat('f',64),
    clock_timestamp()-interval '3 seconds',clock_timestamp()-interval '2 seconds',clock_timestamp()-interval '1 second',true,0,0);
  a:=public.qa_prepare_checkout('11111111-1111-4111-8111-111111111111','cus_QA1','one@example.test');
  assert a->>'kind'='PREPARED';
  assert a->>'parameters_sha256'=encode(sha256(convert_to(a->>'parameters_text','UTF8')),'hex'),'hash exact text, not JS reserialization';
  assert a->>'idempotency_key'='pocket-checkout:'||i::text;
  assert (a->>'parameters_text')::jsonb->'metadata'->>'pocket_checkout_intent_id'=i::text;
  b:=public.prepare_pocket_checkout_intent('11111111-1111-4111-8111-111111111111','one@example.test','cus_QA1','price_QA',repeat('b',40),'acct_QA',false,'pocket_founding_650',public.qa_checkout_seed('11111111-1111-4111-8111-111111111111','cus_QA1'));
  assert b->>'reason'='IMMUTABLE_SCOPE_CONFLICT';
  b:=public.qa_claim_checkout('11111111-1111-4111-8111-111111111111');
  assert b->>'kind'='DISPATCH' and b->>'dispatch_token' is not null;
  c:=public.qa_claim_checkout('11111111-1111-4111-8111-111111111111');
  assert c->>'kind'='HOLD' and not(c ? 'dispatch_token'), 'old token must never be returned';
  update private.pocket_checkout_intents set dispatched_at=now()-interval '48 hours' where intent_id=i;
  c:=public.qa_claim_checkout('11111111-1111-4111-8111-111111111111');
  assert c->>'kind'='HOLD','24h pruning never grants a new dispatch';
  s:=jsonb_build_object('id','cs_test_QA','customer','cus_QA1','mode','subscription','status','open','livemode',false,
    'client_reference_id','11111111-1111-4111-8111-111111111111','expires_at',((b->>'parameters_text')::jsonb)->'expires_at',
    'url','https://checkout.stripe.com/c/pay/cs_test_QA','metadata',((b->>'parameters_text')::jsonb)->'metadata');
  begin
    perform public.record_pocket_checkout_session('11111111-1111-4111-8111-111111111111',i,gen_random_uuid(),b->>'parameters_sha256',s);
    raise exception 'wrong claim accepted';
  exception when raise_exception then assert sqlerrm='checkout_result_scope_invalid'; end;
  c:=public.record_pocket_checkout_session('11111111-1111-4111-8111-111111111111',i,(b->>'dispatch_token')::uuid,b->>'parameters_sha256',s);
  assert c->>'kind'='READY';
  assert (public.qa_prepare_checkout('11111111-1111-4111-8111-111111111111','cus_QA1','one@example.test'))->>'kind'='READY';
  assert (public.qa_claim_checkout('11111111-1111-4111-8111-111111111111'))->>'kind'='HOLD','READY cannot dispatch again';
  update private.pocket_checkout_intents set expires_at=extract(epoch from now()-interval '1 hour') where intent_id=i;
  assert (public.qa_prepare_checkout('11111111-1111-4111-8111-111111111111','cus_QA1','one@example.test'))->>'reason'='SESSION_RECONCILIATION_REQUIRED','expiry never releases UUID';

  a:=public.qa_prepare_checkout('22222222-2222-4222-8222-222222222222','cus_QA2','two@example.test'); i:=(a->>'intent_id')::uuid;
  begin
    perform public.attest_pocket_checkout_baseline(i,'22222222-2222-4222-8222-222222222222','cus_QA2','acct_QA',false,repeat('a',40),repeat('1',64),repeat('f',64),
      clock_timestamp()-interval '3 seconds',clock_timestamp()-interval '2 seconds',clock_timestamp()-interval '1 second',true,0,0);
    raise exception 'baseline replay accepted'; exception when unique_violation then null; end;
  assert (select state from private.pocket_checkout_intents where intent_id=i)='BASELINE_REQUIRED';
  begin
    perform public.attest_pocket_checkout_baseline(i,'22222222-2222-4222-8222-222222222222','cus_QA2','acct_QA',false,repeat('a',40),repeat('2',64),repeat('f',64),
      clock_timestamp()-interval '3 minutes',clock_timestamp()-interval '2 minutes',clock_timestamp()-interval '1 minute',true,0,0);
    raise exception 'stale baseline accepted'; exception when raise_exception then assert sqlerrm='checkout_baseline_proof_invalid'; end;
  i:=public.qa_ready_checkout('22222222-2222-4222-8222-222222222222','cus_QA2','two@example.test',repeat('2',64));
  insert into private.pocket_web_subscriptions values('sub_QA','22222222-2222-4222-8222-222222222222','two@example.test','cus_QA2',true,now()+interval '1 hour');
  assert (public.qa_claim_checkout('22222222-2222-4222-8222-222222222222'))->>'reason'='ACTIVE_SUBSCRIPTION';
  assert (select dispatch_count from private.pocket_checkout_intents where intent_id=i)=0;
end $$;

-- Real role transitions in a synthetic session, including BYPASSRLS runtime.
set local role anon;
do $$ begin begin
  perform public.qa_prepare_checkout('11111111-1111-4111-8111-111111111111','cus_QA1','one@example.test');
  raise exception 'anon execute unexpectedly allowed';
exception when insufficient_privilege then null; end; end $$;
reset role;

-- Actual execution under the separate synthetic verifier, followed by runtime.
do $$ declare a jsonb; begin
  a:=public.qa_prepare_checkout('44444444-4444-4444-8444-444444444444','cus_QA4','four@example.test');
  perform set_config('qa.checkout_intent',(a->>'intent_id'),true);
end $$;
set local role pocket_checkout_verifier;
select public.attest_pocket_checkout_baseline(current_setting('qa.checkout_intent')::uuid,'44444444-4444-4444-8444-444444444444','cus_QA4','acct_QA',false,repeat('a',40),repeat('4',64),repeat('f',64),
  clock_timestamp()-interval '3 seconds',clock_timestamp()-interval '2 seconds',clock_timestamp()-interval '1 second',true,0,0);
reset role;
do $$ declare a jsonb; begin
  a:=public.qa_prepare_checkout('44444444-4444-4444-8444-444444444444','cus_QA4','four@example.test');
  perform set_config('qa.checkout_hash',a->>'parameters_sha256',true);
end $$;
set local role service_role;
do $$ declare a jsonb; begin
  a:=public.claim_pocket_checkout_intent('44444444-4444-4444-8444-444444444444',current_setting('qa.checkout_intent')::uuid,current_setting('qa.checkout_hash'),'cus_QA4',repeat('a',40),'acct_QA',false);
  assert a->>'kind'='DISPATCH','service role may consume exactly one separately attested permit';
  a:=public.claim_pocket_checkout_intent('44444444-4444-4444-8444-444444444444',current_setting('qa.checkout_intent')::uuid,current_setting('qa.checkout_hash'),'cus_QA4',repeat('a',40),'acct_QA',false);
  assert a->>'kind'='HOLD' and not(a ? 'dispatch_token');
end $$;
reset role;
set local role service_role;
do $$ begin
  begin perform public.attest_pocket_checkout_baseline(gen_random_uuid(),'11111111-1111-4111-8111-111111111111','cus_QA1','acct_QA',false,repeat('a',40),repeat('3',64),repeat('f',64),now(),now(),now(),true,0,0);
    raise exception 'runtime attestation unexpectedly allowed'; exception when insufficient_privilege then null; end;
  begin insert into private.pocket_checkout_baselines values(gen_random_uuid(),repeat('a',64),repeat('b',64),now(),now(),now(),now());
    raise exception 'runtime direct write unexpectedly allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
