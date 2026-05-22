-- Flow / Spirit — Biomechanical Healer columns (Yoga & Mobility catalog)
-- Run after 007_library_flow_spirit.sql

alter table public.library_flow_spirit
  add column if not exists target_recovery_zones text[] not null default '{}'::text[];

alter table public.library_flow_spirit
  add column if not exists complexity_tier int not null default 2;

alter table public.library_flow_spirit
  add column if not exists is_dynamic_flow boolean not null default false;

alter table public.library_flow_spirit
  add column if not exists default_hold_seconds int not null default 45;

alter table public.library_flow_spirit
  drop constraint if exists library_flow_spirit_complexity_tier_check;

alter table public.library_flow_spirit
  add constraint library_flow_spirit_complexity_tier_check
  check (complexity_tier between 1 and 3);

create index if not exists library_flow_spirit_recovery_zones_idx
  on public.library_flow_spirit using gin (target_recovery_zones);

create index if not exists library_flow_spirit_complexity_tier_idx
  on public.library_flow_spirit (complexity_tier);

comment on column public.library_flow_spirit.target_recovery_zones is
  'Body zones this asana/flow restores: lower_back, hips, glutes, hamstrings, shoulders, thoracic_spine, neck, ankles, wrists';

comment on column public.library_flow_spirit.complexity_tier is
  'Healer tier 1 (beginner) – 3 (advanced); gated by spirit_essence';

comment on column public.library_flow_spirit.is_dynamic_flow is
  'True for breath-linked movement sequences; false for static holds';

comment on column public.library_flow_spirit.default_hold_seconds is
  'Default hold per side/round for static asanas';
