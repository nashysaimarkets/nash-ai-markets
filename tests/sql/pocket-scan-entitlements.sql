-- Execute inside a disposable transaction after applying the identity-binding migration.
do $$
declare
  u1 uuid := '51b94c3f-2213-48d5-87a8-c66cfa554101';
  u2 uuid := '51b94c3f-2213-48d5-87a8-c66cfa554102';
  failed boolean;
begin
 if exists(select 1 from auth.users where id in (u1,u2)) then raise exception 'fixture_uuid_collision'; end if;
 -- Staging Auth has a UNIQUE partial email index for non-SSO accounts.
 -- Use different emails for simultaneous users; test sequential same-email
 -- recreation separately rather than constructing impossible Auth fixtures.
 insert into auth.users(id,email,email_confirmed_at,is_anonymous) values
   (u1,'qa-entitlement@example.invalid',now(),false),
   (u2,'qa-other-entitlement@example.invalid',now(),false);

 perform public.sync_pocket_web_subscription(u1,'qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_entitlement',true,now()+interval '1 day',100);
 assert public.has_pocket_web_subscription(u1),'linked application UUID denied';
 assert not public.has_pocket_web_subscription(u2),'different application UUID accepted';
 assert public.get_pocket_web_customer(u1,'qa-entitlement@example.invalid')='cus_qa_entitlement','checkout lost bound customer';
 assert public.get_pocket_web_customer(u2,'qa-other-entitlement@example.invalid') is null,'unbound UUID inherited customer';

 -- Simulate a later account using the SAME email while preserving its
 -- DIFFERENT UUID. The old identity remains bound to its Stripe customer.
 update auth.users set email='qa-retired-entitlement@example.invalid' where id=u1;
 update auth.users set email='qa-entitlement@example.invalid' where id=u2;
 assert not public.has_pocket_web_subscription(u1),'old identity accessed subscription after email change';
 assert not public.has_pocket_web_subscription(u2),'recreated same-email identity inherited paid access';
 assert public.get_pocket_web_customer(u2,'qa-entitlement@example.invalid') is null,'recreated same-email checkout inherited customer';
 failed:=false;
 begin
   perform public.sync_pocket_web_subscription(u2,'qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_recreated',true,now()+interval '1 day',101);
 exception when others then failed:=true; end;
 assert failed,'recreated same-email identity reassigned the original Stripe customer';
 update auth.users set email='qa-other-entitlement@example.invalid' where id=u2;
 update auth.users set email='qa-entitlement@example.invalid' where id=u1;
 assert public.has_pocket_web_subscription(u1),'restored original identity denied';

 failed:=false;
 begin
   perform public.sync_pocket_web_subscription(u2,'qa-other-entitlement@example.invalid','cus_qa_entitlement','sub_qa_other',true,now()+interval '1 day',101);
 exception when others then failed:=true; end;
 assert failed,'Stripe customer transferred to another application UUID';
 failed:=false;
 begin
   perform public.sync_pocket_web_subscription(u1,'qa-entitlement@example.invalid','cus_qa_other','sub_qa_other',true,now()+interval '1 day',101);
 exception when others then failed:=true; end;
 assert failed,'application UUID accepted a second Stripe customer';

 -- A deployed old webhook may renew only the existing exact durable identity.
 perform public.sync_pocket_web_subscription('qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_entitlement',true,now()+interval '2 days',101);
 assert public.has_pocket_web_subscription(u1),'compatible old renewal lost UUID access';
 failed:=false;
 begin
   perform public.sync_pocket_web_subscription('qa-entitlement@example.invalid','cus_wrong','sub_qa_entitlement',true,now()+interval '2 days',102);
 exception when others then failed:=true; end;
 assert failed,'legacy producer changed bound Stripe customer';
 perform public.sync_pocket_web_subscription('qa-other-entitlement@example.invalid','cus_unbound','sub_qa_unbound',true,now()+interval '1 day',100);
 assert not public.has_pocket_web_subscription(u2),'legacy email event granted UUID access';
 assert not public.has_pocket_web_subscription('qa-other-entitlement@example.invalid'::text),'legacy lookup granted email access';
 assert exists(select 1 from private.pocket_web_subscriptions where stripe_subscription_id='sub_qa_unbound' and app_user_id is null and stripe_customer_id is null),'legacy producer inferred identity';
 perform public.revoke_pocket_web_subscription('sub_qa_unbound',102);
 perform public.sync_pocket_web_subscription('qa-other-entitlement@example.invalid','cus_unbound','sub_qa_unbound',true,now()+interval '1 day',101);
 assert not exists(select 1 from private.pocket_web_subscriptions where stripe_subscription_id='sub_qa_unbound' and active),'legacy stale renewal undid revocation';
 perform public.revoke_pocket_web_subscription('sub_qa_entitlement',101);
 assert not public.has_pocket_web_subscription(u1),'revoked access allowed';
 assert public.get_pocket_web_customer(u1,'qa-entitlement@example.invalid')='cus_qa_entitlement','resubscribe lost permanent customer binding';
 perform public.sync_pocket_web_subscription(u1,'qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_entitlement',true,now()+interval '1 day',100);
 assert not public.has_pocket_web_subscription(u1),'stale activation allowed';
 perform public.sync_pocket_web_subscription(u1,'qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_entitlement',true,now()+interval '1 day',101);
 assert not public.has_pocket_web_subscription(u1),'equal-time activation overrides revocation';
 perform public.sync_pocket_web_subscription(u1,'qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_entitlement',true,now()+interval '1 day',102);
 assert public.has_pocket_web_subscription(u1),'later paid activation denied';

 -- Historical email-only records stay denied until exact evidence-backed linking.
 insert into private.pocket_web_subscriptions(stripe_subscription_id,email,active,current_period_end,last_event_created_at)
 values('sub_qa_legacy','qa-entitlement@example.invalid',true,now()+interval '1 day',200);
 assert not exists(select 1 from private.pocket_web_subscriptions where stripe_subscription_id='sub_qa_legacy' and app_user_id is not null);
 failed:=false;
 begin
   perform public.link_pocket_web_subscription_identity(u1,'wrong@example.invalid','cus_qa_entitlement','sub_qa_legacy','qa:receipt:legacy');
 exception when others then failed:=true; end;
 assert failed,'legacy link accepted mismatched email';
 update auth.users set banned_until=now()+interval '1 day' where id=u1;
 failed:=false;
 begin
   perform public.link_pocket_web_subscription_identity(u1,'qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_legacy','qa:receipt:legacy');
 exception when others then failed:=true; end;
 assert failed,'banned user could link historical subscription';
 update auth.users set banned_until=null where id=u1;
 perform public.link_pocket_web_subscription_identity(u1,'qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_legacy','qa:receipt:legacy');
 assert exists(select 1 from private.pocket_web_subscriptions where stripe_subscription_id='sub_qa_legacy'
   and app_user_id=u1 and stripe_customer_id='cus_qa_entitlement' and identity_evidence_ref='qa:receipt:legacy');

 update auth.users set email_confirmed_at=null where id=u1;
 assert not public.has_pocket_web_subscription(u1),'unverified application identity retained access';
 failed:=false;
 begin perform public.get_pocket_web_customer(u1,'qa-entitlement@example.invalid');
 exception when others then failed:=true; end;
 assert failed,'unverified user could resolve checkout customer';
 update auth.users set email_confirmed_at=now(),email='changed@example.invalid' where id=u1;
 assert not public.has_pocket_web_subscription(u1),'changed application email retained access';

 assert to_regprocedure('public.has_pocket_web_subscription(text)') is not null,'legacy signature was removed';
 assert not public.has_pocket_web_subscription('qa-entitlement@example.invalid'::text),'email-only lookup granted access';
 assert not has_function_privilege('anon','public.has_pocket_web_subscription(text)','execute');
 assert not has_function_privilege('anon','public.has_pocket_web_subscription(uuid)','execute');
 assert not has_function_privilege('authenticated','public.sync_pocket_web_subscription(uuid,text,text,text,boolean,timestamptz,bigint)','execute');
 assert has_function_privilege('service_role','public.link_pocket_web_subscription_identity(uuid,text,text,text,text)','execute');
 assert not has_table_privilege('service_role','private.pocket_web_subscriptions','select');
 assert not has_table_privilege('service_role','private.pocket_web_identities','select');
 assert not has_function_privilege('anon','public.get_pocket_web_customer(uuid,text)','execute');
 assert not has_function_privilege('authenticated','public.get_pocket_web_customer(uuid,text)','execute');
 assert has_function_privilege('service_role','public.get_pocket_web_customer(uuid,text)','execute');
end $$;
select 'pocket_subscription_identity_sql_pass' as result;
