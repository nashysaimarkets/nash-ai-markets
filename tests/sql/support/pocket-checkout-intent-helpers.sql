-- Disposable-test orchestration only; apply after proposed DDL, never hosted.
create function public.qa_prepare_checkout(p_user_id uuid,p_customer_id text,p_email text) returns jsonb language sql as $$
  select public.prepare_pocket_checkout_intent(p_user_id,p_email,p_customer_id,'price_QA',repeat('a',40),'acct_QA',false,'pocket_founding_650',public.qa_checkout_seed(p_user_id,p_customer_id))
$$;
create function public.qa_ready_checkout(p_user_id uuid,p_customer_id text,p_email text,p_receipt text) returns uuid language plpgsql as $$
declare result jsonb; intent uuid;
begin
  result:=public.qa_prepare_checkout(p_user_id,p_customer_id,p_email); intent:=(result->>'intent_id')::uuid;
  perform public.attest_pocket_checkout_baseline(intent,p_user_id,p_customer_id,'acct_QA',false,repeat('a',40),p_receipt,repeat('f',64),
    clock_timestamp()-interval '3 seconds',clock_timestamp()-interval '2 seconds',clock_timestamp()-interval '1 second',true,0,0);
  return intent;
end $$;
create function public.qa_claim_checkout(p_user_id uuid) returns jsonb language sql as $$
  select public.claim_pocket_checkout_intent(p_user_id,i.intent_id,i.parameters_sha256,i.stripe_customer_id,i.candidate_sha,i.stripe_account_id,i.livemode)
    from private.pocket_checkout_intents i where i.app_user_id=p_user_id
$$;
