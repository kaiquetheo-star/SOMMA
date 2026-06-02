import { describe, expect, it } from 'vitest';
import { generateIronMicrocycle } from '@/lib/gameplan/engine/iron/generateIronMicrocycle';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';
import { initialBiologicalProfile } from '@/types/biological';

function ex(partial: Omit<LibraryExercise, 'biomechanical_instructions'> & { biomechanical_instructions?: Record<string, string> }): LibraryExercise {
  return {
    biomechanical_instructions: partial.biomechanical_instructions ?? { setup: 'seed' },
    ...partial,
  };
}

/**
 * Minimal seed-backed hypertrophy catalog using real slugs from `supabase/seed_hypertrophy.sql`.
 * IDs are deterministic for tests.
 */
function seedEliteCatalog(): LibraryExercise[] {
  return [
    ex({
      id: 'ex_barbell_bench_press',
      slug: 'barbell_bench_press',
      name: 'Barbell Bench Press',
      equipment_required: ['barbell', 'full_gym'],
      default_sets: 4,
      default_reps: 8,
      movement_pattern: 'push',
      primary_muscle: 'chest',
      synergist_muscles: ['front_delts', 'triceps'],
      cns_fatigue_cost: 4,
      joint_stress_profile: 'shoulder_impingement_risk',
      stretch_mediated_hypertrophy: false,
    }),
    ex({
      id: 'ex_incline_dumbbell_press_30',
      slug: 'incline_dumbbell_press_30',
      name: 'Incline Dumbbell Press (30°)',
      equipment_required: ['dumbbells', 'full_gym'],
      default_sets: 4,
      default_reps: 10,
      movement_pattern: 'push',
      primary_muscle: 'upper_chest',
      synergist_muscles: ['front_delts', 'triceps'],
      cns_fatigue_cost: 3,
      joint_stress_profile: 'shoulder_impingement_risk',
      stretch_mediated_hypertrophy: true,
    }),
    ex({
      id: 'ex_overhead_press',
      slug: 'overhead_press',
      name: 'Standing Overhead Press',
      equipment_required: ['barbell', 'dumbbells', 'full_gym'],
      default_sets: 4,
      default_reps: 8,
      movement_pattern: 'push',
      primary_muscle: 'front_delts',
      synergist_muscles: ['triceps', 'upper_chest', 'core'],
      cns_fatigue_cost: 4,
      joint_stress_profile: 'rotator_cuff_heavy',
      stretch_mediated_hypertrophy: false,
    }),
    ex({
      id: 'ex_cable_lateral_raise',
      slug: 'cable_lateral_raise',
      name: 'Cable Lateral Raise',
      equipment_required: ['full_gym'],
      default_sets: 3,
      default_reps: 15,
      movement_pattern: 'isolation',
      primary_muscle: 'side_delts',
      synergist_muscles: ['traps'],
      cns_fatigue_cost: 1,
      joint_stress_profile: 'low_impact',
      stretch_mediated_hypertrophy: false,
    }),
    ex({
      id: 'ex_reverse_pec_deck',
      slug: 'reverse_pec_deck',
      name: 'Reverse Pec Deck',
      equipment_required: ['full_gym'],
      default_sets: 3,
      default_reps: 15,
      movement_pattern: 'isolation',
      primary_muscle: 'rear_delts',
      synergist_muscles: ['mid_back', 'traps'],
      cns_fatigue_cost: 1,
      joint_stress_profile: 'low_impact',
      stretch_mediated_hypertrophy: true,
    }),
    ex({
      id: 'ex_tricep_rope_pushdown',
      slug: 'tricep_rope_pushdown',
      name: 'Tricep Rope Pushdown',
      equipment_required: ['full_gym'],
      default_sets: 3,
      default_reps: 12,
      movement_pattern: 'isolation',
      primary_muscle: 'triceps',
      synergist_muscles: [],
      cns_fatigue_cost: 1,
      joint_stress_profile: 'low_impact',
      stretch_mediated_hypertrophy: false,
    }),
    ex({
      id: 'ex_ez_bar_skullcrusher',
      slug: 'ez_bar_skullcrusher',
      name: 'EZ-Bar Skullcrusher',
      equipment_required: ['barbell', 'full_gym'],
      default_sets: 3,
      default_reps: 10,
      movement_pattern: 'isolation',
      primary_muscle: 'triceps',
      synergist_muscles: [],
      cns_fatigue_cost: 2,
      joint_stress_profile: 'low_impact',
      stretch_mediated_hypertrophy: true,
    }),
    ex({
      id: 'ex_iliac_lat_pulldown',
      slug: 'iliac_lat_pulldown',
      name: 'Iliac Lat Pulldown',
      equipment_required: ['full_gym'],
      default_sets: 4,
      default_reps: 10,
      movement_pattern: 'pull',
      primary_muscle: 'lats',
      synergist_muscles: ['mid_back', 'biceps', 'rear_delts'],
      cns_fatigue_cost: 2,
      joint_stress_profile: 'low_impact',
      stretch_mediated_hypertrophy: true,
    }),
    ex({
      id: 'ex_chest_supported_row',
      slug: 'chest_supported_row',
      name: 'Chest-Supported T-Bar Row',
      equipment_required: ['full_gym'],
      default_sets: 4,
      default_reps: 10,
      movement_pattern: 'pull',
      primary_muscle: 'mid_back',
      synergist_muscles: ['lats', 'rear_delts', 'biceps'],
      cns_fatigue_cost: 2,
      joint_stress_profile: 'low_impact',
      stretch_mediated_hypertrophy: false,
    }),
    ex({
      id: 'ex_bayesian_curl',
      slug: 'bayesian_curl',
      name: 'Bayesian Cable Curl',
      equipment_required: ['full_gym'],
      default_sets: 3,
      default_reps: 12,
      movement_pattern: 'isolation',
      primary_muscle: 'biceps',
      synergist_muscles: ['forearms'],
      cns_fatigue_cost: 1,
      joint_stress_profile: 'low_impact',
      stretch_mediated_hypertrophy: true,
    }),
    ex({
      id: 'ex_preacher_curl_machine',
      slug: 'preacher_curl_machine',
      name: 'Preacher Curl (Machine)',
      equipment_required: ['full_gym'],
      default_sets: 3,
      default_reps: 12,
      movement_pattern: 'isolation',
      primary_muscle: 'biceps',
      synergist_muscles: ['forearms'],
      cns_fatigue_cost: 1,
      joint_stress_profile: 'low_impact',
      stretch_mediated_hypertrophy: true,
    }),
    ex({
      id: 'ex_dumbbell_shrug',
      slug: 'dumbbell_shrug',
      name: 'Dumbbell Shrug',
      equipment_required: ['dumbbells', 'full_gym'],
      default_sets: 3,
      default_reps: 12,
      movement_pattern: 'isolation',
      primary_muscle: 'traps',
      synergist_muscles: ['forearms'],
      cns_fatigue_cost: 2,
      joint_stress_profile: 'cervical_load',
      stretch_mediated_hypertrophy: false,
    }),
    ex({
      id: 'ex_pendulum_squat',
      slug: 'pendulum_squat',
      name: 'Pendulum Squat',
      equipment_required: ['full_gym'],
      default_sets: 3,
      default_reps: 10,
      movement_pattern: 'squat',
      primary_muscle: 'quadriceps',
      synergist_muscles: ['glutes'],
      cns_fatigue_cost: 3,
      joint_stress_profile: 'moderate_knee_stress',
      stretch_mediated_hypertrophy: true,
    }),
    ex({
      id: 'ex_hack_squat_machine',
      slug: 'hack_squat_machine',
      name: 'Hack Squat (Machine)',
      equipment_required: ['full_gym'],
      default_sets: 4,
      default_reps: 8,
      movement_pattern: 'squat',
      primary_muscle: 'quadriceps',
      synergist_muscles: ['glutes'],
      cns_fatigue_cost: 3,
      joint_stress_profile: 'moderate_knee_stress',
      stretch_mediated_hypertrophy: false,
    }),
    ex({
      id: 'ex_deficit_bulgarian_split_squat',
      slug: 'deficit_bulgarian_split_squat',
      name: 'Deficit Bulgarian Split Squat',
      equipment_required: ['dumbbells', 'full_gym', 'bodyweight'],
      default_sets: 3,
      default_reps: 10,
      movement_pattern: 'lunge',
      primary_muscle: 'quadriceps',
      synergist_muscles: ['glutes', 'adductors', 'core'],
      cns_fatigue_cost: 4,
      joint_stress_profile: 'high_knee_shear',
      stretch_mediated_hypertrophy: true,
    }),
    ex({
      id: 'ex_leg_extension',
      slug: 'leg_extension',
      name: 'Leg Extension',
      equipment_required: ['full_gym'],
      default_sets: 3,
      default_reps: 15,
      movement_pattern: 'isolation',
      primary_muscle: 'quadriceps',
      synergist_muscles: [],
      cns_fatigue_cost: 1,
      joint_stress_profile: 'moderate_knee_stress',
      stretch_mediated_hypertrophy: false,
    }),
    ex({
      id: 'ex_barbell_romanian_deadlift',
      slug: 'barbell_romanian_deadlift',
      name: 'Barbell Romanian Deadlift',
      equipment_required: ['barbell', 'full_gym'],
      default_sets: 4,
      default_reps: 8,
      movement_pattern: 'hinge',
      primary_muscle: 'hamstrings',
      synergist_muscles: ['glutes', 'erectors'],
      cns_fatigue_cost: 4,
      joint_stress_profile: 'lumbar_shear',
      stretch_mediated_hypertrophy: true,
    }),
    ex({
      id: 'ex_hip_thrust_barbell',
      slug: 'hip_thrust_barbell',
      name: 'Barbell Hip Thrust',
      equipment_required: ['barbell', 'full_gym'],
      default_sets: 4,
      default_reps: 10,
      movement_pattern: 'hinge',
      primary_muscle: 'glutes',
      synergist_muscles: ['hamstrings', 'core'],
      cns_fatigue_cost: 3,
      joint_stress_profile: 'low_impact',
      stretch_mediated_hypertrophy: true,
    }),
    ex({
      id: 'ex_seated_leg_curl',
      slug: 'seated_leg_curl',
      name: 'Seated Leg Curl',
      equipment_required: ['full_gym'],
      default_sets: 3,
      default_reps: 12,
      movement_pattern: 'isolation',
      primary_muscle: 'hamstrings',
      synergist_muscles: ['calves'],
      cns_fatigue_cost: 1,
      joint_stress_profile: 'low_impact',
      stretch_mediated_hypertrophy: true,
    }),
    ex({
      id: 'ex_nordic_curl',
      slug: 'nordic_curl',
      name: 'Nordic Hamstring Curl',
      equipment_required: ['bodyweight', 'full_gym'],
      default_sets: 3,
      default_reps: 6,
      movement_pattern: 'isolation',
      primary_muscle: 'hamstrings',
      synergist_muscles: ['glutes', 'calves'],
      cns_fatigue_cost: 3,
      joint_stress_profile: 'high_knee_shear',
      stretch_mediated_hypertrophy: true,
    }),
    ex({
      id: 'ex_seated_calf_raise',
      slug: 'seated_calf_raise',
      name: 'Seated Calf Raise',
      equipment_required: ['full_gym'],
      default_sets: 4,
      default_reps: 15,
      movement_pattern: 'isolation',
      primary_muscle: 'calves',
      synergist_muscles: [],
      cns_fatigue_cost: 1,
      joint_stress_profile: 'low_impact',
      stretch_mediated_hypertrophy: true,
    }),
  ];
}

function estimateSecondsFromMicrocycleDay(picks: { prescribedSets: number; exercise: { default_reps: number; cns_fatigue_cost: number } }[]): number {
  // Mirror engine heuristic: reps × 3s + rest from CNS cost.
  const restByCns: Record<number, number> = { 1: 60, 2: 75, 3: 105, 4: 150, 5: 180 };
  return picks.reduce((sum, pick) => {
    const rest = restByCns[pick.exercise.cns_fatigue_cost] ?? 105;
    return sum + pick.prescribedSets * (pick.exercise.default_reps * 3 + rest);
  }, 0);
}

describe('iron mastery + rotation + time budget (Phase 5)', () => {
  it('generates elite 6-day PPL with intra-week emphasis, traps slot, time fill, and 3D shoulder add-on (no OHP deletion)', () => {
    const catalog = seedEliteCatalog();
    const biological = {
      ...initialBiologicalProfile,
      frequency_iron: 6,
      goal_iron: 'Hypertrophy',
      iron_mastery: 5,
      available_time_iron: 90,
    };

    const equipment: EquipmentTag[] = ['full_gym', 'barbell', 'dumbbells'];
    const ironDayIndices = [1, 2, 3, 4, 5, 6];

    const microcycle = generateIronMicrocycle({
      libraryExercises: catalog,
      biological,
      equipment,
      logs7d: [],
      logs21d: [],
      ironDayIndices,
      weekStartDate: '2026-05-26',
      blockedJointProfiles: [],
      goalIron: biological.goal_iron,
      availableMinutes: 90,
    });

    expect(microcycle).toHaveLength(6);

    const legsDays = microcycle.filter((d) => d.splitDay === 'legs');
    expect(legsDays).toHaveLength(2);

    const legsA = legsDays[0]!;
    const legsB = legsDays[1]!;

    const legsASlugs = new Set(legsA.picks.map((p) => p.exercise.slug));
    const legsBSlugs = new Set(legsB.picks.map((p) => p.exercise.slug));

    // Assert 1: Legs A quad focus vs Legs B posterior focus — not the same primaries.
    expect(legsASlugs.has('pendulum_squat') || legsASlugs.has('deficit_bulgarian_split_squat')).toBe(true);
    expect(legsBSlugs.has('barbell_romanian_deadlift') || legsBSlugs.has('hip_thrust_barbell')).toBe(true);
    expect(legsBSlugs.has('pendulum_squat')).toBe(false);

    // Assert 2: Pull B has explicit traps movement (seed slug).
    const pullDays = microcycle.filter((d) => d.splitDay === 'pull');
    expect(pullDays).toHaveLength(2);
    const pullB = pullDays[1]!;
    expect(pullB.picks.some((p) => p.exercise.slug === 'dumbbell_shrug' || p.exercise.primary_muscle === 'traps')).toBe(true);

    // Assert 3: 90m budget produces a dense session (not a 5-exercise default).
    for (const day of microcycle) {
      expect(day.picks.length).toBeGreaterThanOrEqual(7);
      const seconds = estimateSecondsFromMicrocycleDay(day.picks);
      expect(seconds).toBeGreaterThanOrEqual(80 * 60);
    }

    // Assert 4: Push keeps overhead press AND adds lateral raise volume to satisfy shoulder 3D.
    const pushDays = microcycle.filter((d) => d.splitDay === 'push');
    expect(pushDays).toHaveLength(2);
    const pushWithOHP = pushDays.find((d) => d.picks.some((p) => p.exercise.slug === 'overhead_press'));
    expect(pushWithOHP).toBeDefined();
    expect(pushWithOHP!.picks.some((p) => p.exercise.slug === 'cable_lateral_raise')).toBe(true);
  });
});

