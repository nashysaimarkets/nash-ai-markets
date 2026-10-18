-- ONE-TIME OWNER REPAIR TEMPLATE. Run only in an explicitly approved transaction
-- after server-verified Pocket UUID + independent live Stripe ownership proof.
-- Caller supplies transaction-local pocket_repair.* settings; no defaults,
-- email-based UUID selection, Stripe mutation, or founding-table write occurs.
do $$
declare
 uid uuid := nullif(current_setting('pocket_repair.user_id',true),'')::uuid;
 verified_email text := lower(trim(current_setting('pocket_repair.verified_email',true)));
 customer text := current_setting('pocket_repair.stripe_customer',true);
 subscription text := current_setting('pocket_repair.stripe_subscription',true);
 paid_end timestamptz := nullif(current_setting('pocket_repair.paid_through',true),'')::timestamptz;
 event_time bigint := nullif(current_setting('pocket_repair.stripe_event_created',true),'')::bigint;
 evidence text := current_setting('pocket_repair.evidence_ref',true);
 existing private.pocket_web_subscriptions%rowtype;
begin
 if uid is null or coalesce(length(verified_email),0) not between 3 and 254
   or coalesce(customer,'') !~ '^cus_[A-Za-z0-9]+$'
   or coalesce(subscription,'') !~ '^sub_[A-Za-z0-9]+$'
   or paid_end is null or paid_end<=now() or event_time is null or event_time<=0
   or event_time>extract(epoch from now())
   or coalesce(evidence,'') !~ '^owner-approved:stripe-checkout:cs_[A-Za-z0-9_]+;pocket-session:[A-Za-z0-9:_-]+$'
   or length(evidence)>500 then raise exception 'pocket_repair_verified_evidence_required'; end if;
 if not exists(select 1 from auth.users where id=uid and lower(trim(auth.users.email))=verified_email
   and email_confirmed_at is not null and not coalesce(is_anonymous,false)
   and (banned_until is null or banned_until<=now())) then raise exception 'pocket_repair_verified_uuid_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(subscription,0));
 -- A concurrent real webhook's current state always wins over this snapshot.
 insert into private.pocket_web_subscriptions(stripe_subscription_id,email,active,current_period_end,last_event_created_at)
 values(subscription,verified_email,true,paid_end,event_time) on conflict(stripe_subscription_id) do nothing;
 select * into strict existing from private.pocket_web_subscriptions where stripe_subscription_id=subscription for update;
 if not existing.active or existing.email<>verified_email or existing.current_period_end is distinct from paid_end
   or existing.last_event_created_at<event_time
   or (existing.app_user_id is not null and existing.app_user_id<>uid)
   or (existing.stripe_customer_id is not null and existing.stripe_customer_id<>customer)
 then raise exception 'pocket_repair_snapshot_or_identity_conflict'; end if;
 perform public.link_pocket_web_subscription_identity(uid,verified_email,customer,subscription,evidence);
 if not public.has_pocket_web_subscription(uid) then raise exception 'pocket_repair_access_not_verified'; end if;
end $$;
