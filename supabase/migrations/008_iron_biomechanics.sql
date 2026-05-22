-- SOMMA Iron Pillar — Elite Hypertrophy biomechanics (MuscleWiki-level catalog)
-- Run after 004_library_catalog.sql (and before seed_hypertrophy.sql)
-- Paste ONLY this file into Supabase SQL Editor.

-- ---------------------------------------------------------------------------
-- library_exercises — hypertrophy coaching metadata
-- ---------------------------------------------------------------------------
alter table public.library_exercises
  add column if not exists primary_muscle text,
  add column if not exists synergist_muscles text[] not null default '{}',
  add column if not exists cns_fatigue_cost int,
  add column if not exists joint_stress_profile text,
  add column if not exists stretch_mediated_hypertrophy boolean not null default false;

-- CNS drain: 1 = isolation / low systemic cost, 5 = heavy axial / compound fatigue
alter table public.library_exercises
  drop constraint if exists library_exercises_cns_fatigue_cost_check;

alter table public.library_exercises
  add constraint library_exercises_cns_fatigue_cost_check
  check (cns_fatigue_cost is null or cns_fatigue_cost between 1 and 5);

comment on column public.library_exercises.primary_muscle is
  'Main hypertrophy target (e.g. hamstrings, upper_chest)';
comment on column public.library_exercises.synergist_muscles is
  'Secondary muscles contributing to the movement';
comment on column public.library_exercises.cns_fatigue_cost is
  'Central nervous system fatigue cost (1-5) for session ordering';
comment on column public.library_exercises.joint_stress_profile is
  'Joint stress tag for injury-aware programming (e.g. high_knee_shear)';
comment on column public.library_exercises.stretch_mediated_hypertrophy is
  'True when peak tension occurs in the lengthened position (SCHP bias)';

create index if not exists library_exercises_primary_muscle_idx
  on public.library_exercises (primary_muscle);

create index if not exists library_exercises_cns_fatigue_idx
  on public.library_exercises (cns_fatigue_cost);

create index if not exists library_exercises_joint_stress_idx
  on public.library_exercises (joint_stress_profile);

create index if not exists library_exercises_stretch_mediated_idx
  on public.library_exercises (stretch_mediated_hypertrophy)
  where stretch_mediated_hypertrophy = true;
