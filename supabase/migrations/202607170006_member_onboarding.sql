create table if not exists public.member_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  experience text not null check (experience in ('new', 'developing', 'experienced')),
  interests text[] not null check (cardinality(interests) between 1 and 4),
  notifications text not null check (notifications in ('essential', 'brief-and-essential', 'none')),
  completed_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.member_onboarding enable row level security;
drop policy if exists "members manage own onboarding" on public.member_onboarding;
create policy "members manage own onboarding" on public.member_onboarding
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
