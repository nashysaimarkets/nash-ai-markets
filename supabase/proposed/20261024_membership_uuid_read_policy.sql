-- REVIEW-ONLY PROPOSAL. Not in migration discovery. Never apply to shared-live
-- until every existing membership UUID has independent ownership evidence,
-- all legacy/null bindings are resolved, and exact cutover/rollback is approved.
-- No backfill, payment, customer change or ownership inference is performed.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '10s';
do $$
declare p record; fingerprint text;
begin
 if current_setting('monaco.membership_uuid_reviewed',true) is distinct from 'true' then
  raise exception 'membership_identity_review_required';
 end if;
 -- Prevent a writer introducing an unbound row between audit and policy swap.
 lock table public.memberships in share row exclusive mode;
 if not exists(select 1 from pg_attribute where attrelid='public.memberships'::regclass and attname='user_id' and atttypid='uuid'::regtype and not attisdropped) then
  raise exception 'membership_uuid_schema_required';
 end if;
 if exists(select 1 from public.memberships where user_id is null) then
  raise exception 'membership_unbound_legacy_rows_hold';
 end if;
 if exists(select 1 from pg_policies where schemaname='public' and tablename='memberships' and cmd='ALL') then
  raise exception 'membership_combined_policy_review_required';
 end if;
 select md5(string_agg(policyname||'|'||permissive||'|'||array_to_string(roles,',')||'|'||cmd||'|'||coalesce(qual,'')||'|'||coalesce(with_check,''), E'\n' order by policyname)) into fingerprint
 from pg_policies where schemaname='public' and tablename='memberships' and cmd='SELECT';
 if fingerprint is null or fingerprint not in ('63210f35e33efac3adaccc19e0eedd3f','8711aa84e29a49566338f11a230ed33b') then
  raise exception 'membership_select_policy_drift_review_required';
 end if;
 -- Permissive policies OR together: adding a UUID policy alone is insufficient.
 for p in select policyname from pg_policies where schemaname='public' and tablename='memberships' and cmd='SELECT' loop
  execute format('drop policy %I on public.memberships',p.policyname);
 end loop;
end $$;
create policy "Members read independently bound UUID" on public.memberships
 for select to authenticated using (user_id = (select auth.uid()));
commit;
