-- SOMMA Encyclopedia seed — run in Supabase SQL Editor after migrations 004+
-- Paste ONLY this file (no markdown, no lines starting with #).
-- Safe to re-run: uses ON CONFLICT (slug) DO UPDATE.

-- ---------------------------------------------------------------------------
-- library_flow_spirit (Flow & Spirit catalog — created here if missing)
-- ---------------------------------------------------------------------------
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

alter table public.library_flow_spirit enable row level security;

drop policy if exists "library_flow_spirit_select_authenticated" on public.library_flow_spirit;

create policy "library_flow_spirit_select_authenticated" on public.library_flow_spirit
  for select
  to authenticated
  using (true);

grant select on table public.library_flow_spirit to authenticated;

-- ---------------------------------------------------------------------------
-- Iron Pillar — 15 core exercises
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
    '{"setup":"Feet flat, scapulae retracted, slight arch, wrists stacked over elbows.","eccentric":"3s lower to mid-chest, elbows ~45°.","concentric":"Leg drive, press to lockout without flaring ribs.","safety":"Spotter or rack safeties at chest level."}'::jsonb,
    array['barbell', 'full_gym'],
    4, 8, 'push'
  ),
  (
    'barbell_back_squat',
    'Barbell Back Squat',
    '{"setup":"High-bar or low-bar, brace 360°, heels hip-width.","eccentric":"Sit between hips, knees track toes, neutral spine.","concentric":"Drive floor away, hips and chest rise together.","safety":"Use safety bars; avoid valgus collapse."}'::jsonb,
    array['barbell', 'full_gym'],
    4, 6, 'squat'
  ),
  (
    'conventional_deadlift',
    'Conventional Deadlift',
    '{"setup":"Mid-foot bar, hinge, lats engaged, neutral neck.","eccentric":"Controlled lower along legs (tempo or touch-and-go per block).","concentric":"Push floor, hips through, squeeze glutes at top.","safety":"No lumbar rounding; reset if grip fails."}'::jsonb,
    array['barbell', 'full_gym'],
    4, 5, 'hinge'
  ),
  (
    'dumbbell_romanian_deadlift',
    'Dumbbell Romanian Deadlift',
    '{"setup":"Soft knee bend, ribs down, bells close to thighs.","eccentric":"Hinge until hamstring tension; shins near vertical.","concentric":"Glute drive; avoid hyperextension.","safety":"Stop if lower back flexes."}'::jsonb,
    array['dumbbells', 'full_gym'],
    4, 10, 'hinge'
  ),
  (
    'dumbbell_row',
    'Dumbbell Row',
    '{"setup":"Bench support, flat back, pull elbow to hip.","eccentric":"3s lower without shoulder roll forward.","concentric":"Lat-driven pull, pause at top.","safety":"Neutral spine; no thoracic rotation."}'::jsonb,
    array['dumbbells', 'full_gym'],
    4, 10, 'pull'
  ),
  (
    'pull_up_overhand',
    'Pull-Up (Overhand)',
    '{"setup":"Dead hang, depress scapulae, hollow brace.","eccentric":"4s lower, shoulders down.","concentric":"Chest toward bar, elbows to ribs.","regression":"Band assist or inverted row."}'::jsonb,
    array['pull_up_bar', 'bodyweight', 'full_gym'],
    4, 6, 'pull'
  ),
  (
    'overhead_press',
    'Standing Overhead Press',
    '{"setup":"Rack or clean, glutes tight, ribs down.","eccentric":"Bar to chin without excessive lean.","concentric":"Press vertically, head through at lockout.","safety":"Skip if shoulder impingement active."}'::jsonb,
    array['barbell', 'dumbbells', 'full_gym'],
    4, 8, 'push'
  ),
  (
    'bulgarian_split_squat',
    'Bulgarian Split Squat',
    '{"setup":"Rear foot elevated, front foot far enough for vertical shin.","eccentric":"3s lower until rear knee nears floor.","concentric":"Drive through front heel.","safety":"Use dumbbells for balance if needed."}'::jsonb,
    array['dumbbells', 'bodyweight', 'full_gym'],
    3, 10, 'lunge'
  ),
  (
    'goblet_squat',
    'Goblet Squat',
    '{"setup":"Bell at sternum, elbows inside knees.","eccentric":"Sit deep with upright torso.","concentric":"Drive floor; knees track toes.","safety":"Heels down; pause if knee pain."}'::jsonb,
    array['kettlebell', 'dumbbells', 'full_gym'],
    4, 12, 'squat'
  ),
  (
    'kettlebell_swing',
    'Kettlebell Swing',
    '{"setup":"Hike bell, hinge not squat, lats on.","eccentric":"Bell floats back between legs.","concentric":"Hip snap to chest height; arms relaxed.","safety":"Stop if lower back dominates over hips."}'::jsonb,
    array['kettlebell', 'full_gym'],
    5, 15, 'hinge'
  ),
  (
    'incline_dumbbell_press',
    'Incline Dumbbell Press',
    '{"setup":"Bench 30–45°, feet planted, neutral wrists.","eccentric":"Controlled lower to upper chest line.","concentric":"Press up and slightly in without clashing bells.","safety":"Shoulder-friendly angle if overhead pressing hurts."}'::jsonb,
    array['dumbbells', 'full_gym'],
    4, 10, 'push'
  ),
  (
    'lat_pulldown',
    'Lat Pulldown',
    '{"setup":"Thighs secured, slight lean, overhand grip.","eccentric":"3s return without shrugging.","concentric":"Pull to upper chest, elbows down.","safety":"Avoid behind-neck variant."}'::jsonb,
    array['full_gym'],
    4, 10, 'pull'
  ),
  (
    'push_up',
    'Push-Up',
    '{"setup":"Hands under shoulders, plank from head to heel.","eccentric":"3s lower, elbows 30–45°.","concentric":"Press to lockout without sagging hips.","regression":"Incline or knee push-up."}'::jsonb,
    array['bodyweight'],
    4, 12, 'push'
  ),
  (
    'walking_lunge',
    'Walking Lunge',
    '{"setup":"Torso tall, stride long enough for 90° front knee.","eccentric":"Soft touch of rear knee.","concentric":"Drive front heel, alternate legs.","safety":"Clear path; hold weights at sides if loaded."}'::jsonb,
    array['dumbbells', 'bodyweight', 'full_gym'],
    3, 12, 'lunge'
  ),
  (
    'farmer_carry',
    'Farmer Carry',
    '{"setup":"Tall posture, shoulders packed, crush grip.","eccentric":"N/A — locomotion set.","concentric":"Walk 20–40m per leg without lateral sway.","safety":"Drop if grip fails; neutral spine."}'::jsonb,
    array['dumbbells', 'kettlebell', 'full_gym'],
    4, 1, 'carry'
  )
on conflict (slug) do update set
  name = excluded.name,
  biomechanical_instructions = excluded.biomechanical_instructions,
  equipment_required = excluded.equipment_required,
  default_sets = excluded.default_sets,
  default_reps = excluded.default_reps,
  movement_pattern = excluded.movement_pattern;

-- ---------------------------------------------------------------------------
-- Combat Pillar — see seed_combat_tactical.sql after migration 009
-- (tactical_focus + 25 combos). Legacy rows below kept for bare 004 installs.
-- ---------------------------------------------------------------------------
insert into public.library_combat (slug, combo_name, sequence, complexity_level) values
  (
    'fundamentals_jab_cross',
    'Fundamentals: Jab — Cross',
    '["Jab", "Cross"]'::jsonb,
    2
  ),
  (
    'jab_cross_hook',
    'Jab — Cross — Lead Hook',
    '["Jab", "Cross", "Hook (Lead)"]'::jsonb,
    3
  ),
  (
    'double_jab_cross',
    'Double Jab — Cross',
    '["Jab", "Jab", "Cross"]'::jsonb,
    3
  ),
  (
    'cross_hook_cross',
    'Cross — Hook — Cross',
    '["Cross", "Hook (Lead)", "Cross"]'::jsonb,
    4
  ),
  (
    'low_kick_entry',
    'Low Kick Entry',
    '["Jab", "Cross", "Hook", "Low Kick (Lead)"]'::jsonb,
    5
  ),
  (
    'body_shot_setup',
    'Body Shot Setup',
    '["Jab to Body", "Cross to Head", "Hook to Body"]'::jsonb,
    5
  ),
  (
    'slip_counter',
    'Slip and Counter',
    '["Slip Outside", "Cross", "Lead Hook"]'::jsonb,
    6
  ),
  (
    'phantom_switch_elbow',
    'Phantom Switch to Elbow',
    '["Jab", "Cross", "Hook", "Slip Outside", "Rear Elbow"]'::jsonb,
    8
  ),
  (
    'teep_jab_cross',
    'Teep — Jab — Cross',
    '["Lead Teep", "Jab", "Cross"]'::jsonb,
    6
  ),
  (
    'jab_cross_hook_low_kick_sprawl',
    'Full Chain: Jab — Cross — Hook — Low Kick — Sprawl',
    '["Jab", "Cross", "Hook", "Low Kick (Lead)", "Sprawl"]'::jsonb,
    9
  )
on conflict (slug) do update set
  combo_name = excluded.combo_name,
  sequence = excluded.sequence,
  complexity_level = excluded.complexity_level;

-- After 009_library_combat_tactical.sql, run: supabase/seed_combat_tactical.sql
-- After 010_library_flow_spirit_healer.sql, run: supabase/seed_flow_spirit_healer.sql

-- ---------------------------------------------------------------------------
-- Flow & Spirit — 5 sessions (legacy; healer seed supersedes with new columns)
-- ---------------------------------------------------------------------------
insert into public.library_flow_spirit (
  slug,
  pillar,
  session_name,
  description,
  duration_minutes,
  tempo_profile,
  complexity_level
) values
  (
    'morning_joint_flow',
    'flow',
    'Morning Joint Flow',
    'Slow articular rotations and sun-salutation style transitions for synovial fluid and posture.',
    18,
    '{"focus":"mobility","segments":["neck","shoulders","hips","ankles"],"intensity":"low"}'::jsonb,
    2
  ),
  (
    'hip_opener_sequence',
    'flow',
    'Hip Opener Sequence',
    'Pigeon variations, 90/90 switches, and controlled Cossack patterns for hip longevity.',
    22,
    '{"focus":"hips","hold_seconds":45,"transitions":"breath-linked"}'::jsonb,
    4
  ),
  (
    'tempo_box_breathwork',
    'spirit',
    'Box Breathing',
    'Equal inhale, hold, exhale, hold — nervous system regulation before Iron or Combat.',
    12,
    '{"inhale_seconds":4,"hold_seconds":4,"exhale_seconds":4,"hold_empty_seconds":4,"cycles":8}'::jsonb,
    2
  ),
  (
    'recovery_478',
    'spirit',
    '4-7-8 Recovery Breath',
    'Downregulation protocol for high-stress days or post-max-effort sessions.',
    15,
    '{"inhale_seconds":4,"hold_seconds":7,"exhale_seconds":8,"hold_empty_seconds":0,"cycles":6}'::jsonb,
    3
  ),
  (
    'nsdr_body_scan',
    'spirit',
    'NSDR Body Scan',
    'Non-sleep deep rest progressive relaxation for recovery and vagal tone.',
    20,
    '{"inhale_seconds":4,"exhale_seconds":6,"body_scan":true,"cycles":10}'::jsonb,
    4
  ),
  (
    'relaxing_exhale',
    'spirit',
    'Relaxing Exhale',
    'Gentle 4-0-6 downregulation primer for low-fatigue days.',
    12,
    '{"inhale_seconds":4,"hold_seconds":0,"exhale_seconds":6,"hold_empty_seconds":0,"cycles":5}'::jsonb,
    2
  )
on conflict (slug) do update set
  pillar = excluded.pillar,
  session_name = excluded.session_name,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  tempo_profile = excluded.tempo_profile,
  complexity_level = excluded.complexity_level;
