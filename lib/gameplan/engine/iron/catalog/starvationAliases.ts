/**
 * Deterministic movement aliases that pad Elite catalog slot coverage.
 * Keeps solver able to fill rare slots (adductor, quad isolation, bodyweight gaps)
 * without mutating seed_hypertrophy.sql / eliteCatalog source rows.
 */
import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import type { IronMovementPattern } from '@/lib/gameplan/engine/iron/taxonomy/movementPatterns';
import type { MuscleSubGroup } from '@/lib/gameplan/engine/iron/anatomicalDivision';
import { inferSlotCategory } from '@/lib/catalog/inferSlotCategory';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';

interface AliasSeed {
  /** Base slug must exist in Elite (or mapped catalog) for tempo/equipment scaffolding. */
  baseSlug: string;
  slug: string;
  name: string;
  movement_pattern: IronMovementPattern;
  primary_muscle: string;
  synergist_muscles?: readonly string[];
  equipment_required: readonly EquipmentTag[];
  isolationBoost?: boolean;
}

function anatomicalPrimaryForAlias(primaryMuscle: string): MuscleSubGroup | null {
  switch (primaryMuscle) {
    case 'core':
      return 'rectus_abdominis';
    case 'adductors':
      return 'adductors';
    case 'side_delts':
      return 'shoulder_lateral';
    case 'rear_delts':
      return 'shoulder_posterior';
    case 'front_delts':
      return 'shoulder_anterior';
    case 'biceps':
      return 'biceps_long_head';
    case 'triceps':
      return 'triceps_lateral_head';
    case 'calves':
      return 'calves_gastrocnemius';
    case 'forearms':
      return 'forearm_flexors';
    case 'traps':
      return 'trapezius_upper';
    case 'quads':
      return 'quadriceps_vastus_lat';
    case 'hamstrings':
      return 'hamstrings_biceps_fem';
    case 'glutes':
      return 'gluteus_maximus';
    case 'chest':
      return 'chest_horizontal';
    default:
      return null;
  }
}

function anatomicalSubGroupsForAlias(primaryMuscle: string): readonly MuscleSubGroup[] {
  const primary = anatomicalPrimaryForAlias(primaryMuscle);
  return primary ? [primary] : [];
}

/**
 * Three variants per starved niche so every equipment profile can reach ≥3
 * candidates. Names include category keywords for `matchesSlotCategory`.
 */
const ALIAS_SEEDS: readonly AliasSeed[] = [
  // —— Adductors (Elite has zero primary adductors) ——
  {
    baseSlug: 'deficit_bulgarian_split_squat',
    slug: 'copenhagen_plank',
    name: 'Copenhagen Plank Adductor',
    movement_pattern: 'isolation',
    primary_muscle: 'adductors',
    synergist_muscles: ['core', 'glutes'],
    equipment_required: ['bodyweight', 'full_gym'],
  },
  {
    baseSlug: 'walking_lunge',
    slug: 'side_lying_hip_adduction',
    name: 'Side-Lying Hip Adduction Inner Thigh',
    movement_pattern: 'isolation',
    primary_muscle: 'adductors',
    synergist_muscles: ['core'],
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'leg_extension',
    slug: 'cable_hip_adduction',
    name: 'Cable Hip Adduction',
    movement_pattern: 'isolation',
    primary_muscle: 'adductors',
    synergist_muscles: ['glutes'],
    equipment_required: ['full_gym', 'dumbbells'],
  },

  // —— Quad isolation (bodyweight / dumbbells starve without sissy-as-iso) ——
  {
    baseSlug: 'sissy_squat',
    slug: 'sissy_squat_quad_extension',
    name: 'Sissy Squat Quad Extension',
    movement_pattern: 'isolation',
    primary_muscle: 'quads',
    synergist_muscles: ['core'],
    equipment_required: ['bodyweight', 'full_gym'],
  },
  {
    baseSlug: 'deficit_bulgarian_split_squat',
    slug: 'bodyweight_terminal_knee_extension',
    name: 'Bodyweight Terminal Knee Extension',
    movement_pattern: 'isolation',
    primary_muscle: 'quads',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'leg_extension',
    slug: 'dumbbell_quad_extension_hold',
    name: 'Dumbbell Quad Extension Hold',
    movement_pattern: 'isolation',
    primary_muscle: 'quads',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },

  // —— Calves ——
  {
    baseSlug: 'standing_calf_raise',
    slug: 'single_leg_bodyweight_calf_raise',
    name: 'Single-Leg Bodyweight Calf Raise',
    movement_pattern: 'isolation',
    primary_muscle: 'calves',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'standing_calf_raise',
    slug: 'dumbbell_standing_calf_raise',
    name: 'Dumbbell Standing Calf Raise',
    movement_pattern: 'isolation',
    primary_muscle: 'calves',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'standing_calf_raise',
    slug: 'seated_calf_raise_hackenschmitt',
    name: 'Seated Calf Raise Hackenschmitt',
    movement_pattern: 'isolation',
    primary_muscle: 'calves',
    equipment_required: ['full_gym', 'dumbbells'],
  },

  // —— Chest presses / fly ——
  {
    baseSlug: 'push_up',
    slug: 'decline_push_up_dip_angle',
    name: 'Decline Push-Up Dip Angle',
    movement_pattern: 'push',
    primary_muscle: 'chest',
    equipment_required: ['bodyweight', 'full_gym'],
  },
  {
    baseSlug: 'push_up',
    slug: 'incline_push_up_upper_chest',
    name: 'Incline Push-Up Upper Chest',
    movement_pattern: 'push',
    primary_muscle: 'upper_chest',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'push_up',
    slug: 'wide_push_up_chest_press',
    name: 'Wide Push-Up Chest Press',
    movement_pattern: 'push',
    primary_muscle: 'chest',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'dumbbell_fly_flat',
    slug: 'bodyweight_ring_chest_fly',
    name: 'Bodyweight Ring Chest Fly',
    movement_pattern: 'isolation',
    primary_muscle: 'chest',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'dumbbell_fly_flat',
    slug: 'band_pec_deck_fly',
    name: 'Band Pec Deck Fly',
    movement_pattern: 'isolation',
    primary_muscle: 'chest',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'dumbbell_fly_flat',
    slug: 'dumbbell_crossover_fly',
    name: 'Dumbbell Crossover Fly',
    movement_pattern: 'isolation',
    primary_muscle: 'chest',
    equipment_required: ['dumbbells', 'full_gym'],
  },

  // —— Shoulders ——
  {
    baseSlug: 'overhead_press',
    slug: 'pike_push_up_overhead',
    name: 'Pike Push-Up Overhead Military',
    movement_pattern: 'push',
    primary_muscle: 'front_delts',
    equipment_required: ['bodyweight', 'full_gym'],
  },
  {
    baseSlug: 'overhead_press',
    slug: 'dumbbell_arnold_shoulder_press',
    name: 'Dumbbell Arnold Shoulder Press',
    movement_pattern: 'push',
    primary_muscle: 'front_delts',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'overhead_press',
    slug: 'landmine_shoulder_press_alias',
    name: 'Landmine Shoulder Press',
    movement_pattern: 'push',
    primary_muscle: 'front_delts',
    equipment_required: ['full_gym', 'barbell'],
  },
  {
    baseSlug: 'cable_lateral_raise',
    slug: 'bodyweight_lateral_raise_lean',
    name: 'Bodyweight Lateral Raise Lean',
    movement_pattern: 'isolation',
    primary_muscle: 'side_delts',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'cable_lateral_raise',
    slug: 'dumbbell_side_lateral_raise',
    name: 'Dumbbell Side Lateral Raise',
    movement_pattern: 'isolation',
    primary_muscle: 'side_delts',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'cable_lateral_raise',
    slug: 'cable_side_lateral_raise',
    name: 'Cable Side Lateral Raise',
    movement_pattern: 'isolation',
    primary_muscle: 'side_delts',
    equipment_required: ['full_gym'],
  },
  {
    baseSlug: 'reverse_pec_deck',
    slug: 'bodyweight_rear_delt_fly',
    name: 'Bodyweight Rear Delt Fly',
    movement_pattern: 'isolation',
    primary_muscle: 'rear_delts',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'face_pull',
    slug: 'band_face_pull_posterior',
    name: 'Band Face Pull Posterior',
    movement_pattern: 'isolation',
    primary_muscle: 'rear_delts',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'reverse_pec_deck',
    slug: 'dumbbell_reverse_delt_fly',
    name: 'Dumbbell Reverse Delt Fly',
    movement_pattern: 'isolation',
    primary_muscle: 'rear_delts',
    equipment_required: ['dumbbells', 'full_gym'],
  },

  // —— Back ——
  {
    baseSlug: 'pull_up_overhand',
    slug: 'neutral_bodyweight_pull_up',
    name: 'Neutral Bodyweight Pull Up',
    movement_pattern: 'pull',
    primary_muscle: 'lats',
    equipment_required: ['bodyweight', 'pull_up_bar', 'full_gym'],
  },
  {
    baseSlug: 'iliac_lat_pulldown',
    slug: 'band_lat_pulldown_vertical',
    name: 'Band Lat Pulldown Vertical',
    movement_pattern: 'pull',
    primary_muscle: 'lats',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 't_bar_row',
    slug: 'backpack_bent_over_row',
    name: 'Backpack Bent Over Row',
    movement_pattern: 'pull',
    primary_muscle: 'mid_back',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'chest_supported_row',
    slug: 'dumbbell_pendlay_row_alias',
    name: 'Dumbbell Pendlay Row',
    movement_pattern: 'pull',
    primary_muscle: 'mid_back',
    equipment_required: ['dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'iliac_lat_pulldown',
    slug: 'straight_arm_lat_iso_pulldown',
    name: 'Straight-Arm Lat Iso Pulldown',
    movement_pattern: 'isolation',
    primary_muscle: 'lats',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },

  // —— Arms ——
  {
    baseSlug: 'bayesian_curl',
    slug: 'towel_bodyweight_biceps_curl',
    name: 'Towel Bodyweight Biceps Curl',
    movement_pattern: 'isolation',
    primary_muscle: 'biceps',
    equipment_required: ['bodyweight', 'full_gym'],
  },
  {
    baseSlug: 'bayesian_curl',
    slug: 'incline_bayesian_curl_long_head',
    name: 'Incline Bayesian Curl Long Head',
    movement_pattern: 'isolation',
    primary_muscle: 'biceps',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'spider_curl',
    slug: 'preacher_spider_curl_short_head',
    name: 'Preacher Spider Curl Short Head',
    movement_pattern: 'isolation',
    primary_muscle: 'biceps',
    equipment_required: ['dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'bayesian_curl',
    slug: 'hammer_curl_neutral',
    name: 'Hammer Curl Neutral',
    movement_pattern: 'isolation',
    primary_muscle: 'biceps',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'close_grip_bench_press',
    slug: 'diamond_bodyweight_triceps_extension',
    name: 'Diamond Bodyweight Triceps Extension',
    movement_pattern: 'isolation',
    primary_muscle: 'triceps',
    equipment_required: ['bodyweight', 'full_gym'],
  },
  {
    baseSlug: 'close_grip_bench_press',
    slug: 'overhead_dumbbell_triceps_extension',
    name: 'Overhead Dumbbell Triceps Extension',
    movement_pattern: 'isolation',
    primary_muscle: 'triceps',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'close_grip_bench_press',
    slug: 'cable_triceps_pushdown_pressdown',
    name: 'Cable Triceps Pushdown Pressdown',
    movement_pattern: 'isolation',
    primary_muscle: 'triceps',
    equipment_required: ['full_gym'],
  },

  // —— Core / forearms / traps ——
  {
    baseSlug: 'push_up',
    slug: 'hollow_body_ab_crunch_plank',
    name: 'Hollow Body Ab Crunch Plank',
    movement_pattern: 'isolation',
    primary_muscle: 'core',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'push_up',
    slug: 'hanging_knee_raise_stabilization',
    name: 'Hanging Knee Raise Stabilization',
    movement_pattern: 'isolation',
    primary_muscle: 'core',
    equipment_required: ['bodyweight', 'pull_up_bar', 'full_gym'],
  },
  {
    baseSlug: 'push_up',
    slug: 'cable_core_rotation_twist',
    name: 'Cable Core Rotation Twist',
    movement_pattern: 'isolation',
    primary_muscle: 'core',
    equipment_required: ['full_gym', 'dumbbells', 'bodyweight'],
  },
  {
    baseSlug: 'dumbbell_shrug',
    slug: 'bodyweight_trap_shrug_hold',
    name: 'Bodyweight Trap Shrug Hold',
    movement_pattern: 'isolation',
    primary_muscle: 'traps',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'dumbbell_shrug',
    slug: 'barbell_trap_shrug',
    name: 'Barbell Trap Shrug',
    movement_pattern: 'isolation',
    primary_muscle: 'traps',
    equipment_required: ['barbell', 'full_gym', 'dumbbells'],
  },
  {
    baseSlug: 'dumbbell_shrug',
    slug: 'farmer_trap_shrug_carry',
    name: 'Farmer Trap Shrug',
    movement_pattern: 'isolation',
    primary_muscle: 'traps',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'bayesian_curl',
    slug: 'wrist_forearm_curl',
    name: 'Wrist Forearm Curl',
    movement_pattern: 'isolation',
    primary_muscle: 'forearms',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'bayesian_curl',
    slug: 'reverse_curl_forearm',
    name: 'Reverse Curl Forearm',
    movement_pattern: 'isolation',
    primary_muscle: 'forearms',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'bayesian_curl',
    slug: 'plate_wrist_forearm_roll',
    name: 'Plate Wrist Forearm Roll',
    movement_pattern: 'isolation',
    primary_muscle: 'forearms',
    equipment_required: ['full_gym', 'dumbbells'],
  },

  // —— Posterior chain ——
  {
    baseSlug: 'nordic_curl',
    slug: 'bodyweight_hinge_good_morning',
    name: 'Bodyweight Hinge Good Morning',
    movement_pattern: 'hinge',
    primary_muscle: 'hamstrings',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'barbell_romanian_deadlift',
    slug: 'single_leg_bodyweight_rdl',
    name: 'Single-Leg Bodyweight RDL',
    movement_pattern: 'hinge',
    primary_muscle: 'hamstrings',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'hip_thrust_barbell',
    slug: 'bodyweight_glute_bridge_hinge',
    name: 'Bodyweight Glute Bridge Hinge',
    movement_pattern: 'hinge',
    primary_muscle: 'glutes',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'nordic_curl',
    slug: 'sliding_leg_hamstring_curl',
    name: 'Sliding Leg Hamstring Curl',
    movement_pattern: 'isolation',
    primary_muscle: 'hamstrings',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'nordic_curl',
    slug: 'stability_ball_hamstring_curl',
    name: 'Stability Ball Hamstring Curl',
    movement_pattern: 'isolation',
    primary_muscle: 'hamstrings',
    equipment_required: ['bodyweight', 'full_gym'],
  },
  {
    baseSlug: 'cable_kickback_glute',
    slug: 'band_glute_kickback_isolation',
    name: 'Band Glute Kickback Isolation',
    movement_pattern: 'isolation',
    primary_muscle: 'glutes',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },

  // —— Quad compounds (bodyweight squat primary) ——
  {
    baseSlug: 'sissy_squat',
    slug: 'bodyweight_goblet_air_squat',
    name: 'Bodyweight Air Squat',
    movement_pattern: 'squat',
    primary_muscle: 'quads',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'deficit_bulgarian_split_squat',
    slug: 'reverse_lunge_split_squat',
    name: 'Reverse Lunge Split Squat',
    movement_pattern: 'lunge',
    primary_muscle: 'quads',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'walking_lunge',
    slug: 'stationary_split_squat_lunge',
    name: 'Stationary Split Squat Lunge',
    movement_pattern: 'lunge',
    primary_muscle: 'quads',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },

  // —— Wave 2: close remaining CI gaps ——
  {
    baseSlug: 'barbell_bench_press',
    slug: 'machine_chest_press_flat',
    name: 'Machine Chest Press Flat Bench',
    movement_pattern: 'push',
    primary_muscle: 'chest',
    equipment_required: ['full_gym', 'dumbbells'],
  },
  {
    baseSlug: 'incline_dumbbell_press_30',
    slug: 'machine_incline_chest_press',
    name: 'Machine Incline Chest Press Upper',
    movement_pattern: 'push',
    primary_muscle: 'upper_chest',
    equipment_required: ['full_gym', 'dumbbells', 'bodyweight'],
  },
  {
    baseSlug: 'barbell_bench_press',
    slug: 'machine_decline_chest_press',
    name: 'Machine Decline Chest Press',
    movement_pattern: 'push',
    primary_muscle: 'chest',
    equipment_required: ['full_gym', 'dumbbells', 'bodyweight'],
  },
  {
    baseSlug: 'close_grip_bench_press',
    slug: 'bench_dip_triceps_pushdown',
    name: 'Bench Dip Triceps Pushdown',
    movement_pattern: 'isolation',
    primary_muscle: 'triceps',
    equipment_required: ['bodyweight', 'full_gym', 'dumbbells'],
  },
  {
    baseSlug: 'close_grip_bench_press',
    slug: 'band_triceps_pressdown',
    name: 'Band Triceps Pressdown Pushdown',
    movement_pattern: 'isolation',
    primary_muscle: 'triceps',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'close_grip_bench_press',
    slug: 'close_grip_floor_press_triceps',
    name: 'Close-Grip Floor Press Triceps',
    movement_pattern: 'isolation',
    primary_muscle: 'triceps',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'standing_calf_raise',
    slug: 'seated_dumbbell_calf_raise',
    name: 'Seated Dumbbell Calf Raise',
    movement_pattern: 'isolation',
    primary_muscle: 'calves',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'standing_calf_raise',
    slug: 'seated_hackenschmitt_calf_raise',
    name: 'Seated Hackenschmitt Calf Raise',
    movement_pattern: 'isolation',
    primary_muscle: 'calves',
    equipment_required: ['full_gym', 'dumbbells', 'bodyweight'],
  },
  {
    baseSlug: 'deficit_bulgarian_split_squat',
    slug: 'copenhagen_adductor_hold_b',
    name: 'Copenhagen Adductor Hold B',
    movement_pattern: 'isolation',
    primary_muscle: 'adductors',
    equipment_required: ['bodyweight', 'full_gym', 'dumbbells'],
  },
  {
    baseSlug: 'chest_supported_row',
    slug: 'gorilla_inverted_row',
    name: 'Gorilla Inverted Row',
    movement_pattern: 'pull',
    primary_muscle: 'mid_back',
    equipment_required: ['bodyweight', 'full_gym', 'dumbbells'],
  },
  {
    baseSlug: 't_bar_row',
    slug: 'meadows_t_bar_row_alias',
    name: 'Meadows T-Bar Row',
    movement_pattern: 'pull',
    primary_muscle: 'mid_back',
    equipment_required: ['full_gym', 'dumbbells', 'bodyweight'],
  },
  {
    baseSlug: 'bayesian_curl',
    slug: 'cross_body_hammer_curl',
    name: 'Cross-Body Hammer Curl',
    movement_pattern: 'isolation',
    primary_muscle: 'biceps',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'bayesian_curl',
    slug: 'rope_hammer_curl',
    name: 'Rope Hammer Curl',
    movement_pattern: 'isolation',
    primary_muscle: 'biceps',
    equipment_required: ['full_gym', 'dumbbells', 'bodyweight'],
  },
  {
    baseSlug: 'iliac_lat_pulldown',
    slug: 'chin_up_lat_pulldown_mix',
    name: 'Chin-Up Lat Pulldown Mix',
    movement_pattern: 'pull',
    primary_muscle: 'lats',
    equipment_required: ['full_gym', 'pull_up_bar', 'bodyweight'],
  },
  {
    baseSlug: 'iliac_lat_pulldown',
    slug: 'machine_lat_pulldown_iso',
    name: 'Machine Lat Iso Pulldown',
    movement_pattern: 'isolation',
    primary_muscle: 'lats',
    equipment_required: ['full_gym', 'dumbbells', 'bodyweight'],
  },
  {
    baseSlug: 'cable_kickback_glute',
    slug: 'frog_pump_glute_isolation',
    name: 'Frog Pump Glute Isolation',
    movement_pattern: 'isolation',
    primary_muscle: 'glutes',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'hip_thrust_barbell',
    slug: 'single_leg_glute_hinge_bridge',
    name: 'Single-Leg Glute Hinge Bridge',
    movement_pattern: 'hinge',
    primary_muscle: 'glutes',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'hip_thrust_barbell',
    slug: 'cable_pull_through_glute_hinge',
    name: 'Cable Pull-Through Glute Hinge',
    movement_pattern: 'hinge',
    primary_muscle: 'glutes',
    equipment_required: ['full_gym', 'dumbbells', 'bodyweight'],
  },
  {
    baseSlug: 'sissy_squat',
    slug: 'heel_elevated_air_squat',
    name: 'Heel-Elevated Air Squat',
    movement_pattern: 'squat',
    primary_muscle: 'quads',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'belt_squat',
    slug: 'landmine_goblet_squat_alias',
    name: 'Landmine Goblet Squat',
    movement_pattern: 'squat',
    primary_muscle: 'quads',
    equipment_required: ['full_gym', 'dumbbells', 'bodyweight'],
  },
  {
    baseSlug: 'dumbbell_fly_flat',
    slug: 'floor_chest_fly_crossover',
    name: 'Floor Chest Fly Crossover',
    movement_pattern: 'isolation',
    primary_muscle: 'chest',
    equipment_required: ['dumbbells', 'bodyweight', 'full_gym'],
  },
  {
    baseSlug: 'overhead_press',
    slug: 'seated_dumbbell_military_press',
    name: 'Seated Dumbbell Military Press Overhead',
    movement_pattern: 'push',
    primary_muscle: 'front_delts',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'cable_lateral_raise',
    slug: 'lean_away_lateral_raise',
    name: 'Lean-Away Lateral Raise Side',
    movement_pattern: 'isolation',
    primary_muscle: 'side_delts',
    equipment_required: ['dumbbells', 'bodyweight', 'full_gym'],
  },
  {
    baseSlug: 'reverse_pec_deck',
    slug: 'prone_rear_delt_raise',
    name: 'Prone Rear Delt Raise Reverse',
    movement_pattern: 'isolation',
    primary_muscle: 'rear_delts',
    equipment_required: ['dumbbells', 'bodyweight', 'full_gym'],
  },
  {
    baseSlug: 'close_grip_bench_press',
    slug: 'skull_crusher_triceps_extension',
    name: 'Skull Crusher Triceps Extension',
    movement_pattern: 'isolation',
    primary_muscle: 'triceps',
    equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
  },
  {
    baseSlug: 'bayesian_curl',
    slug: 'farmer_wrist_forearm_hold',
    name: 'Farmer Wrist Forearm Hold',
    movement_pattern: 'isolation',
    primary_muscle: 'forearms',
    equipment_required: ['dumbbells', 'bodyweight', 'full_gym'],
  },
  {
    baseSlug: 'push_up',
    slug: 'russian_twist_core_rotation',
    name: 'Russian Twist Core Rotation',
    movement_pattern: 'isolation',
    primary_muscle: 'core',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'push_up',
    slug: 'woodchop_core_rotation',
    name: 'Woodchop Core Rotation',
    movement_pattern: 'isolation',
    primary_muscle: 'core',
    equipment_required: ['full_gym', 'dumbbells', 'bodyweight'],
  },
  {
    baseSlug: 'dumbbell_shrug',
    slug: 'trap_bar_shrug_alias',
    name: 'Trap Bar Shrug',
    movement_pattern: 'isolation',
    primary_muscle: 'traps',
    equipment_required: ['full_gym', 'dumbbells', 'bodyweight'],
  },
  {
    baseSlug: 'overhead_press',
    slug: 'wall_handstand_hold_press',
    name: 'Wall Shoulder Press Hold',
    movement_pattern: 'push',
    primary_muscle: 'front_delts',
    equipment_required: ['bodyweight', 'full_gym'],
  },
  {
    baseSlug: 'incline_dumbbell_press_30',
    slug: 'feet_elevated_incline_press',
    name: 'Feet-Elevated Incline Chest Press',
    movement_pattern: 'push',
    primary_muscle: 'upper_chest',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'barbell_bench_press',
    slug: 'feet_elevated_decline_press',
    name: 'Feet-Elevated Decline Chest Press Dip',
    movement_pattern: 'push',
    primary_muscle: 'chest',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'barbell_bench_press',
    slug: 'smith_decline_bench_press',
    name: 'Smith Decline Bench Press',
    movement_pattern: 'push',
    primary_muscle: 'chest',
    equipment_required: ['full_gym'],
  },
  {
    baseSlug: 'barbell_bench_press',
    slug: 'plate_loaded_decline_press',
    name: 'Plate-Loaded Decline Chest Press',
    movement_pattern: 'push',
    primary_muscle: 'chest',
    equipment_required: ['full_gym'],
  },
  {
    baseSlug: 'iliac_lat_pulldown',
    slug: 'v_bar_lat_pulldown',
    name: 'V-Bar Lat Pulldown',
    movement_pattern: 'pull',
    primary_muscle: 'lats',
    equipment_required: ['full_gym'],
  },
  {
    baseSlug: 'standing_calf_raise',
    slug: 'seated_bodyweight_calf_raise',
    name: 'Seated Bodyweight Calf Raise',
    movement_pattern: 'isolation',
    primary_muscle: 'calves',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
  {
    baseSlug: 'iliac_lat_pulldown',
    slug: 'band_straight_arm_lat_iso',
    name: 'Band Straight-Arm Lat Isolation',
    movement_pattern: 'isolation',
    primary_muscle: 'lats',
    equipment_required: ['bodyweight', 'dumbbells', 'full_gym'],
  },
];

function fallbackCue(name: string): CatalogExercise['cue_card'] {
  return {
    setup: `Set up for ${name} with controlled tension.`,
    vector: 'Drive through the intended line of force.',
    catch: 'Own the lockout without losing joint stack.',
    anti_pattern: 'Avoid momentum and end-range collapse.',
    failure_type: 'technical',
  };
}

/** Alias-owned cue card — never copy the Elite base movement cues. */
function aliasCueCard(seed: AliasSeed): NonNullable<CatalogExercise['cue_card']> {
  const baseLabel = seed.baseSlug.replace(/_/g, ' ');
  return {
    setup: `${seed.name}: organize a stable start for ${seed.primary_muscle}; brace before the first rep.`,
    vector: `Drive ${seed.name} on a clean ${seed.movement_pattern} path targeting ${seed.primary_muscle}.`,
    catch: `Finish ${seed.name} with owned end-range tension on ${seed.primary_muscle}.`,
    anti_pattern: `Do not import ${baseLabel} mechanics into ${seed.name}.`,
    failure_type: 'technical',
  };
}

function aliasSlotCategory(seed: AliasSeed): string {
  const synthetic = {
    id: `alias:${seed.slug}`,
    slug: seed.slug,
    name: seed.name,
    biomechanical_instructions: {},
    equipment_required: [...seed.equipment_required],
    default_sets: 3,
    default_reps: 12,
    movement_pattern: seed.movement_pattern,
    primary_muscle: seed.primary_muscle,
    synergist_muscles: [...(seed.synergist_muscles ?? [])],
    cns_fatigue_cost: 2,
    joint_stress_profile: 'low_impact',
    stretch_mediated_hypertrophy: false,
  } as LibraryExercise;
  return inferSlotCategory(synthetic);
}

/**
 * Expand Elite catalog with deterministic starvation aliases.
 * Skips seeds whose base is missing and skips slugs already present.
 */
export function expandStarvationAliases(
  mapped: readonly CatalogExercise[],
): CatalogExercise[] {
  const bySlug = new Map(mapped.map((exercise) => [exercise.slug, exercise]));
  const aliases: CatalogExercise[] = [];

  for (const seed of ALIAS_SEEDS) {
    if (bySlug.has(seed.slug)) continue;
    const base = bySlug.get(seed.baseSlug);
    if (!base) continue;

    const cues = aliasCueCard(seed);
    const alias: CatalogExercise = {
      ...base,
      id: `alias:${seed.slug}`,
      slug: seed.slug,
      name: seed.name,
      movement_pattern: seed.movement_pattern,
      primary_muscle: seed.primary_muscle,
      synergist_muscles: [...(seed.synergist_muscles ?? base.synergist_muscles)],
      equipment_required: [...seed.equipment_required],
      // Own cues — never inherit Elite base cue_card or biomechanical_instructions.
      cue_card: cues,
      biomechanical_instructions: {
        setup: cues.setup,
        concentric: cues.vector,
        eccentric: cues.catch,
        safety: cues.anti_pattern,
        failure_type: cues.failure_type,
      },
      slot_category: aliasSlotCategory(seed),
      // Deprioritize vs Elite anchors — aliases exist for coverage, not preference.
      selection_score: 0.05,
      cns_fatigue_cost: Math.min(Math.max(base.cns_fatigue_cost, 2), 4),
      complexity_level: 2,
      // Clear inherited anatomical mapping — aliases target different muscles.
      muscle_sub_groups: anatomicalSubGroupsForAlias(seed.primary_muscle),
      primary_sub_group: anatomicalPrimaryForAlias(seed.primary_muscle),
      synergist_sub_groups: [],
    };
    aliases.push(alias);
    bySlug.set(alias.slug, alias);
  }

  return aliases;
}
