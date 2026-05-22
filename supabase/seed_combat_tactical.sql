-- Blood & Bone — tactical_focus + defensive cues + 15 elite combos
-- Run after 009_library_combat_tactical.sql (paste SQL only, no markdown)

insert into public.library_combat (slug, combo_name, sequence, complexity_level, tactical_focus) values
  (
    'fundamentals_jab_cross',
    'Fundamentals: Jab — Cross',
    '["Jab", "Slip Left", "Cross"]'::jsonb,
    2,
    'footwork_range'
  ),
  (
    'jab_cross_hook',
    'Jab — Cross — Lead Hook',
    '["Jab", "Cross", "Hook (Lead)", "Exit Left"]'::jsonb,
    3,
    'footwork_range'
  ),
  (
    'double_jab_cross',
    'Double Jab — Cross',
    '["Jab", "Jab", "Slip Outside", "Cross"]'::jsonb,
    3,
    'footwork_range'
  ),
  (
    'cross_hook_cross',
    'Cross — Hook — Cross',
    '["Cross", "Hook (Lead)", "Cross", "Low Kick (Lead)"]'::jsonb,
    4,
    'power_inside'
  ),
  (
    'low_kick_entry',
    'Low Kick Entry',
    '["Jab", "Cross", "Check Kick", "Low Kick (Lead)"]'::jsonb,
    5,
    'footwork_range'
  ),
  (
    'body_shot_setup',
    'Body Shot Setup',
    '["Jab to Body", "Cross to Head", "Hook to Body", "Roll Right"]'::jsonb,
    5,
    'power_inside'
  ),
  (
    'slip_counter',
    'Slip and Counter',
    '["Slip Left", "Cross", "Lead Hook", "Check Kick"]'::jsonb,
    6,
    'defense_counter'
  ),
  (
    'phantom_switch_elbow',
    'Phantom Switch to Elbow',
    '["Jab", "Cross", "Slip Outside", "Roll Right", "Rear Elbow"]'::jsonb,
    8,
    'defense_counter'
  ),
  (
    'teep_jab_cross',
    'Teep — Jab — Cross',
    '["Lead Teep", "Jab", "Slip Left", "Cross"]'::jsonb,
    6,
    'footwork_range'
  ),
  (
    'jab_cross_hook_low_kick_sprawl',
    'Full Chain: Jab — Cross — Hook — Low Kick — Sprawl',
    '["Jab", "Cross", "Hook", "Low Kick (Lead)", "Sprawl", "Slip Left"]'::jsonb,
    9,
    'burnout'
  ),
  (
    'range_jab_teep_ladder',
    'Range Ladder: Jab — Teep — Exit',
    '["Jab", "Lead Teep", "Slip Left", "Cross", "Exit Left"]'::jsonb,
    4,
    'footwork_range'
  ),
  (
    'lateral_angle_cut',
    'Lateral Angle Cut',
    '["Pivot Left", "Jab", "Cross", "Low Kick (Lead)", "Roll Right"]'::jsonb,
    5,
    'footwork_range'
  ),
  (
    'long_range_probe',
    'Long Range Probe',
    '["Probe Jab", "Slip Outside", "Cross", "Lead Teep", "Check Kick"]'::jsonb,
    6,
    'footwork_range'
  ),
  (
    'circle_off_reentry',
    'Circle Off — Re-entry',
    '["Slip Left", "Pivot Right", "Jab", "Cross", "Lead Teep"]'::jsonb,
    7,
    'footwork_range'
  ),
  (
    'southpaw_range_trap',
    'Southpaw Range Trap',
    '["Cross", "Lead Teep", "Slip Outside", "Hook (Lead)", "Exit Right"]'::jsonb,
    7,
    'footwork_range'
  ),
  (
    'inside_hook_upper',
    'Inside Hook — Uppercut',
    '["Jab to Body", "Lead Hook", "Cross", "Uppercut (Rear)"]'::jsonb,
    5,
    'power_inside'
  ),
  (
    'clinch_knee_exit',
    'Clinch Knee — Exit',
    '["Inside Tie", "Knee (Lead)", "Knee (Rear)", "Elbow (Rear)", "Cross"]'::jsonb,
    7,
    'power_inside'
  ),
  (
    'shovel_hook_burst',
    'Shovel Hook Burst',
    '["Shovel Hook", "Cross", "Hook (Lead)", "Low Kick (Rear)"]'::jsonb,
    6,
    'power_inside'
  ),
  (
    'liver_shot_finisher',
    'Liver Shot Finisher',
    '["Jab", "Cross to Body", "Left Hook to Body", "Uppercut (Lead)"]'::jsonb,
    7,
    'power_inside'
  ),
  (
    'muay_clinch_elbow',
    'Muay Clinch — Elbow',
    '["Inside Tie", "Knee (Lead)", "Elbow (Lead)", "Spin Elbow"]'::jsonb,
    8,
    'power_inside'
  ),
  (
    'slip_left_counter_cross',
    'Slip Left — Counter Cross',
    '["Slip Left", "Cross", "Hook (Lead)", "Low Kick (Lead)"]'::jsonb,
    6,
    'defense_counter'
  ),
  (
    'roll_right_overhand',
    'Roll Right — Overhand',
    '["Roll Right", "Overhand (Rear)", "Hook (Lead)", "Check Kick"]'::jsonb,
    7,
    'defense_counter'
  ),
  (
    'check_kick_catch_counter',
    'Check Kick — Catch Counter',
    '["Check Kick", "Catch Kick", "Cross", "Low Kick (Rear)"]'::jsonb,
    7,
    'defense_counter'
  ),
  (
    'parry_jab_cross_counter',
    'Parry — Cross Counter',
    '["Parry", "Cross to Body", "Hook (Lead)", "Slip Left"]'::jsonb,
    6,
    'defense_counter'
  ),
  (
    'high_guard_burst',
    'High Guard — Burst',
    '["High Guard", "Slip Outside", "Cross", "Uppercut (Lead)"]'::jsonb,
    6,
    'defense_counter'
  ),
  (
    'pull_counter_low_kick',
    'Pull Counter — Low Kick',
    '["Pull Right", "Cross", "Check Kick", "Low Kick (Lead)"]'::jsonb,
    8,
    'defense_counter'
  ),
  (
    'burnout_jab_flurry',
    'Burnout: Jab Flurry',
    '["Jab", "Jab", "Cross", "Slip Left", "Jab", "Sprawl"]'::jsonb,
    5,
    'burnout'
  ),
  (
    'burnout_kick_chain',
    'Burnout: Kick Chain',
    '["Low Kick (Lead)", "Low Kick (Rear)", "Check Kick", "Sprawl", "Jab"]'::jsonb,
    6,
    'burnout'
  ),
  (
    'burnout_shoulder_roll',
    'Burnout: Shoulder Roll',
    '["Roll Right", "Body Hook", "Uppercut (Lead)", "Sprawl"]'::jsonb,
    7,
    'burnout'
  ),
  (
    'burnout_defense_volume',
    'Burnout: Defense Volume',
    '["Slip Left", "Slip Right", "Roll Right", "Parry", "Jab", "Cross"]'::jsonb,
    8,
    'burnout'
  ),
  (
    'burnout_muay_cardio',
    'Burnout: Muay Cardio',
    '["Check Kick", "Lead Teep", "Jab", "Cross", "Sprawl", "Knee (Lead)"]'::jsonb,
    9,
    'burnout'
  )
on conflict (slug) do update set
  combo_name = excluded.combo_name,
  sequence = excluded.sequence,
  complexity_level = excluded.complexity_level,
  tactical_focus = excluded.tactical_focus;
