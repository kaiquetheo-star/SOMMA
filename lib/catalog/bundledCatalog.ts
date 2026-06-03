import type {
  CatalogExercise,
  IntensityTechnique,
  LibraryExercise,
  MovementPattern,
} from '@/types/catalog';
import { IntensityTechnique as Technique } from '@/types/catalog';
import { enrichExerciseWithCues } from '@/lib/catalog/biomechanicalMapper';
import { normalizePrimaryMuscle } from '@/lib/catalog/primaryMuscle';

function iron(
  slug: string,
  name: string,
  primaryMuscle: string,
  movementPattern: MovementPattern,
  equipment: string[] = ['barbell', 'dumbbells', 'full_gym'],
  options?: {
    cns?: number;
    stretch?: boolean;
    intensity?: IntensityTechnique[];
    requiresLoading?: boolean;
  },
): LibraryExercise {
  const cns =
    options?.cns ??
    (movementPattern === 'squat' || movementPattern === 'hinge' ? 5 : movementPattern === 'isolation' ? 2 : 4);

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
    default_reps: movementPattern === 'isolation' ? 12 : 8,
    movement_pattern: movementPattern,
    primary_muscle: normalizePrimaryMuscle(primaryMuscle) ?? primaryMuscle,
    synergist_muscles: [],
    cns_fatigue_cost: cns,
    joint_stress_profile: null,
    stretch_mediated_hypertrophy: options?.stretch ?? /fly|pullover|curl/.test(slug),
    intensity_compatibility:
      options?.intensity ??
      (movementPattern === 'isolation'
        ? [Technique.MYO_REPS, Technique.DROP_SET, Technique.BI_SET_SAME_MUSCLE]
        : [Technique.STANDARD]),
    requires_loading: options?.requiresLoading ?? false,
  };
}

const BUNDLED_EXERCISES: LibraryExercise[] = [
  // —— Push / chest compounds ——
  iron('barbell_bench_press', 'Barbell Bench Press', 'chest', 'push'),
  iron('dumbbell_bench_press', 'Dumbbell Bench Press', 'chest', 'push', ['dumbbells', 'full_gym']),
  iron('barbell_incline_bench_press', 'Barbell Incline Bench Press', 'chest', 'push'),
  iron('dumbbell_incline_press', 'Dumbbell Incline Press', 'chest', 'push', ['dumbbells', 'full_gym']),
  iron('decline_barbell_bench', 'Decline Barbell Bench Press', 'chest', 'push'),
  iron('machine_chest_press', 'Machine Chest Press', 'chest', 'push', ['full_gym'], {
    intensity: [Technique.REST_PAUSE],
  }),
  iron('push_up', 'Push-Up', 'chest', 'push', ['bodyweight', 'full_gym'], {
    cns: 2,
    requiresLoading: true,
  }),

  // —— Push / shoulders ——
  iron('barbell_overhead_press', 'Barbell Overhead Press', 'shoulders', 'push'),
  iron('overhead_press', 'Standing Overhead Press', 'shoulders', 'push'),
  iron('dumbbell_shoulder_press', 'Dumbbell Shoulder Press', 'shoulders', 'push', ['dumbbells', 'full_gym']),
  iron('arnold_press', 'Arnold Press', 'shoulders', 'push', ['dumbbells', 'full_gym'], { cns: 3 }),
  iron('landmine_press', 'Landmine Press', 'shoulders', 'push', ['barbell', 'full_gym'], { cns: 3 }),

  // —— Push / isolations ——
  iron('cable_fly', 'Cable Fly', 'chest', 'isolation', ['full_gym'], {
    stretch: true,
    intensity: [Technique.DROP_SET, Technique.PRE_EXHAUST, Technique.MYO_REPS],
  }),
  iron('dumbbell_fly', 'Dumbbell Fly', 'chest', 'isolation', ['dumbbells', 'full_gym'], {
    stretch: true,
    intensity: [Technique.DROP_SET, Technique.PRE_EXHAUST, Technique.MYO_REPS],
  }),
  iron('pec_deck', 'Pec Deck Fly', 'chest', 'isolation', ['full_gym'], {
    stretch: true,
    intensity: [Technique.DROP_SET, Technique.PRE_EXHAUST, Technique.MYO_REPS],
  }),
  iron('lateral_raise', 'Lateral Raise', 'shoulders', 'isolation', ['dumbbells', 'full_gym']),
  iron('cable_lateral_raise', 'Cable Lateral Raise', 'shoulders', 'isolation', ['full_gym']),
  iron('front_raise', 'Front Raise', 'shoulders', 'isolation', ['dumbbells', 'full_gym']),
  iron('cable_pushdown', 'Cable Triceps Pushdown', 'triceps', 'isolation', ['full_gym']),
  iron('cable_pushdown_with_rope_attachment', 'Rope Triceps Pushdown', 'triceps', 'isolation', ['full_gym']),
  iron('skullcrusher', 'EZ-Bar Skullcrusher', 'triceps', 'isolation', ['barbell', 'full_gym']),
  iron('overhead_tricep_extension', 'Overhead Triceps Extension', 'triceps', 'isolation', ['dumbbells', 'full_gym']),
  iron('dip', 'Parallel Bar Dip', 'triceps', 'push', ['bodyweight', 'full_gym'], { cns: 3 }),

  // —— Pull / back compounds ——
  iron('barbell_bent_over_row', 'Barbell Bent-Over Row', 'back', 'pull'),
  iron('pendlay_row', 'Pendlay Row', 'back', 'pull'),
  iron('dumbbell_row', 'Single-Arm Dumbbell Row', 'back', 'pull', ['dumbbells', 'full_gym']),
  iron('chest_supported_row', 'Chest-Supported Row', 'back', 'pull', ['full_gym', 'dumbbells']),
  iron('cable_bar_lateral_pulldown', 'Lat Pulldown', 'back', 'pull', ['full_gym']),
  iron('lat_pulldown', 'Wide-Grip Lat Pulldown', 'back', 'pull', ['full_gym']),
  iron('pull_up', 'Pull-Up', 'back', 'pull', ['bodyweight', 'pull_up_bar', 'full_gym'], {
    cns: 4,
    intensity: [Technique.REST_PAUSE],
    requiresLoading: true,
  }),
  iron('chin_up', 'Chin-Up', 'back', 'pull', ['bodyweight', 'pull_up_bar', 'full_gym'], {
    cns: 4,
    intensity: [Technique.REST_PAUSE],
    requiresLoading: true,
  }),
  iron('seated_cable_row', 'Seated Cable Row', 'back', 'pull', ['full_gym']),
  iron('t_bar_row', 'T-Bar Row', 'back', 'pull', ['barbell', 'full_gym'], { cns: 4 }),

  // —— Pull / isolations ——
  iron('reverse_dumbbell_fly', 'Reverse Dumbbell Fly', 'rear delt', 'isolation', ['dumbbells', 'full_gym']),
  iron('dumbbell_reverse_fly', 'Dumbbell Reverse Fly', 'rear delt', 'isolation', ['dumbbells']),
  iron('face_pull', 'Cable Face Pull', 'rear delt', 'isolation', ['full_gym']),
  iron('barbell_curl', 'Barbell Curl', 'biceps', 'isolation', ['barbell', 'full_gym']),
  iron('ez_bar_curl', 'EZ-Bar Curl', 'biceps', 'isolation', ['barbell', 'full_gym']),
  iron('hammer_curl', 'Hammer Curl', 'biceps', 'isolation', ['dumbbells', 'full_gym']),
  iron('dumbbell_hammer_curl', 'Dumbbell Hammer Curl', 'biceps', 'isolation', ['dumbbells']),
  iron('incline_dumbbell_curl', 'Incline Dumbbell Curl', 'biceps', 'isolation', ['dumbbells', 'full_gym'], {
    stretch: true,
  }),
  iron('preacher_curl', 'Preacher Curl', 'biceps', 'isolation', ['full_gym', 'barbell']),

  // —— Squat / quad ——
  iron('barbell_squat', 'Barbell Back Squat', 'quads', 'squat'),
  iron('front_squat', 'Front Squat', 'quads', 'squat', ['barbell', 'full_gym'], { cns: 5 }),
  iron('goblet_squat', 'Goblet Squat', 'quads', 'squat', ['dumbbells', 'kettlebell', 'full_gym'], { cns: 3 }),
  iron('leg_press', 'Leg Press', 'quads', 'squat', ['full_gym'], {
    cns: 4,
    intensity: [Technique.REST_PAUSE],
  }),
  iron('hack_squat', 'Hack Squat', 'quads', 'squat', ['full_gym'], {
    cns: 4,
    intensity: [Technique.REST_PAUSE],
  }),
  iron('bulgarian_split_squat', 'Bulgarian Split Squat', 'quads', 'lunge', ['dumbbells', 'full_gym'], { cns: 4 }),
  iron('walking_lunge', 'Walking Lunge', 'quads', 'lunge', ['dumbbells', 'bodyweight', 'full_gym'], { cns: 3 }),
  iron('leg_extension', 'Leg Extension', 'quads', 'isolation', ['full_gym'], {
    intensity: [Technique.DROP_SET, Technique.PRE_EXHAUST, Technique.BI_SET_SAME_MUSCLE],
  }),

  // —— Hinge / posterior ——
  iron('conventional_deadlift', 'Conventional Deadlift', 'hamstrings', 'hinge'),
  iron('romanian_deadlift', 'Romanian Deadlift', 'hamstrings', 'hinge'),
  iron('trap_bar_deadlift', 'Trap-Bar Deadlift', 'hamstrings', 'hinge', ['barbell', 'full_gym'], { cns: 5 }),
  iron('hip_thrust', 'Barbell Hip Thrust', 'glutes', 'hinge', ['barbell', 'full_gym'], { cns: 4 }),
  iron('back_extension', '45° Back Extension', 'back', 'hinge', ['full_gym', 'bodyweight'], { cns: 2 }),
  iron('leg_curl', 'Lying Leg Curl', 'hamstrings', 'isolation', ['full_gym'], { stretch: true }),
  iron('seated_leg_curl', 'Seated Leg Curl', 'hamstrings', 'isolation', ['full_gym'], { stretch: true }),

  // —— Calves / carry ——
  iron('barbell_seated_calf_raise', 'Seated Calf Raise', 'calves', 'isolation', ['full_gym', 'barbell']),
  iron('standing_calf_raise', 'Standing Calf Raise', 'calves', 'isolation', ['bodyweight', 'full_gym']),
  iron('farmers_walk', 'Farmer Carry', 'back', 'carry', ['dumbbells', 'kettlebell', 'full_gym'], { cns: 3 }),
  iron('suitcase_carry', 'Suitcase Carry', 'core', 'carry', ['dumbbells', 'kettlebell', 'full_gym'], { cns: 2 }),

  // —— Core / mobility ——
  iron('abdominal_crunch', 'Abdominal Crunch', 'core', 'isolation', ['bodyweight', 'full_gym']),
  iron('cable_crunch', 'Cable Crunch', 'core', 'isolation', ['full_gym']),
  iron('hanging_leg_raise', 'Hanging Leg Raise', 'core', 'isolation', ['pull_up_bar', 'full_gym'], { cns: 2 }),
  iron('pallof_press', 'Pallof Press', 'core', 'isolation', ['full_gym']),
  iron('plank', 'Plank Hold', 'core', 'isolation', ['bodyweight'], { cns: 1 }),
  iron('dead_bug', 'Dead Bug', 'core', 'isolation', ['bodyweight'], { cns: 1 }),
  iron('squat_malasana', 'Malasana Squat', 'glutes', 'squat', ['bodyweight'], { cns: 1 }),
  iron('sphinx', 'Sphinx Pose', 'chest', 'isolation', ['bodyweight'], { cns: 1 }),
];

export function getBundledExercises(): CatalogExercise[] {
  return BUNDLED_EXERCISES.map(enrichExerciseWithCues);
}

export function getBundledExerciseCount(): number {
  return BUNDLED_EXERCISES.length;
}

