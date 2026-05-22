-- SOMMA Flow & Spirit catalog (moved from seed-only DDL)
-- Run after 004_library_catalog.sql

create table if not exists public.library_flow_spirit (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  pillar text not null check (pillar in ('flow', 'spirit')),
  session_name text not null,
  description text,
  duration_minutes int not null default 15 check (duration_minutes > 0),
  tempo_profile jsonb not null default '{}'::jsonb,
  complexity_level int not null default 3 check (complexity_level between 1 and 10),
  created_at timestamptz not null default now()
);

create index if not exists library_flow_spirit_pillar_idx
  on public.library_flow_spirit (pillar);

alter table public.library_flow_spirit enable row level security;

drop policy if exists "library_flow_spirit_select_authenticated" on public.library_flow_spirit;

create policy "library_flow_spirit_select_authenticated" on public.library_flow_spirit
  for select
  to authenticated
  using (true);

grant select on table public.library_flow_spirit to authenticated;
