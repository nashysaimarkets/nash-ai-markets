-- Pure database retention; no HTTP/provider calls or allowance activation.
-- Replay expires at 24h; hourly erasure bounds cached facts to at most 25h
-- while the scheduler is healthy. Keep identity/admission tombstones intact.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
create index pocket_first_free_cache_expiry_idx on private.pocket_first_free_requests(completed_at) where response_body is not null;
create function private.purge_pocket_first_free_cache()
returns integer language plpgsql security definer set search_path='' as $$
declare erased integer;
begin
 update private.pocket_first_free_requests set response_body=null
 where response_body is not null and completed_at<=now()-interval '24 hours';
 get diagnostics erased = row_count;
 return erased;
end $$;
revoke all on function private.purge_pocket_first_free_cache() from public,anon,authenticated,service_role;
-- The cron job executes as the migration owner, not as a customer/service JWT.
select private.purge_pocket_first_free_cache();
select cron.schedule('pocket-first-free-cache-retention','17 * * * *','select private.purge_pocket_first_free_cache();');
