-- Execute inside a disposable transaction after applying the migration.
do $$
begin
 perform public.sync_pocket_web_subscription('qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_entitlement',true,now()+interval '1 day',100);
 if not public.has_pocket_web_subscription('QA-ENTITLEMENT@EXAMPLE.INVALID') then raise exception 'active entitlement denied'; end if;
 perform public.revoke_pocket_web_subscription('sub_qa_entitlement',101);
 if public.has_pocket_web_subscription('qa-entitlement@example.invalid') then raise exception 'revoked access allowed'; end if;
 perform public.sync_pocket_web_subscription('qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_entitlement',true,now()+interval '1 day',100);
 if public.has_pocket_web_subscription('qa-entitlement@example.invalid') then raise exception 'stale activation allowed'; end if;
 perform public.sync_pocket_web_subscription('qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_entitlement',true,now()+interval '1 day',101);
 if public.has_pocket_web_subscription('qa-entitlement@example.invalid') then raise exception 'equal-time activation overrides revocation'; end if;
 perform public.sync_pocket_web_subscription('qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_entitlement',true,now()+interval '1 day',102);
 if not public.has_pocket_web_subscription('qa-entitlement@example.invalid') then raise exception 'later paid activation denied'; end if;
 -- A forfeited founding award does not prevent a later valid paid subscription.
 perform public.sync_pocket_web_subscription('qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_entitlement',false,now()+interval '1 day',103);
 perform public.sync_pocket_web_subscription('qa-entitlement@example.invalid','cus_qa_entitlement','sub_qa_entitlement',true,now()+interval '1 day',104);
 if not public.has_pocket_web_subscription('qa-entitlement@example.invalid') then raise exception 'forfeited award incorrectly blocks current subscription'; end if;
 if public.has_pocket_web_subscription('other@example.invalid') then raise exception 'other email access allowed'; end if;
 perform public.sync_pocket_web_subscription('qa-expired@example.invalid','cus_qa_expired','sub_qa_expired',true,now()-interval '1 second',100);
 if public.has_pocket_web_subscription('qa-expired@example.invalid') then raise exception 'expired access allowed'; end if;
 perform public.revoke_pocket_web_subscription('sub_qa_tombstone',200);
 perform public.sync_pocket_web_subscription('qa-tombstone@example.invalid','cus_qa_tombstone','sub_qa_tombstone',true,now()+interval '1 day',199);
 if public.has_pocket_web_subscription('qa-tombstone@example.invalid') then raise exception 'tombstone bypassed'; end if;
 if exists(select 1 from public.pocket_founding_members where stripe_subscription_id='sub_qa_tombstone') then raise exception 'stale event awarded founding place'; end if;
 if exists(select 1 from public.pocket_founding_members where stripe_subscription_id='sub_qa_entitlement' and status<>'forfeited') then raise exception 'forfeited guarantee regained'; end if;
 if has_function_privilege('anon','public.has_pocket_web_subscription(text)','execute') or has_function_privilege('authenticated','public.sync_pocket_web_subscription(text,text,text,boolean,timestamptz,bigint)','execute') then raise exception 'public entitlement RPC permission'; end if;
 if has_table_privilege('service_role','private.pocket_web_subscriptions','select') or has_table_privilege('authenticated','private.pocket_web_subscriptions','insert') then raise exception 'direct table access'; end if;
end $$;
