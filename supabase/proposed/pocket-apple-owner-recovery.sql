-- NOT INSTALLED. Requires the reviewed pocket_apple_ownership_events migration.
-- Read-only access to already-evidenced mappings; creates no owner or entitlement.
begin;
create function public.get_pocket_apple_owned_transactions(p_environment text,p_user_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(x.original_transaction_id),'[]'::jsonb) from (
  select original_transaction_id from private.pocket_apple_legacy_owners
  where environment=p_environment and user_id=p_user_id and not revoked
    and p_environment in ('Production','Sandbox')
  order by original_transaction_id limit 6
 ) x
$$;
-- Six results intentionally fail the runtime's five-record bound, never silently
-- omit an ambiguous account. Browser roles must never enumerate transaction IDs.
revoke all on function public.get_pocket_apple_owned_transactions(text,uuid) from public,anon,authenticated;
grant execute on function public.get_pocket_apple_owned_transactions(text,uuid) to service_role;
commit;
