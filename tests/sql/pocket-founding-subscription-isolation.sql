begin;

do $$
declare
  active_result record;
  canceled_result record;
  fixture_email text := 'pocket-isolation-20261013@example.invalid';
  active_subscription text := 'sub_qa_pocket_isolation_active';
  canceled_subscription text := 'sub_qa_pocket_isolation_canceled';
begin
  delete from public.pocket_founding_members
  where email = fixture_email
     or stripe_subscription_id in (active_subscription, canceled_subscription);

  select * into active_result
  from public.sync_pocket_founding_650(
    fixture_email, 'cus_qa_pocket_isolation', active_subscription,
    true, now() + interval '1 month', 100
  );
  assert active_result.outcome = 'awarded', 'active fixture should be awarded';

  select * into canceled_result
  from public.sync_pocket_founding_650(
    fixture_email, 'cus_qa_pocket_isolation', canceled_subscription,
    false, now(), 200
  );
  assert canceled_result.outcome = 'unrelated_cancellation_ignored',
    'unrelated cancellation must be ignored';

  assert exists (
    select 1 from public.pocket_founding_members
    where email = fixture_email
      and stripe_subscription_id = active_subscription
      and status = 'active'
      and price_lock_active
      and last_event_created_at = 100
  ), 'unrelated cancellation changed the active subscription';
end;
$$;

rollback;
