-- SOMMA: idempotent RLS + grants for profiles, user_environment, user_stats
-- Run in Supabase Dashboard → SQL Editor (safe to re-run)

-- ---------------------------------------------------------------------------
-- Grants (authenticated role must reach tables; RLS filters rows)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.user_environment to authenticated;
grant select, insert, update, delete on table public.user_stats to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_environment enable row level security;
alter table public.user_stats enable row level security;

-- ---------------------------------------------------------------------------
-- profiles (PK column is `id`, matches auth.users.id)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_delete_own" on public.profiles
  for delete
  to authenticated
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- user_environment (PK column is `user_id`)
-- ---------------------------------------------------------------------------
drop policy if exists "environment_select_own" on public.user_environment;
drop policy if exists "environment_insert_own" on public.user_environment;
drop policy if exists "environment_update_own" on public.user_environment;
drop policy if exists "environment_delete_own" on public.user_environment;

create policy "environment_select_own" on public.user_environment
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "environment_insert_own" on public.user_environment
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "environment_update_own" on public.user_environment
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "environment_delete_own" on public.user_environment
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_stats (PK column is `user_id`)
-- ---------------------------------------------------------------------------
drop policy if exists "stats_select_own" on public.user_stats;
drop policy if exists "stats_insert_own" on public.user_stats;
drop policy if exists "stats_update_own" on public.user_stats;
drop policy if exists "stats_delete_own" on public.user_stats;

create policy "stats_select_own" on public.user_stats
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "stats_insert_own" on public.user_stats
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "stats_update_own" on public.user_stats
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "stats_delete_own" on public.user_stats
  for delete
  to authenticated
  using (auth.uid() = user_id);
