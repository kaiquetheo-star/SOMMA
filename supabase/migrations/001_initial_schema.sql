-- SOMMA core schema (SAD §4) — run in Supabase SQL Editor or via CLI

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  focus_preference jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- User environment
-- ---------------------------------------------------------------------------
create table if not exists public.user_environment (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  available_equipment jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- User stats (Attunement Orbs / RPG)
-- ---------------------------------------------------------------------------
create table if not exists public.user_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  body_essence int not null default 0,
  mind_essence int not null default 0,
  spirit_essence int not null default 0,
  combat_mastery int not null default 0
);

-- ---------------------------------------------------------------------------
-- Auto-provision rows on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.user_environment (user_id) values (new.id);
  insert into public.user_stats (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_environment enable row level security;
alter table public.user_stats enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create policy "environment_select_own" on public.user_environment
  for select using (auth.uid() = user_id);

create policy "environment_insert_own" on public.user_environment
  for insert with check (auth.uid() = user_id);

create policy "environment_update_own" on public.user_environment
  for update using (auth.uid() = user_id);

create policy "stats_select_own" on public.user_stats
  for select using (auth.uid() = user_id);

create policy "stats_insert_own" on public.user_stats
  for insert with check (auth.uid() = user_id);

create policy "stats_update_own" on public.user_stats
  for update using (auth.uid() = user_id);
