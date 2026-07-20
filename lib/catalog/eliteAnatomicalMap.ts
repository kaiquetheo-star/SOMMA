/**
 * Mapeamento anatômico dos 49 exercícios Elite → MuscleSubGroup.
 * Mantido fora de eliteCatalog.ts (gerado do seed) para sobreviver a regenerações.
 */
import type { MuscleSubGroup } from '@/lib/gameplan/engine/iron/anatomicalDivision';

export interface EliteAnatomicalMapping {
  muscle_sub_groups: readonly MuscleSubGroup[];
  primary_sub_group: MuscleSubGroup;
  synergist_sub_groups: readonly MuscleSubGroup[];
}

export const ELITE_ANATOMICAL_MAP: Readonly<Record<string, EliteAnatomicalMapping>> = {
  deficit_bulgarian_split_squat: {
    muscle_sub_groups: ['quadriceps_vastus_med', 'quadriceps_rectus'],
    primary_sub_group: 'quadriceps_vastus_med',
    synergist_sub_groups: ['gluteus_maximus', 'adductors', 'rectus_abdominis'],
  },
  hack_squat_machine: {
    muscle_sub_groups: ['quadriceps_vastus_lat', 'quadriceps_vastus_med'],
    primary_sub_group: 'quadriceps_vastus_lat',
    synergist_sub_groups: ['gluteus_maximus'],
  },
  pendulum_squat: {
    muscle_sub_groups: ['quadriceps_vastus_lat', 'quadriceps_vastus_med', 'quadriceps_rectus'],
    primary_sub_group: 'quadriceps_vastus_lat',
    synergist_sub_groups: ['gluteus_maximus'],
  },
  belt_squat: {
    muscle_sub_groups: ['quadriceps_vastus_lat', 'quadriceps_vastus_med'],
    primary_sub_group: 'quadriceps_vastus_lat',
    synergist_sub_groups: ['gluteus_maximus', 'adductors'],
  },
  barbell_back_squat: {
    muscle_sub_groups: ['quadriceps_vastus_lat', 'quadriceps_vastus_med', 'quadriceps_rectus'],
    primary_sub_group: 'quadriceps_vastus_lat',
    synergist_sub_groups: ['gluteus_maximus', 'erector_spinae', 'adductors'],
  },
  sissy_squat: {
    muscle_sub_groups: ['quadriceps_rectus'],
    primary_sub_group: 'quadriceps_rectus',
    synergist_sub_groups: ['rectus_abdominis'],
  },
  leg_extension: {
    muscle_sub_groups: ['quadriceps_rectus', 'quadriceps_vastus_med'],
    primary_sub_group: 'quadriceps_rectus',
    synergist_sub_groups: [],
  },
  seated_leg_curl: {
    muscle_sub_groups: ['hamstrings_semi', 'hamstrings_biceps_fem'],
    primary_sub_group: 'hamstrings_semi',
    synergist_sub_groups: ['calves_gastrocnemius'],
  },
  nordic_curl: {
    muscle_sub_groups: ['hamstrings_biceps_fem', 'hamstrings_semi'],
    primary_sub_group: 'hamstrings_biceps_fem',
    synergist_sub_groups: ['gluteus_maximus', 'calves_gastrocnemius'],
  },
  barbell_romanian_deadlift: {
    muscle_sub_groups: ['hamstrings_biceps_fem', 'hamstrings_semi'],
    primary_sub_group: 'hamstrings_biceps_fem',
    synergist_sub_groups: ['gluteus_maximus', 'erector_spinae'],
  },
  dumbbell_romanian_deadlift: {
    muscle_sub_groups: ['hamstrings_biceps_fem', 'hamstrings_semi'],
    primary_sub_group: 'hamstrings_biceps_fem',
    synergist_sub_groups: ['gluteus_maximus', 'erector_spinae'],
  },
  stiff_leg_deadlift: {
    muscle_sub_groups: ['hamstrings_semi', 'hamstrings_biceps_fem'],
    primary_sub_group: 'hamstrings_semi',
    synergist_sub_groups: ['gluteus_maximus', 'erector_spinae'],
  },
  conventional_deadlift: {
    muscle_sub_groups: ['erector_spinae'],
    primary_sub_group: 'erector_spinae',
    synergist_sub_groups: [
      'gluteus_maximus',
      'hamstrings_biceps_fem',
      'quadriceps_vastus_lat',
      'trapezius_upper',
    ],
  },
  rack_pull: {
    muscle_sub_groups: ['erector_spinae', 'trapezius_upper'],
    primary_sub_group: 'erector_spinae',
    synergist_sub_groups: ['gluteus_maximus', 'hamstrings_biceps_fem', 'trapezius_middle'],
  },
  barbell_hip_hinge_good_morning: {
    muscle_sub_groups: ['hamstrings_biceps_fem', 'erector_spinae'],
    primary_sub_group: 'hamstrings_biceps_fem',
    synergist_sub_groups: ['gluteus_maximus'],
  },
  hip_thrust_barbell: {
    muscle_sub_groups: ['gluteus_maximus'],
    primary_sub_group: 'gluteus_maximus',
    synergist_sub_groups: ['hamstrings_semi', 'rectus_abdominis'],
  },
  cable_kickback_glute: {
    muscle_sub_groups: ['gluteus_maximus', 'gluteus_medius'],
    primary_sub_group: 'gluteus_maximus',
    synergist_sub_groups: ['hamstrings_biceps_fem'],
  },
  incline_dumbbell_press_30: {
    muscle_sub_groups: ['chest_incline'],
    primary_sub_group: 'chest_incline',
    synergist_sub_groups: ['shoulder_anterior', 'triceps_long_head'],
  },
  incline_cable_fly: {
    muscle_sub_groups: ['chest_incline'],
    primary_sub_group: 'chest_incline',
    synergist_sub_groups: ['shoulder_anterior'],
  },
  barbell_bench_press: {
    muscle_sub_groups: ['chest_horizontal'],
    primary_sub_group: 'chest_horizontal',
    synergist_sub_groups: ['shoulder_anterior', 'triceps_lateral_head'],
  },
  close_grip_bench_press: {
    muscle_sub_groups: ['triceps_medial_head', 'triceps_lateral_head', 'triceps_long_head'],
    primary_sub_group: 'triceps_medial_head',
    synergist_sub_groups: ['chest_horizontal', 'shoulder_anterior'],
  },
  dumbbell_fly_flat: {
    muscle_sub_groups: ['chest_horizontal'],
    primary_sub_group: 'chest_horizontal',
    synergist_sub_groups: ['shoulder_anterior'],
  },
  landmine_press: {
    muscle_sub_groups: ['chest_incline', 'shoulder_anterior'],
    primary_sub_group: 'chest_incline',
    synergist_sub_groups: ['triceps_lateral_head', 'rectus_abdominis'],
  },
  iliac_lat_pulldown: {
    muscle_sub_groups: ['back_vertical'],
    primary_sub_group: 'back_vertical',
    synergist_sub_groups: ['back_horizontal', 'biceps_long_head', 'shoulder_posterior'],
  },
  chest_supported_row: {
    muscle_sub_groups: ['back_horizontal'],
    primary_sub_group: 'back_horizontal',
    synergist_sub_groups: ['back_vertical', 'shoulder_posterior', 'biceps_short_head'],
  },
  pendlay_row: {
    muscle_sub_groups: ['back_horizontal'],
    primary_sub_group: 'back_horizontal',
    synergist_sub_groups: ['back_vertical', 'shoulder_posterior', 'erector_spinae'],
  },
  t_bar_row: {
    muscle_sub_groups: ['back_horizontal'],
    primary_sub_group: 'back_horizontal',
    synergist_sub_groups: ['back_vertical', 'biceps_short_head', 'erector_spinae'],
  },
  dumbbell_row: {
    muscle_sub_groups: ['back_vertical', 'back_horizontal'],
    primary_sub_group: 'back_vertical',
    synergist_sub_groups: ['biceps_long_head', 'shoulder_posterior'],
  },
  neutral_grip_pull_up: {
    muscle_sub_groups: ['back_vertical'],
    primary_sub_group: 'back_vertical',
    synergist_sub_groups: ['biceps_long_head', 'back_horizontal', 'rectus_abdominis'],
  },
  pull_up_overhand: {
    muscle_sub_groups: ['back_vertical'],
    primary_sub_group: 'back_vertical',
    synergist_sub_groups: ['biceps_long_head', 'back_horizontal'],
  },
  cable_pull_over: {
    muscle_sub_groups: ['back_vertical'],
    primary_sub_group: 'back_vertical',
    synergist_sub_groups: ['chest_decline', 'triceps_long_head'],
  },
  cable_lateral_raise: {
    muscle_sub_groups: ['shoulder_lateral'],
    primary_sub_group: 'shoulder_lateral',
    synergist_sub_groups: ['trapezius_upper'],
  },
  reverse_pec_deck: {
    muscle_sub_groups: ['shoulder_posterior'],
    primary_sub_group: 'shoulder_posterior',
    synergist_sub_groups: ['trapezius_middle', 'back_horizontal'],
  },
  face_pull: {
    muscle_sub_groups: ['shoulder_posterior'],
    primary_sub_group: 'shoulder_posterior',
    synergist_sub_groups: ['trapezius_middle', 'trapezius_upper'],
  },
  machine_shoulder_press: {
    muscle_sub_groups: ['shoulder_anterior'],
    primary_sub_group: 'shoulder_anterior',
    synergist_sub_groups: ['triceps_lateral_head', 'chest_incline'],
  },
  bayesian_curl: {
    muscle_sub_groups: ['biceps_long_head'],
    primary_sub_group: 'biceps_long_head',
    synergist_sub_groups: ['forearm_flexors'],
  },
  spider_curl: {
    muscle_sub_groups: ['biceps_short_head'],
    primary_sub_group: 'biceps_short_head',
    synergist_sub_groups: ['forearm_flexors'],
  },
  preacher_curl_machine: {
    muscle_sub_groups: ['biceps_short_head'],
    primary_sub_group: 'biceps_short_head',
    synergist_sub_groups: ['forearm_flexors'],
  },
  hammer_curl_incline: {
    muscle_sub_groups: ['brachialis', 'biceps_long_head'],
    primary_sub_group: 'brachialis',
    synergist_sub_groups: ['forearm_flexors'],
  },
  tricep_rope_pushdown: {
    muscle_sub_groups: ['triceps_lateral_head'],
    primary_sub_group: 'triceps_lateral_head',
    synergist_sub_groups: [],
  },
  ez_bar_skullcrusher: {
    muscle_sub_groups: ['triceps_long_head'],
    primary_sub_group: 'triceps_long_head',
    synergist_sub_groups: [],
  },
  smith_machine_split_squat: {
    muscle_sub_groups: ['quadriceps_vastus_med', 'quadriceps_rectus'],
    primary_sub_group: 'quadriceps_vastus_med',
    synergist_sub_groups: ['gluteus_maximus'],
  },
  single_leg_leg_press: {
    muscle_sub_groups: ['quadriceps_vastus_lat', 'quadriceps_vastus_med'],
    primary_sub_group: 'quadriceps_vastus_lat',
    synergist_sub_groups: ['gluteus_maximus', 'adductors'],
  },
  walking_lunge: {
    muscle_sub_groups: ['quadriceps_vastus_med', 'quadriceps_rectus'],
    primary_sub_group: 'quadriceps_vastus_med',
    synergist_sub_groups: ['gluteus_maximus', 'adductors'],
  },
  seated_calf_raise: {
    muscle_sub_groups: ['calves_soleus'],
    primary_sub_group: 'calves_soleus',
    synergist_sub_groups: [],
  },
  standing_calf_raise: {
    muscle_sub_groups: ['calves_gastrocnemius'],
    primary_sub_group: 'calves_gastrocnemius',
    synergist_sub_groups: [],
  },
  dumbbell_shrug: {
    muscle_sub_groups: ['trapezius_upper'],
    primary_sub_group: 'trapezius_upper',
    synergist_sub_groups: ['forearm_flexors'],
  },
  overhead_press: {
    muscle_sub_groups: ['shoulder_anterior'],
    primary_sub_group: 'shoulder_anterior',
    synergist_sub_groups: ['triceps_lateral_head', 'chest_incline', 'rectus_abdominis'],
  },
  push_up: {
    muscle_sub_groups: ['chest_horizontal'],
    primary_sub_group: 'chest_horizontal',
    synergist_sub_groups: ['triceps_lateral_head', 'shoulder_anterior', 'rectus_abdominis'],
  },
};

export function resolveEliteAnatomicalMapping(slug: string): EliteAnatomicalMapping | null {
  return ELITE_ANATOMICAL_MAP[slug] ?? null;
}
