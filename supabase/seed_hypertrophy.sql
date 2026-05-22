-- SOMMA Elite Hypertrophy encyclopedia — 42 curated Iron movements
-- Requires: 004_library_catalog.sql + 008_iron_biomechanics.sql applied first
-- Paste ONLY this file into Supabase SQL Editor (safe to re-run).

insert into public.library_exercises (
  slug,
  name,
  biomechanical_instructions,
  equipment_required,
  default_sets,
  default_reps,
  movement_pattern,
  primary_muscle,
  synergist_muscles,
  cns_fatigue_cost,
  joint_stress_profile,
  stretch_mediated_hypertrophy
) values
  (
    'deficit_bulgarian_split_squat',
    'Deficit Bulgarian Split Squat',
    '{"setup":"Front foot on 2–4\" deficit, rear foot elevated, torso slight forward for quad bias.","eccentric":"3s lower until rear knee nears floor; front knee tracks over mid-foot.","concentric":"Drive through front heel; minimize push from back leg.","safety":"Reduce deficit if knee shear pain; hold dumbbells at sides for balance."}'::jsonb,
    array['dumbbells', 'full_gym', 'bodyweight'],
    3, 10, 'lunge',
    'quadriceps',
    array['glutes', 'adductors', 'core'],
    4, 'high_knee_shear', true
  ),
  (
    'hack_squat_machine',
    'Hack Squat (Machine)',
    '{"setup":"Feet mid-platform, back flat on pad, knees align with toes.","eccentric":"Controlled 2–3s to deep knee flexion without pelvis tuck.","concentric":"Press through mid-foot; avoid locking knees violently.","safety":"Limit depth if lumbar rounds off pad."}'::jsonb,
    array['full_gym'],
    4, 8, 'squat',
    'quadriceps',
    array['glutes'],
    3, 'moderate_knee_stress', false
  ),
  (
    'pendulum_squat',
    'Pendulum Squat',
    '{"setup":"Shoulders under pads, feet low on platform for quad emphasis.","eccentric":"Let arc guide depth; keep ribs stacked.","concentric":"Drive knees forward over toes; constant tension arc.","safety":"Stop above pain-limited ROM."}'::jsonb,
    array['full_gym'],
    3, 10, 'squat',
    'quadriceps',
    array['glutes'],
    3, 'moderate_knee_stress', true
  ),
  (
    'belt_squat',
    'Belt Squat',
    '{"setup":"Belt at hips, hold straps, upright torso, feet shoulder-width.","eccentric":"Sit between hips without spinal compression.","concentric":"Drive floor; glutes and quads without axial load.","safety":"Ideal when low-back fatigue is high."}'::jsonb,
    array['full_gym'],
    4, 10, 'squat',
    'quadriceps',
    array['glutes', 'adductors'],
    2, 'low_impact', false
  ),
  (
    'barbell_back_squat',
    'Barbell Back Squat',
    '{"setup":"High-bar or low-bar, brace 360°, heels hip-width.","eccentric":"Sit between hips; knees track toes; neutral spine.","concentric":"Drive floor; hips and chest rise together.","safety":"Safety bars set; avoid valgus collapse."}'::jsonb,
    array['barbell', 'full_gym'],
    4, 6, 'squat',
    'quadriceps',
    array['glutes', 'erectors', 'core'],
    5, 'spinal_axial_load', false
  ),
  (
    'sissy_squat',
    'Sissy Squat',
    '{"setup":"Heels elevated or anchored, hips extended, torso lean.","eccentric":"3s knee flexion with hips open — pure quad lengthening.","concentric":"Extend knees without hip closure.","safety":"Use band assist if patellar irritation."}'::jsonb,
    array['bodyweight', 'full_gym'],
    3, 12, 'squat',
    'quadriceps',
    array['core'],
    2, 'high_knee_shear', true
  ),
  (
    'leg_extension',
    'Leg Extension',
    '{"setup":"Pad at ankle, femur neutral, back flat on seat.","eccentric":"3s lower without hip lift off seat.","concentric":"Extend to peak contraction; pause 1s.","safety":"Avoid if active patellar tendinopathy."}'::jsonb,
    array['full_gym'],
    3, 15, 'isolation',
    'quadriceps',
    array[]::text[],
    1, 'moderate_knee_stress', false
  ),
  (
    'seated_leg_curl',
    'Seated Leg Curl',
    '{"setup":"Pad above heels, hips pinned, dorsiflex ankles optional.","eccentric":"3s lower to full hamstring stretch.","concentric":"Curl without lifting hips.","safety":"Control tempo — avoid ballistic reps."}'::jsonb,
    array['full_gym'],
    3, 12, 'isolation',
    'hamstrings',
    array['calves'],
    1, 'low_impact', true
  ),
  (
    'nordic_curl',
    'Nordic Hamstring Curl',
    '{"setup":"Ankles fixed, tall line knee to shoulder.","eccentric":"Lower as slow as possible using hamstrings as brakes.","concentric":"Push lightly from floor if needed.","regression":"Band assist at chest."}'::jsonb,
    array['bodyweight', 'full_gym'],
    3, 6, 'isolation',
    'hamstrings',
    array['glutes', 'calves'],
    3, 'high_knee_shear', true
  ),
  (
    'barbell_romanian_deadlift',
    'Barbell Romanian Deadlift',
    '{"setup":"Soft knee bend, bar close to legs, lats engaged, ribs down.","eccentric":"Hinge until hamstrings peak stretch; shins near vertical.","concentric":"Glute drive; bar skims thighs.","safety":"Stop if lumbar flexion appears."}'::jsonb,
    array['barbell', 'full_gym'],
    4, 8, 'hinge',
    'hamstrings',
    array['glutes', 'erectors'],
    4, 'lumbar_shear', true
  ),
  (
    'dumbbell_romanian_deadlift',
    'Dumbbell Romanian Deadlift',
    '{"setup":"Soft knee bend, bells close to thighs, neutral spine.","eccentric":"Hinge to hamstring end-range; feel stretch at bottom.","concentric":"Squeeze glutes; avoid hyperextension.","safety":"Reduce load if grip limits set before hamstrings."}'::jsonb,
    array['dumbbells', 'full_gym'],
    4, 10, 'hinge',
    'hamstrings',
    array['glutes', 'erectors'],
    3, 'lumbar_shear', true
  ),
  (
    'stiff_leg_deadlift',
    'Stiff-Leg Deadlift',
    '{"setup":"Minimal knee bend, bar over mid-foot, hinge from hips.","eccentric":"Bar tracks close; maximize hamstring length.","concentric":"Hip extension without back hyperextension.","safety":"Lighter than RDL if lumbar fatigue high."}'::jsonb,
    array['barbell', 'dumbbells', 'full_gym'],
    3, 10, 'hinge',
    'hamstrings',
    array['glutes', 'erectors'],
    4, 'lumbar_shear', true
  ),
  (
    'conventional_deadlift',
    'Conventional Deadlift',
    '{"setup":"Mid-foot bar, hinge, lats on, neutral neck.","eccentric":"Controlled lower or reset per block.","concentric":"Floor push, hips through, glutes lock.","safety":"No rounding; treat as high CNS day."}'::jsonb,
    array['barbell', 'full_gym'],
    4, 5, 'hinge',
    'erectors',
    array['glutes', 'hamstrings', 'quadriceps', 'traps'],
    5, 'spinal_axial_load', false
  ),
  (
    'rack_pull',
    'Rack Pull (Below Knee)',
    '{"setup":"Bar at just below knee, wedge, lats tight.","eccentric":"Lower to pins with control.","concentric":"Lock hips; overload posterior chain.","safety":"Use when deadlift fatigue is managed separately."}'::jsonb,
    array['barbell', 'full_gym'],
    4, 5, 'hinge',
    'erectors',
    array['glutes', 'traps', 'hamstrings'],
    4, 'spinal_axial_load', false
  ),
  (
    'barbell_hip_hinge_good_morning',
    'Barbell Good Morning',
    '{"setup":"Bar on back like squat, soft knees, brace hard.","eccentric":"Hinge until hamstrings limit ROM.","concentric":"Glute-ham drive to stand.","safety":"Light load; advanced athletes only."}'::jsonb,
    array['barbell', 'full_gym'],
    3, 8, 'hinge',
    'hamstrings',
    array['glutes', 'erectors'],
    4, 'lumbar_shear', true
  ),
  (
    'hip_thrust_barbell',
    'Barbell Hip Thrust',
    '{"setup":"Upper back on bench, bar padded, chin tucked, ribs down.","eccentric":"Lower until stretch at bottom without lumbar arch.","concentric":"Full glute lockout; shins vertical at top.","safety":"Pause at top; avoid cervical hyperextension."}'::jsonb,
    array['barbell', 'full_gym'],
    4, 10, 'hinge',
    'glutes',
    array['hamstrings', 'core'],
    3, 'low_impact', true
  ),
  (
    'cable_kickback_glute',
    'Cable Glute Kickback',
    '{"setup":"Ankle strap, slight forward lean, squeeze at top.","eccentric":"3s return without spinal rotation.","concentric":"Extend hip behind body; glute-only path.","safety":"Avoid excessive lumbar extension."}'::jsonb,
    array['full_gym'],
    3, 15, 'isolation',
    'glutes',
    array['hamstrings'],
    1, 'low_impact', false
  ),
  (
    'incline_dumbbell_press_30',
    'Incline Dumbbell Press (30°)',
    '{"setup":"Bench 30° — clavicular head bias; feet planted, scapulae retracted.","eccentric":"3s to upper chest line; elbows 45°.","concentric":"Press up and slightly in; dumbbells independent path.","safety":"30° reduces impingement vs steep incline."}'::jsonb,
    array['dumbbells', 'full_gym'],
    4, 10, 'push',
    'upper_chest',
    array['front_delts', 'triceps'],
    3, 'shoulder_impingement_risk', true
  ),
  (
    'incline_cable_fly',
    'Incline Cable Fly (30°)',
    '{"setup":"Bench 30°, cables low, slight elbow bend fixed.","eccentric":"Arc down until upper chest stretch.","concentric":"Sweep up on fiber line; constant tension.","safety":"Light-moderate load; stretch is the stimulus."}'::jsonb,
    array['full_gym'],
    3, 12, 'isolation',
    'upper_chest',
    array['front_delts'],
    1, 'shoulder_impingement_risk', true
  ),
  (
    'barbell_bench_press',
    'Barbell Bench Press',
    '{"setup":"Feet flat, arch legal, wrists over elbows, scapulae pinned.","eccentric":"3s to mid-chest.","concentric":"Leg drive, press to lockout.","safety":"Spotter or safeties."}'::jsonb,
    array['barbell', 'full_gym'],
    4, 8, 'push',
    'chest',
    array['front_delts', 'triceps'],
    4, 'shoulder_impingement_risk', false
  ),
  (
    'close_grip_bench_press',
    'Close-Grip Bench Press',
    '{"setup":"Hands shoulder-width, elbows tucked.","eccentric":"Lower to lower sternum.","concentric":"Tricep-driven lockout.","safety":"Skip if wrist pain."}'::jsonb,
    array['barbell', 'full_gym'],
    4, 8, 'push',
    'triceps',
    array['chest', 'front_delts'],
    3, 'wrist_stress', false
  ),
  (
    'dumbbell_fly_flat',
    'Dumbbell Fly (Flat)',
    '{"setup":"Slight elbow bend constant, supinated finish optional.","eccentric":"Open until chest stretch at bottom.","concentric":"Arc bells up; squeeze without clashing.","safety":"Moderate load only."}'::jsonb,
    array['dumbbells', 'full_gym'],
    3, 12, 'isolation',
    'chest',
    array['front_delts'],
    1, 'shoulder_impingement_risk', true
  ),
  (
    'landmine_press',
    'Landmine Press',
    '{"setup":"Bar in corner, staggered stance, core braced.","eccentric":"Lower to chest with neutral shoulder path.","concentric":"Press on arc; scapular upward rotation friendly.","safety":"Good when overhead pressing irritates shoulder."}'::jsonb,
    array['barbell', 'full_gym'],
    4, 10, 'push',
    'upper_chest',
    array['front_delts', 'core', 'triceps'],
    3, 'low_impact', false
  ),
  (
    'iliac_lat_pulldown',
    'Iliac Lat Pulldown',
    '{"setup":"Lean back slightly, grip wide, pull to upper abs/iliac crest line.","eccentric":"3s return maintaining lat tension.","concentric":"Elbows drive down and back — lat not bicep.","safety":"Avoid behind-neck variant."}'::jsonb,
    array['full_gym'],
    4, 10, 'pull',
    'lats',
    array['mid_back', 'biceps', 'rear_delts'],
    2, 'low_impact', true
  ),
  (
    'chest_supported_row',
    'Chest-Supported T-Bar Row',
    '{"setup":"Chest on pad, neutral spine, pull to lower ribs.","eccentric":"3s lower without losing thoracic position.","concentric":"Elbows to hips; pause at contraction.","safety":"Removes lumbar from row equation."}'::jsonb,
    array['full_gym'],
    4, 10, 'pull',
    'mid_back',
    array['lats', 'rear_delts', 'biceps'],
    2, 'low_impact', false
  ),
  (
    'pendlay_row',
    'Pendlay Row',
    '{"setup":"Torso parallel floor each rep, bar on floor reset.","eccentric":"Dead stop on floor.","concentric":"Explosive pull to sternum.","safety":"Brace hard; not for acute lumbar issues."}'::jsonb,
    array['barbell', 'full_gym'],
    4, 8, 'pull',
    'mid_back',
    array['lats', 'rear_delts', 'erectors'],
    4, 'lumbar_shear', false
  ),
  (
    't_bar_row',
    'T-Bar Row',
    '{"setup":"Hinge stable, handle to sternum, avoid shrugging.","eccentric":"3s lower with control.","concentric":"Squeeze mid-back at top.","safety":"Use chest support variant if lumbar tired."}'::jsonb,
    array['barbell', 'full_gym'],
    4, 10, 'pull',
    'mid_back',
    array['lats', 'biceps', 'erectors'],
    3, 'lumbar_shear', false
  ),
  (
    'dumbbell_row',
    'Single-Arm Dumbbell Row',
    '{"setup":"Bench support, flat back, pull elbow to hip.","eccentric":"3s lower without shoulder roll.","concentric":"Lat-driven; pause at top.","safety":"No thoracic rotation."}'::jsonb,
    array['dumbbells', 'full_gym'],
    4, 10, 'pull',
    'lats',
    array['mid_back', 'biceps', 'rear_delts'],
    2, 'low_impact', false
  ),
  (
    'neutral_grip_pull_up',
    'Neutral-Grip Pull-Up',
    '{"setup":"Handles parallel, dead hang, depress scapulae.","eccentric":"4s lower, shoulders down.","concentric":"Chest toward handles; elbows to ribs.","regression":"Band assist."}'::jsonb,
    array['pull_up_bar', 'full_gym'],
    4, 6, 'pull',
    'lats',
    array['biceps', 'mid_back', 'core'],
    4, 'low_impact', true
  ),
  (
    'pull_up_overhand',
    'Pull-Up (Overhand)',
    '{"setup":"Dead hang, hollow brace, lats engaged.","eccentric":"4s lower without shrug.","concentric":"Chest toward bar.","regression":"Band assist or pulldown."}'::jsonb,
    array['pull_up_bar', 'bodyweight', 'full_gym'],
    4, 6, 'pull',
    'lats',
    array['biceps', 'mid_back'],
    4, 'low_impact', true
  ),
  (
    'cable_pull_over',
    'Cable Pullover',
    '{"setup":"Rope or bar, slight elbow bend, hips stable.","eccentric":"Arc overhead until lat stretch.","concentric":"Sweep down to hips — lat isolation.","safety":"Light load; rib flare controlled."}'::jsonb,
    array['full_gym'],
    3, 12, 'isolation',
    'lats',
    array['chest', 'triceps'],
    1, 'low_impact', true
  ),
  (
    'cable_lateral_raise',
    'Cable Lateral Raise',
    '{"setup":"Cable crosses behind body, soft elbows, lead with elbows.","eccentric":"3s lower without trap takeover.","concentric":"Raise to shoulder height; constant tension.","safety":"No swinging."}'::jsonb,
    array['full_gym'],
    3, 15, 'isolation',
    'side_delts',
    array['traps'],
    1, 'low_impact', false
  ),
  (
    'reverse_pec_deck',
    'Reverse Pec Deck',
    '{"setup":"Chest on pad, arms parallel floor, rear delt line.","eccentric":"3s open to stretch.","concentric":"Sweep back; pause squeeze.","safety":"Avoid if posterior shoulder acute pain."}'::jsonb,
    array['full_gym'],
    3, 15, 'isolation',
    'rear_delts',
    array['mid_back', 'traps'],
    1, 'low_impact', true
  ),
  (
    'face_pull',
    'Face Pull',
    '{"setup":"Rope at face height, external rotate at end.","eccentric":"3s return without losing posture.","concentric":"Pull to forehead; spread rope.","safety":"Rotator cuff health staple."}'::jsonb,
    array['full_gym'],
    3, 15, 'isolation',
    'rear_delts',
    array['traps', 'rotator_cuff'],
    1, 'rotator_cuff_heavy', false
  ),
  (
    'machine_shoulder_press',
    'Machine Shoulder Press',
    '{"setup":"Handles neutral, back flat, core braced.","eccentric":"3s lower to ear level.","concentric":"Press without excessive lean.","safety":"Skip if impingement active."}'::jsonb,
    array['full_gym'],
    4, 10, 'push',
    'front_delts',
    array['triceps', 'upper_chest'],
    3, 'rotator_cuff_heavy', false
  ),
  (
    'bayesian_curl',
    'Bayesian Cable Curl',
    '{"setup":"Cable behind body, arm behind torso line — long-head bias.","eccentric":"3s to full elbow extension behind plane.","concentric":"Curl without shoulder swinging forward.","safety":"Prime stretch-mediated biceps stimulus."}'::jsonb,
    array['full_gym'],
    3, 12, 'isolation',
    'biceps',
    array['forearms'],
    1, 'low_impact', true
  ),
  (
    'spider_curl',
    'Spider Curl (Incline Bench)',
    '{"setup":"Chest on pad, arms hang vertical, shoulders fixed.","eccentric":"3s lower to near-full extension.","concentric":"Curl without shoulder drift.","safety":"Strict form; no hip drive."}'::jsonb,
    array['dumbbells', 'full_gym'],
    3, 12, 'isolation',
    'biceps',
    array['forearms'],
    1, 'low_impact', true
  ),
  (
    'preacher_curl_machine',
    'Preacher Curl (Machine)',
    '{"setup":"Armpits at pad top, triceps on pad, wrists neutral.","eccentric":"3s to near-full stretch at bottom.","concentric":"Curl without lifting elbows off pad.","safety":"Avoid if distal biceps irritation."}'::jsonb,
    array['full_gym'],
    3, 12, 'isolation',
    'biceps',
    array['forearms'],
    1, 'low_impact', true
  ),
  (
    'hammer_curl_incline',
    'Incline Hammer Curl',
    '{"setup":"Bench 45°, arms hang, neutral grip.","eccentric":"3s lower behind torso line.","concentric":"Curl to shoulder; brachialis bias.","safety":"Do not swing torso."}'::jsonb,
    array['dumbbells', 'full_gym'],
    3, 12, 'isolation',
    'biceps',
    array['forearms', 'brachialis'],
    1, 'low_impact', true
  ),
  (
    'tricep_rope_pushdown',
    'Tricep Rope Pushdown',
    '{"setup":"Elbows pinned to sides, slight forward lean.","eccentric":"3s up without shoulder migration.","concentric":"Split rope at lockout; lateral head bias.","safety":"Keep wrists neutral."}'::jsonb,
    array['full_gym'],
    3, 12, 'isolation',
    'triceps',
    array[]::text[],
    1, 'low_impact', false
  ),
  (
    'ez_bar_skullcrusher',
    'EZ-Bar Skullcrusher',
    '{"setup":"Bench, arms vertical, elbows point to ceiling.","eccentric":"Lower to forehead or behind head for stretch.","concentric":"Extend without flaring elbows.","safety":"Light-moderate load; elbow friendly path."}'::jsonb,
    array['barbell', 'full_gym'],
    3, 10, 'isolation',
    'triceps',
    array[]::text[],
    2, 'low_impact', true
  ),
  (
    'smith_machine_split_squat',
    'Smith Machine Split Squat',
    '{"setup":"Staggered stance under bar, front shin near vertical at bottom.","eccentric":"3s lower; torso tall.","concentric":"Front heel drive.","safety":"Stable option vs free-weight BSS when fatigued."}'::jsonb,
    array['full_gym'],
    3, 10, 'lunge',
    'quadriceps',
    array['glutes'],
    3, 'moderate_knee_stress', true
  ),
  (
    'single_leg_leg_press',
    'Single-Leg Leg Press',
    '{"setup":"Foot mid-platform, hip square, unilateral load.","eccentric":"3s lower without pelvis rotation.","concentric":"Press through mid-foot; fix asymmetries.","safety":"Do not lock knee aggressively."}'::jsonb,
    array['full_gym'],
    3, 12, 'squat',
    'quadriceps',
    array['glutes', 'adductors'],
    2, 'moderate_knee_stress', false
  ),
  (
    'walking_lunge',
    'Walking Lunge',
    '{"setup":"Torso tall, long stride, dumbbells at sides optional.","eccentric":"Soft rear knee touch.","concentric":"Drive front heel; alternate.","safety":"Clear path; control knee valgus."}'::jsonb,
    array['dumbbells', 'bodyweight', 'full_gym'],
    3, 12, 'lunge',
    'quadriceps',
    array['glutes', 'adductors'],
    3, 'moderate_knee_stress', false
  ),
  (
    'seated_calf_raise',
    'Seated Calf Raise',
    '{"setup":"Pad on knees, balls of feet on edge, full stretch at bottom.","eccentric":"3s lower to soleus stretch.","concentric":"Rise to peak; pause.","safety":"Soleus-biased hypertrophy."}'::jsonb,
    array['full_gym'],
    4, 15, 'isolation',
    'calves',
    array[]::text[],
    1, 'low_impact', true
  ),
  (
    'standing_calf_raise',
    'Standing Calf Raise',
    '{"setup":"Gastrocnemius bias — legs straight, full ROM.","eccentric":"3s lower to stretch.","concentric":"Peak contraction at top.","safety":"Use machine or step for ROM."}'::jsonb,
    array['full_gym', 'bodyweight'],
    4, 12, 'isolation',
    'calves',
    array[]::text[],
    2, 'low_impact', true
  ),
  (
    'dumbbell_shrug',
    'Dumbbell Shrug',
    '{"setup":"Arms straight, traps set, no rolling.","eccentric":"3s lower fully.","concentric":"Shrug straight up; pause.","safety":"Avoid if cervical issues."}'::jsonb,
    array['dumbbells', 'full_gym'],
    3, 12, 'isolation',
    'traps',
    array['forearms'],
    2, 'cervical_load', false
  ),
  (
    'overhead_press',
    'Standing Overhead Press',
    '{"setup":"Rack grip, glutes tight, ribs down, chin back.","eccentric":"Bar to clavicle without excessive lean.","concentric":"Press vertical; head through at lockout.","safety":"Skip if active impingement."}'::jsonb,
    array['barbell', 'dumbbells', 'full_gym'],
    4, 8, 'push',
    'front_delts',
    array['triceps', 'upper_chest', 'core'],
    4, 'rotator_cuff_heavy', false
  ),
  (
    'push_up',
    'Push-Up (Deficit Optional)',
    '{"setup":"Hands under shoulders, full plank, optional handles for depth.","eccentric":"3s lower, chest stretch at bottom.","concentric":"Press to lockout.","regression":"Incline push-up."}'::jsonb,
    array['bodyweight'],
    4, 12, 'push',
    'chest',
    array['triceps', 'front_delts', 'core'],
    2, 'low_impact', true
  )
on conflict (slug) do update set
  name = excluded.name,
  biomechanical_instructions = excluded.biomechanical_instructions,
  equipment_required = excluded.equipment_required,
  default_sets = excluded.default_sets,
  default_reps = excluded.default_reps,
  movement_pattern = excluded.movement_pattern,
  primary_muscle = excluded.primary_muscle,
  synergist_muscles = excluded.synergist_muscles,
  cns_fatigue_cost = excluded.cns_fatigue_cost,
  joint_stress_profile = excluded.joint_stress_profile,
  stretch_mediated_hypertrophy = excluded.stretch_mediated_hypertrophy;
