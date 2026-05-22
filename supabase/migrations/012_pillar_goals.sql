-- Pillar-specific training goals on profiles (per-coach intent for AI CoT)
-- Each column stores the user's declared objective for that training domain.
-- NULL = not specified (AI falls back to pillar-weight heuristics).

alter table public.profiles
  add column if not exists goal_iron   text,
  add column if not exists goal_combat text,
  add column if not exists goal_flow   text,
  add column if not exists goal_spirit text;

-- Constrain to the defined option sets so the DB stays self-documenting and
-- guards against accidental free-text values from future clients.

alter table public.profiles
  drop constraint if exists profiles_goal_iron_check;
alter table public.profiles
  add constraint profiles_goal_iron_check
  check (
    goal_iron is null or goal_iron in (
      'Hypertrophy', 'Strength', 'Endurance', 'Recomposition'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_goal_combat_check;
alter table public.profiles
  add constraint profiles_goal_combat_check
  check (
    goal_combat is null or goal_combat in (
      'Cardio Conditioning', 'Technical Mastery', 'Power Development', 'Self-Defence'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_goal_flow_check;
alter table public.profiles
  add constraint profiles_goal_flow_check
  check (
    goal_flow is null or goal_flow in (
      'Mobility', 'Recovery', 'Flexibility', 'Stress Relief'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_goal_spirit_check;
alter table public.profiles
  add constraint profiles_goal_spirit_check
  check (
    goal_spirit is null or goal_spirit in (
      'Breathwork', 'Meditation', 'Recovery', 'Pre-Session Prime'
    )
  );
