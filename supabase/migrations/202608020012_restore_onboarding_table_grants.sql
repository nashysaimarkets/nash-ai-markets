-- save_member_onboarding now runs as the signed-in caller, so grant only the
-- table operations its RLS-protected upsert and the preferences page require.
revoke all on table public.member_onboarding from anon, authenticated;
grant select, insert, update on table public.member_onboarding to authenticated;
