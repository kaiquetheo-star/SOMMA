import type {
  LibraryCombatCombo,
  LibraryExercise,
  LibraryFlowSpiritSession,
} from '@/types/catalog';

function iron(
  slug: string,
  name: string,
  primaryMuscle: string,
  equipment: string[] = ['barbell', 'dumbbells', 'full_gym'],
): LibraryExercise {
  return {
    id: `local-${slug}`,
    slug,
    name,
    biomechanical_instructions: {
      setup: 'Neutral spine, stable base.',
      concentric: 'Control the lift — full range.',
      eccentric: 'Lower under control (~2–3s).',
      safety: 'Stop if joint pain exceeds muscle fatigue.',
    },
    equipment_required: equipment,
    default_sets: 4,
    default_reps: 8,
    movement_pattern: null,
    primary_muscle: primaryMuscle,
    synergist_muscles: [],
    cns_fatigue_cost: slug.includes('squat') || slug.includes('deadlift') ? 5 : 3,
    joint_stress_profile: null,
    stretch_mediated_hypertrophy: slug.includes('fly'),
  };
}

const BUNDLED_EXERCISES: LibraryExercise[] = [
  iron('barbell_bench_press', 'Barbell Bench Press', 'chest'),
  iron('barbell_incline_bench_press', 'Barbell Incline Bench Press', 'chest'),
  iron('cable_fly', 'Cable Fly', 'chest', ['full_gym', 'dumbbells']),
  iron('overhead_press', 'Overhead Press', 'shoulders'),
  iron('barbell_overhead_press', 'Barbell Overhead Press', 'shoulders'),
  iron('cable_pushdown', 'Cable Triceps Pushdown', 'triceps', ['full_gym']),
  iron('cable_pushdown_with_rope_attachment', 'Rope Triceps Pushdown', 'triceps', ['full_gym']),
  iron('abdominal_crunch', 'Abdominal Crunch', 'core', ['bodyweight', 'full_gym']),
  iron('cable_bar_lateral_pulldown', 'Lat Pulldown', 'back', ['full_gym']),
  iron('barbell_bent_over_row', 'Barbell Bent-Over Row', 'back'),
  iron('reverse_dumbbell_fly', 'Reverse Dumbbell Fly', 'rear delts', ['dumbbells', 'full_gym']),
  iron('dumbbell_reverse_fly', 'Dumbbell Reverse Fly', 'rear delts', ['dumbbells']),
  iron('barbell_curl', 'Barbell Curl', 'biceps'),
  iron('hammer_curl', 'Hammer Curl', 'biceps', ['dumbbells']),
  iron('dumbbell_hammer_curl', 'Dumbbell Hammer Curl', 'biceps', ['dumbbells']),
  iron('barbell_squat', 'Barbell Back Squat', 'quads'),
  iron('leg_press', 'Leg Press', 'quads', ['full_gym']),
  iron('romanian_deadlift', 'Romanian Deadlift', 'hamstrings'),
  iron('leg_curl', 'Leg Curl', 'hamstrings', ['full_gym']),
  iron('barbell_seated_calf_raise', 'Seated Calf Raise', 'calves', ['full_gym', 'barbell']),
  iron('standing_calf_raise', 'Standing Calf Raise', 'calves', ['bodyweight', 'full_gym']),
  iron('squat_malasana', 'Malasana Squat', 'hips', ['bodyweight']),
  iron('sphinx', 'Sphinx Pose', 'chest', ['bodyweight']),
];

const BUNDLED_COMBAT: LibraryCombatCombo[] = [
  {
    id: 'local-combat-footwork',
    slug: 'footwork_shadow_1',
    combo_name: 'Footwork Shadow A',
    sequence: ['Jab', 'Cross', 'Slip', 'Hook'],
    complexity_level: 3,
    tactical_focus: 'footwork_range',
  },
  {
    id: 'local-combat-power',
    slug: 'power_inside_1',
    combo_name: 'Inside Power A',
    sequence: ['Uppercut', 'Hook', 'Knee'],
    complexity_level: 4,
    tactical_focus: 'power_inside',
  },
  {
    id: 'local-combat-defense',
    slug: 'defense_counter_1',
    combo_name: 'Defense Counter A',
    sequence: ['Parry', 'Cross', 'Low kick'],
    complexity_level: 4,
    tactical_focus: 'defense_counter',
  },
  {
    id: 'local-combat-burnout',
    slug: 'burnout_1',
    combo_name: 'Burnout Finisher',
    sequence: ['Jab', 'Jab', 'Cross', 'Sprawl'],
    complexity_level: 5,
    tactical_focus: 'burnout',
  },
];

const BUNDLED_FLOW_SPIRIT: LibraryFlowSpiritSession[] = [
  {
    id: 'local-flow-recovery',
    slug: 'flow_recovery_malasana',
    pillar: 'flow',
    session_name: 'Hip Recovery Flow',
    description: '48h healer flow',
    duration_minutes: 15,
    tempo_profile: {},
    complexity_level: 2,
    target_recovery_zones: ['hips', 'thoracic'],
    complexity_tier: 1,
    is_dynamic_flow: true,
    default_hold_seconds: 45,
  },
  {
    id: 'local-spirit-breath',
    slug: 'spirit_box_breath',
    pillar: 'spirit',
    session_name: 'Box Breathwork',
    description: 'Parasympathetic reset',
    duration_minutes: 12,
    tempo_profile: { inhale: 4, hold: 4, exhale: 4 },
    complexity_level: 1,
    target_recovery_zones: ['nervous_system'],
    complexity_tier: 1,
    is_dynamic_flow: false,
    default_hold_seconds: 0,
  },
  {
    id: 'local-spirit-nsdr',
    slug: 'spirit_nsdr',
    pillar: 'spirit',
    session_name: 'NSDR Body Scan',
    description: 'Down-regulation',
    duration_minutes: 20,
    tempo_profile: {},
    complexity_level: 1,
    target_recovery_zones: ['sleep', 'recovery'],
    complexity_tier: 1,
    is_dynamic_flow: false,
    default_hold_seconds: 0,
  },
];

export function getBundledExercises(): LibraryExercise[] {
  return BUNDLED_EXERCISES;
}

export function getBundledCombat(): LibraryCombatCombo[] {
  return BUNDLED_COMBAT;
}

export function getBundledFlowSpirit(): LibraryFlowSpiritSession[] {
  return BUNDLED_FLOW_SPIRIT;
}
