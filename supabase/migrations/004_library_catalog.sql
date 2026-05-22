-- SOMMA Encyclopedia (SAD 4.3) - read-only catalogs for AI Experts
-- Run after 001_initial_schema.sql
-- IMPORTANT: Paste ONLY this file into Supabase SQL Editor (no # or markdown lines).

-- ---------------------------------------------------------------------------
-- library_exercises (Iron / hypertrophy)
-- ---------------------------------------------------------------------------
create table if not exists public.library_exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  pillar text not null default 'iron' check (pillar = 'iron'),
  name text not null,
  biomechanical_instructions jsonb not null default '{}'::jsonb,
  equipment_required text[] not null default '{}'::text[],
  default_sets int not null default 4 check (default_sets > 0),
  default_reps int not null default 8 check (default_reps > 0),
  movement_pattern text,
  created_at timestamptz not null default now()
);

create index if not exists library_exercises_equipment_idx
  on public.library_exercises using gin (equipment_required);

-- ---------------------------------------------------------------------------
-- library_combat (Blood & Bone combos)
-- ---------------------------------------------------------------------------
create table if not exists public.library_combat (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  combo_name text not null,
  sequence jsonb not null,
  complexity_level int not null check (complexity_level between 1 and 10),
  created_at timestamptz not null default now()
);

create index if not exists library_combat_complexity_idx
  on public.library_combat (complexity_level);

-- ---------------------------------------------------------------------------
-- RLS: authenticated users may read catalogs only (no client writes)
-- ---------------------------------------------------------------------------
alter table public.library_exercises enable row level security;
alter table public.library_combat enable row level security;

drop policy if exists "library_exercises_select_authenticated" on public.library_exercises;
drop policy if exists "library_combat_select_authenticated" on public.library_combat;

create policy "library_exercises_select_authenticated" on public.library_exercises
  for select
  to authenticated
  using (true);

create policy "library_combat_select_authenticated" on public.library_combat
  for select
  to authenticated
  using (true);

grant select on table public.library_exercises to authenticated;
grant select on table public.library_combat to authenticated;

-- ---------------------------------------------------------------------------
-- Sample catalog rows (3 per table)
-- ---------------------------------------------------------------------------
insert into public.library_exercises (
  slug,
  name,
  biomechanical_instructions,
  equipment_required,
  default_sets,
  default_reps,
  movement_pattern
) values
  (
    'barbell_bench_press',
    'Barbell Bench Press',
    '{
      "setup": "Feet flat, scapulae retracted, wrists stacked over elbows.",
      "eccentric": "3s controlled lower to mid-chest.",
      "concentric": "Drive through floor, exhale past sticking point.",
      "safety": "Use spotter or safeties above face."
    }'::jsonb,
    array['barbell', 'full_gym'],
    4,
    8,
    'push'
  ),
  (
    'dumbbell_romanian_deadlift',
    'Dumbbell Romanian Deadlift',
    '{
      "setup": "Soft knee bend, ribs down, bell close to legs.",
      "eccentric": "Hinge until hamstrings tension; neutral spine.",
      "concentric": "Glute drive, finish hips without hyperextension.",
      "safety": "Stop if lumbar flexion appears."
    }'::jsonb,
    array['dumbbells', 'full_gym'],
    4,
    10,
    'hinge'
  ),
  (
    'pull_up_overhand',
    'Pull-Up (Overhand)',
    '{
      "setup": "Depress lats at dead hang, hollow brace.",
      "concentric": "Elbows to ribs, chest toward bar.",
      "eccentric": "4s lower without shoulder shrug.",
      "regression": "Band-assisted or inverted row if needed."
    }'::jsonb,
    array['pull_up_bar', 'bodyweight', 'full_gym'],
    4,
    6,
    'pull'
  )
on conflict (slug) do nothing;

insert into public.library_combat (slug, combo_name, sequence, complexity_level) values
  (
    'fundamentals_jab_cross',
    'Fundamentals: Jab - Cross',
    '["Jab", "Cross"]'::jsonb,
    2
  ),
  (
    'low_kick_entry',
    'Low Kick Entry',
    '["Jab", "Cross", "Hook", "Low Kick (Lead)"]'::jsonb,
    5
  ),
  (
    'phantom_switch_elbow',
    'Phantom Switch to Elbow',
    '["Jab", "Cross", "Hook", "Slip Outside", "Rear Elbow"]'::jsonb,
    8
  )
on conflict (slug) do nothing;
