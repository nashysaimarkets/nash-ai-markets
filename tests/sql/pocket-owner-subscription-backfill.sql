-- Wrapper supplies pg_temp.apply_pocket_owner_backfill from the exact repair template.
do $$
declare
 u1 uuid := '51b94c3f-2213-48d5-87a8-c66cfa554201';
 u2 uuid := '51b94c3f-2213-48d5-87a8-c66cfa554202';
 failed boolean;
begin
 if exists(select 1 from auth.users where id in(u1,u2)) then raise exception 'fixture_uuid_collision'; end if;
 insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
 (u1,'qa-owner-backfill@example.invalid',now(),false),
 (u2,'qa-owner-other@example.invalid',now(),false);
 perform set_config('pocket_repair.user_id',u1::text,true);
 perform set_config('pocket_repair.verified_email','qa-owner-backfill@example.invalid',true);
 perform set_config('pocket_repair.stripe_customer','cus_backfillqa',true);
 perform set_config('pocket_repair.stripe_subscription','sub_backfillqa',true);
 perform set_config('pocket_repair.paid_through',(now()+interval '1 day')::text,true);
 perform set_config('pocket_repair.stripe_event_created','100',true);
 perform set_config('pocket_repair.evidence_ref','',true);
 failed:=false;
 begin perform pg_temp.apply_pocket_owner_backfill(); exception when others then failed:=true; end;
 assert failed,'repair accepted absent session/Checkout evidence';
 assert not exists(select 1 from private.pocket_web_subscriptions where stripe_subscription_id='sub_backfillqa'),'failed evidence left a row';
 perform set_config('pocket_repair.evidence_ref','owner-approved:stripe-checkout:cs_test_backfill;pocket-session:qa-verified-session',true);
 perform pg_temp.apply_pocket_owner_backfill();
 assert public.has_pocket_web_subscription(u1),'verified owner access denied';
 assert not public.has_pocket_web_subscription(u2),'unrelated UUID granted access';
 assert not public.has_pocket_web_subscription('qa-owner-backfill@example.invalid'::text),'email lookup granted access';
 perform pg_temp.apply_pocket_owner_backfill();
 assert (select count(*) from private.pocket_web_subscriptions where stripe_subscription_id='sub_backfillqa')=1,'repeat repair duplicated subscription';
 assert not exists(select 1 from public.pocket_founding_members where stripe_subscription_id='sub_backfillqa'),'repair wrote founding records';
 perform set_config('pocket_repair.stripe_customer','cus_wrong',true);
 failed:=false;
 begin perform pg_temp.apply_pocket_owner_backfill(); exception when others then failed:=true; end;
 assert failed,'repair transferred Stripe customer';
 perform set_config('pocket_repair.stripe_customer','cus_backfillqa',true);
 update auth.users set email='qa-owner-retired@example.invalid' where id=u1;
 update auth.users set email='qa-owner-backfill@example.invalid' where id=u2;
 perform set_config('pocket_repair.user_id',u2::text,true);
 failed:=false;
 begin perform pg_temp.apply_pocket_owner_backfill(); exception when others then failed:=true; end;
 assert failed,'same-email replacement inherited original purchase';
 assert not public.has_pocket_web_subscription(u2),'replacement UUID granted access';
 update auth.users set email='qa-owner-other@example.invalid' where id=u2;
 update auth.users set email='qa-owner-backfill@example.invalid' where id=u1;
 perform set_config('pocket_repair.user_id',u1::text,true);
 perform public.revoke_pocket_web_subscription('sub_backfillqa',101);
 failed:=false;
 begin perform pg_temp.apply_pocket_owner_backfill(); exception when others then failed:=true; end;
 assert failed,'repair overwrote cancellation tombstone';
 assert not public.has_pocket_web_subscription(u1),'cancelled purchase reactivated';
end $$;
select 'owner_backfill_exact_template_pass' as result;
