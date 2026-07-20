import type { LibraryExercise } from '@/types/catalog';

export type SlotCategory =
  | 'chest_horizontal_press'
  | 'chest_incline_press'
  | 'chest_fly'
  | 'triceps_overhead'
  | 'triceps_pushdown'
  | 'back_vertical_pull'
  | 'back_horizontal_row'
  | 'biceps_curl_long_head'
  | 'biceps_curl_short_head'
  | 'biceps_hammer'
  | 'quad_compound'
  | 'quad_isolation'
  | 'adductor'
  | 'calf_raise'
  | 'shoulder_overhead_press'
  | 'shoulder_lateral_raise'
  | 'shoulder_posterior_fly'
  | 'shoulder_anterior_raise'
  | 'trap_shrug'
  | 'biceps_curl'
  | 'triceps_extension'
  | 'forearm_isolation'
  | 'core_anti_extension'
  | 'core_rotation'
  | 'hinge_compound'
  | 'hamstring_curl'
  | 'glute_isolation'
  | 'calf_raise_seated';

const ELITE_SLOT_OVERRIDES: Record<string, SlotCategory> = {
  reverse_pec_deck: 'shoulder_posterior_fly',
  face_pull: 'shoulder_posterior_fly',
  cable_lateral_raise: 'shoulder_lateral_raise',
  dumbbell_shrug: 'trap_shrug',
  incline_dumbbell_press_30: 'chest_incline_press',
  incline_cable_fly: 'chest_fly',
  dumbbell_fly_flat: 'chest_fly',
  barbell_bench_press: 'chest_horizontal_press',
  seated_leg_curl: 'hamstring_curl',
  nordic_curl: 'hamstring_curl',
  barbell_romanian_deadlift: 'hinge_compound',
  dumbbell_romanian_deadlift: 'hinge_compound',
  stiff_leg_deadlift: 'hinge_compound',
  conventional_deadlift: 'hinge_compound',
  hip_thrust_barbell: 'glute_isolation',
  // Curl names contain "bench"/"machine" which otherwise false-hit chest/back heuristics.
  spider_curl: 'biceps_curl_short_head',
  preacher_curl_machine: 'biceps_curl_short_head',
  hammer_curl_incline: 'biceps_hammer',
  bayesian_curl: 'biceps_curl_long_head',
};

function exerciseSearchText(exercise: Pick<LibraryExercise, 'slug' | 'name'>): string {
  return `${exercise.slug} ${exercise.name}`.toLowerCase().replace(/[-\s]+/g, '_');
}

/** Deterministic slot inference for Elite (and any LibraryExercise) offline rows. */
export function inferSlotCategory(exercise: LibraryExercise): SlotCategory {
  const override = ELITE_SLOT_OVERRIDES[exercise.slug];
  if (override) return override;

  const text = exerciseSearchText(exercise);
  const primary = exercise.primary_muscle?.toLowerCase().replace(/[-\s]+/g, '_') ?? '';
  const pattern = exercise.movement_pattern;

  if (
    primary === 'shoulders' ||
    primary === 'delts' ||
    primary === 'front_delts' ||
    primary === 'side_delts' ||
    primary === 'rear_delts'
  ) {
    if (/rear|reverse|face_pull|posterior|delt_fly|pec_deck/.test(text) || primary === 'rear_delts') {
      return 'shoulder_posterior_fly';
    }
    if (/lateral|side/.test(text) || primary === 'side_delts') return 'shoulder_lateral_raise';
    if (/press|overhead|military|arnold|landmine/.test(text) || primary === 'front_delts') {
      return 'shoulder_overhead_press';
    }
    return 'shoulder_lateral_raise';
  }

  // Biceps before chest/back: names like "Spider Curl (Incline Bench)" and
  // "Preacher Curl (Machine)" false-hit /bench/ and /chin/ (inside "machine").
  if (primary === 'biceps' || /bicep|curl/.test(text)) {
    if (/hammer/.test(text)) return 'biceps_hammer';
    // Short-head variants before incline (spider often uses an incline bench).
    if (/preacher|spider|concentration/.test(text)) return 'biceps_curl_short_head';
    if (/incline|bayesian|drag/.test(text)) return 'biceps_curl_long_head';
    return 'biceps_curl';
  }

  if (primary === 'chest' || primary === 'upper_chest' || /chest|pec|bench|flye?/.test(text)) {
    if (/incline|upper_chest/.test(text) && !/fly/.test(text)) return 'chest_incline_press';
    if (pattern === 'isolation' || /fly|flye|pec_deck|crossover/.test(text)) return 'chest_fly';
    return 'chest_horizontal_press';
  }

  if (primary === 'triceps' || /tricep|triceps|pushdown|pressdown|skull|dip/.test(text)) {
    if (/pushdown|pressdown/.test(text)) return 'triceps_pushdown';
    if (/overhead|skull|lying|french|extension/.test(text)) return 'triceps_overhead';
    return 'triceps_extension';
  }

  if (
    primary === 'lats' ||
    primary === 'back' ||
    primary === 'mid_back' ||
    /(^|_)lat(s?|issimus)(_|$)|pull_?down|pull_?up|chin_?up|chinup|(^|_)row(s)?(_|$)/.test(text)
  ) {
    if (/pull_?down|pull_?up|chin_?up|chinup/.test(text)) return 'back_vertical_pull';
    return 'back_horizontal_row';
  }

  if (primary === 'traps' || /trap|shrug/.test(text)) return 'trap_shrug';

  if (
    primary === 'quads' ||
    primary === 'quadriceps' ||
    pattern === 'squat' ||
    pattern === 'lunge' ||
    /squat|lunge|leg_press|hack|pendulum|bulgarian|split/.test(text)
  ) {
    if (pattern === 'isolation' || /extension/.test(text)) return 'quad_isolation';
    return 'quad_compound';
  }

  if (primary === 'adductors' || /adductor|inner_thigh/.test(text)) return 'adductor';

  if (
    primary === 'hamstrings' ||
    pattern === 'hinge' ||
    /deadlift|rdl|romanian|hinge|leg_curl|hamstring.*curl/.test(text)
  ) {
    if (/leg_curl|hamstring.*curl|nordic/.test(text) && pattern === 'isolation') return 'hamstring_curl';
    return 'hinge_compound';
  }

  if (primary === 'glutes' || /glute|hip_thrust|kickback|pull_through|abduction/.test(text)) {
    if (pattern === 'hinge' && /hip_thrust|bridge/.test(text)) return 'glute_isolation';
    return pattern === 'hinge' ? 'hinge_compound' : 'glute_isolation';
  }

  if (primary === 'calves' || /calf|calves/.test(text)) {
    return /seated/.test(text) ? 'calf_raise_seated' : 'calf_raise';
  }

  if (primary === 'forearms' || /forearm|wrist|reverse_curl/.test(text)) return 'forearm_isolation';

  return 'core_anti_extension';
}
