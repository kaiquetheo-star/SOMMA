-- Performance logs (SAD 4.2) — run in Supabase SQL Editor
-- IMPORTANT: Paste ONLY this file. No markdown or lines starting with #.
-- Prerequisite: 001_initial_schema.sql (profiles table)

create table if not exists public.performance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  pillar text not null check (pillar in ('iron', 'combat', 'flow', 'spirit')),
  exercise_id uuid,
  block_id text,
  weight_used numeric,
  reps_completed int,
  rpe_score int check (rpe_score is null or (rpe_score between 1 and 10)),
  actual_rest_seconds int,
  volume numeric,
  payload jsonb not null default '{}'::jsonb,
  timestamp timestamptz not null default now()
);

-- Optional FK when library_exercises exists (004)
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'library_exercises'
  ) then
    alter table public.performance_logs
      drop constraint if exists performance_logs_exercise_id_fkey;

    alter table public.performance_logs
      add constraint performance_logs_exercise_id_fkey
      foreign key (exercise_id) references public.library_exercises (id) on delete set null;
  end if;
end $$;

create index if not exists performance_logs_user_time_idx
  on public.performance_logs (user_id, timestamp desc);

alter table public.performance_logs enable row level security;

drop policy if exists "performance_logs_select_own" on public.performance_logs;
drop policy if exists "performance_logs_insert_own" on public.performance_logs;

create policy "performance_logs_select_own" on public.performance_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "performance_logs_insert_own" on public.performance_logs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert on table public.performance_logs to authenticated;
