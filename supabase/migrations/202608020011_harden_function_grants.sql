-- Supabase default privileges can grant API roles EXECUTE when functions are
-- created. Make the intended boundary explicit after the canonical chain.

alter function public.save_member_onboarding(text, text[], text)
  security invoker;
revoke all on function public.save_member_onboarding(text, text[], text)
  from public, anon, authenticated, service_role;
grant execute on function public.save_member_onboarding(text, text[], text)
  to authenticated;

revoke all on function public.sync_founding_100(text, text, text, boolean, bigint)
  from public, anon, authenticated, service_role;
grant execute on function public.sync_founding_100(text, text, text, boolean, bigint)
  to service_role;

revoke all on function public.sync_membership_from_stripe(
  text, text, text, text, text, timestamptz, text, integer, bigint
)
  from public, anon, authenticated, service_role;
grant execute on function public.sync_membership_from_stripe(
  text, text, text, text, text, timestamptz, text, integer, bigint
)
  to service_role;
