create or replace function public.save_member_onboarding(
  p_experience text,
  p_interests text[],
  p_notifications text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_experience not in ('new', 'developing', 'experienced')
    or p_notifications not in ('essential', 'brief-and-essential', 'none')
    or cardinality(p_interests) not between 1 and 4
    or exists (
      select 1
      from unnest(p_interests) as interest
      where interest not in ('futures', 'equities', 'macro', 'volatility')
    )
  then
    raise exception 'Invalid onboarding preferences' using errcode = '22023';
  end if;

  insert into public.member_onboarding (
    user_id,
    experience,
    interests,
    notifications,
    completed_at,
    updated_at
  )
  values (
    v_user_id,
    p_experience,
    p_interests,
    p_notifications,
    now(),
    now()
  )
  on conflict (user_id) do update set
    experience = excluded.experience,
    interests = excluded.interests,
    notifications = excluded.notifications,
    completed_at = excluded.completed_at,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.save_member_onboarding(text, text[], text) from public;
grant execute on function public.save_member_onboarding(text, text[], text) to authenticated;
