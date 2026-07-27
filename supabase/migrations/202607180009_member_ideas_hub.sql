create extension if not exists pgcrypto;

create table if not exists public.member_ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 2 and 60),
  founding_number integer check (founding_number between 1 and 100),
  title text not null check (char_length(title) between 5 and 120),
  description text not null check (char_length(description) between 20 and 2000),
  category text not null check (category in ('Mission Control','Market intelligence','Options','Risk management','Trading journal','Account and membership','Mobile experience','Other')),
  status text not null default 'under_review' check (status in ('under_review','planned','in_development','released','declined')),
  is_shortlisted boolean not null default false,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.member_idea_votes (
  idea_id uuid not null references public.member_ideas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id,user_id)
);
create table if not exists public.member_idea_comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.member_ideas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 2 and 60),
  body text not null check (char_length(body) between 2 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.member_monthly_votes (
  month_key text not null check (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  idea_id uuid not null references public.member_ideas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (month_key,user_id)
);
create index if not exists member_ideas_created_idx on public.member_ideas(created_at desc);
create index if not exists member_ideas_status_category_idx on public.member_ideas(status,category);
create index if not exists member_idea_votes_idea_idx on public.member_idea_votes(idea_id);
create index if not exists member_idea_comments_idea_idx on public.member_idea_comments(idea_id,created_at);
create index if not exists member_monthly_votes_idea_idx on public.member_monthly_votes(month_key,idea_id);

alter table public.member_ideas enable row level security;
alter table public.member_idea_votes enable row level security;
alter table public.member_idea_comments enable row level security;
alter table public.member_monthly_votes enable row level security;
create policy "members read ideas" on public.member_ideas for select to authenticated using (true);
create policy "members create own ideas" on public.member_ideas for insert to authenticated with check (user_id=auth.uid() and status='under_review' and is_shortlisted=false and released_at is null);
create policy "members edit eligible own ideas" on public.member_ideas for update to authenticated using (user_id=auth.uid() and status='under_review') with check (user_id=auth.uid() and status='under_review' and is_shortlisted=false and released_at is null);
create policy "members delete eligible own ideas" on public.member_ideas for delete to authenticated using (user_id=auth.uid() and status='under_review');
create policy "members read votes" on public.member_idea_votes for select to authenticated using (true);
create policy "members cast own vote" on public.member_idea_votes for insert to authenticated with check (user_id=auth.uid());
create policy "members remove own vote" on public.member_idea_votes for delete to authenticated using (user_id=auth.uid());
create policy "members read comments" on public.member_idea_comments for select to authenticated using (true);
create policy "members create own comments" on public.member_idea_comments for insert to authenticated with check (user_id=auth.uid());
create policy "members edit own comments" on public.member_idea_comments for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create policy "members delete own comments" on public.member_idea_comments for delete to authenticated using (user_id=auth.uid());
create policy "members read monthly votes" on public.member_monthly_votes for select to authenticated using (true);
create policy "members cast own monthly vote" on public.member_monthly_votes for insert to authenticated with check (user_id=auth.uid() and month_key=to_char(timezone('utc',now()),'YYYY-MM') and exists(select 1 from public.member_ideas i where i.id=idea_id and i.is_shortlisted));
create policy "members remove own monthly vote" on public.member_monthly_votes for delete to authenticated using (user_id=auth.uid());

revoke update(status,is_shortlisted,released_at) on public.member_ideas from authenticated;
grant select,insert,update(title,description,category),delete on public.member_ideas to authenticated;
grant select,insert,delete on public.member_idea_votes to authenticated;
grant select,insert,update(body),delete on public.member_idea_comments to authenticated;
grant select,insert,delete on public.member_monthly_votes to authenticated;
