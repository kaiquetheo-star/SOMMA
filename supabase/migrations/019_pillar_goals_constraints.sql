-- Pillar goal columns — soft guardrails only (free-text goals allowed in onboarding)
-- Renumbered from 012 → 019 (duplicate prefix fix). Columns live in 012_profiles_pillar_goals.sql
--
-- Enum CHECK constraints were removed: client presets + free-text in PillarGoalSelect
-- do not match the original migration enum set, and legacy rows already violate them.

alter table public.profiles
  add column if not exists goal_iron   text,
  add column if not exists goal_combat text,
  add column if not exists goal_flow   text,
  add column if not exists goal_spirit text;

-- Drop legacy enum constraints from partial/failed applies
alter table public.profiles drop constraint if exists profiles_goal_iron_check;
alter table public.profiles drop constraint if exists profiles_goal_combat_check;
alter table public.profiles drop constraint if exists profiles_goal_flow_check;
alter table public.profiles drop constraint if exists profiles_goal_spirit_check;

-- Length guard only — preserves preset chips and custom user copy
alter table public.profiles
  add constraint profiles_goal_iron_check
  check (goal_iron is null or char_length(goal_iron) <= 120);

alter table public.profiles
  add constraint profiles_goal_combat_check
  check (goal_combat is null or char_length(goal_combat) <= 120);

alter table public.profiles
  add constraint profiles_goal_flow_check
  check (goal_flow is null or char_length(goal_flow) <= 120);

alter table public.profiles
  add constraint profiles_goal_spirit_check
  check (goal_spirit is null or char_length(goal_spirit) <= 120);
