import { describe, expect, it } from 'vitest';
import {
  computeWeeklyShoulderBalance,
  generateIronMicrocycle,
} from '@/lib/gameplan/engine/iron/generateIronMicrocycle';
import {
  estimateSessionSeconds,
  isAxialLoadExercise,
} from '@/lib/gameplan/engine/iron/ConstraintSolver';
import { initialBiologicalProfile } from '@/types/biological';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';

function ex(
  partial: Omit<LibraryExercise, 'biomechanical_instructions'> & {
    biomechanical_instructions?: Record<string, string>;
  },
): LibraryExercise {
  return {
    biomechanical_instructions: partial.biomechanical_instructions ?? { setup: 'seed-backed fixture' },
    ...partial,
  };
}

function eliteSeedCatalog(): LibraryExercise[] {
  return [
    ex({ id: 'barbell_bench_press', slug: 'barbell_bench_press', name: 'Barbell Bench Press', equipment_required: ['barbell', 'full_gym'], default_sets: 4, default_reps: 8, movement_pattern: 'push', primary_muscle: 'chest', synergist_muscles: ['front_delts', 'triceps'], cns_fatigue_cost: 4, joint_stress_profile: 'shoulder_impingement_risk', stretch_mediated_hypertrophy: false }),
    ex({ id: 'incline_dumbbell_press_30', slug: 'incline_dumbbell_press_30', name: 'Incline Dumbbell Press (30°)', equipment_required: ['dumbbells', 'full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'push', primary_muscle: 'upper_chest', synergist_muscles: ['front_delts', 'triceps'], cns_fatigue_cost: 3, joint_stress_profile: 'shoulder_impingement_risk', stretch_mediated_hypertrophy: true }),
    ex({ id: 'overhead_press', slug: 'overhead_press', name: 'Standing Overhead Press', equipment_required: ['barbell', 'dumbbells', 'full_gym'], default_sets: 4, default_reps: 8, movement_pattern: 'push', primary_muscle: 'front_delts', synergist_muscles: ['triceps', 'upper_chest', 'core'], cns_fatigue_cost: 4, joint_stress_profile: 'rotator_cuff_heavy', stretch_mediated_hypertrophy: false }),
    ex({ id: 'machine_shoulder_press', slug: 'machine_shoulder_press', name: 'Machine Shoulder Press', equipment_required: ['full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'push', primary_muscle: 'front_delts', synergist_muscles: ['triceps', 'upper_chest'], cns_fatigue_cost: 3, joint_stress_profile: 'rotator_cuff_heavy', stretch_mediated_hypertrophy: false }),
    ex({ id: 'landmine_press', slug: 'landmine_press', name: 'Landmine Press', equipment_required: ['barbell', 'full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'push', primary_muscle: 'upper_chest', synergist_muscles: ['front_delts', 'core', 'triceps'], cns_fatigue_cost: 3, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: false }),
    ex({ id: 'incline_cable_fly', slug: 'incline_cable_fly', name: 'Incline Cable Fly (30°)', equipment_required: ['full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'upper_chest', synergist_muscles: ['front_delts'], cns_fatigue_cost: 1, joint_stress_profile: 'shoulder_impingement_risk', stretch_mediated_hypertrophy: true }),
    ex({ id: 'dumbbell_fly_flat', slug: 'dumbbell_fly_flat', name: 'Dumbbell Fly (Flat)', equipment_required: ['dumbbells', 'full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'chest', synergist_muscles: ['front_delts'], cns_fatigue_cost: 1, joint_stress_profile: 'shoulder_impingement_risk', stretch_mediated_hypertrophy: true }),
    ex({ id: 'cable_lateral_raise', slug: 'cable_lateral_raise', name: 'Cable Lateral Raise', equipment_required: ['full_gym'], default_sets: 3, default_reps: 15, movement_pattern: 'isolation', primary_muscle: 'side_delts', synergist_muscles: ['traps'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: false }),
    ex({ id: 'leaning_cable_lateral_raise', slug: 'leaning_cable_lateral_raise', name: 'Leaning Cable Lateral Raise', equipment_required: ['full_gym'], default_sets: 3, default_reps: 15, movement_pattern: 'isolation', primary_muscle: 'side_delts', synergist_muscles: ['traps'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'reverse_pec_deck', slug: 'reverse_pec_deck', name: 'Reverse Pec Deck', equipment_required: ['full_gym'], default_sets: 3, default_reps: 15, movement_pattern: 'isolation', primary_muscle: 'rear_delts', synergist_muscles: ['mid_back', 'traps'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'face_pull', slug: 'face_pull', name: 'Face Pull', equipment_required: ['full_gym'], default_sets: 3, default_reps: 15, movement_pattern: 'isolation', primary_muscle: 'rear_delts', synergist_muscles: ['traps', 'rotator_cuff'], cns_fatigue_cost: 1, joint_stress_profile: 'rotator_cuff_heavy', stretch_mediated_hypertrophy: false }),
    ex({ id: 'tricep_rope_pushdown', slug: 'tricep_rope_pushdown', name: 'Tricep Rope Pushdown', equipment_required: ['full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'triceps', synergist_muscles: [], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: false }),
    ex({ id: 'ez_bar_skullcrusher', slug: 'ez_bar_skullcrusher', name: 'EZ-Bar Skullcrusher', equipment_required: ['barbell', 'full_gym'], default_sets: 3, default_reps: 10, movement_pattern: 'isolation', primary_muscle: 'triceps', synergist_muscles: [], cns_fatigue_cost: 2, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),

    ex({ id: 'iliac_lat_pulldown', slug: 'iliac_lat_pulldown', name: 'Iliac Lat Pulldown', equipment_required: ['full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'pull', primary_muscle: 'lats', synergist_muscles: ['mid_back', 'biceps', 'rear_delts'], cns_fatigue_cost: 2, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'chest_supported_row', slug: 'chest_supported_row', name: 'Chest-Supported T-Bar Row', equipment_required: ['full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'pull', primary_muscle: 'mid_back', synergist_muscles: ['lats', 'rear_delts', 'biceps'], cns_fatigue_cost: 2, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: false }),
    ex({ id: 'pendlay_row', slug: 'pendlay_row', name: 'Pendlay Row', equipment_required: ['barbell', 'full_gym'], default_sets: 4, default_reps: 8, movement_pattern: 'pull', primary_muscle: 'mid_back', synergist_muscles: ['lats', 'rear_delts', 'erectors'], cns_fatigue_cost: 4, joint_stress_profile: 'lumbar_shear', stretch_mediated_hypertrophy: false }),
    ex({ id: 't_bar_row', slug: 't_bar_row', name: 'T-Bar Row', equipment_required: ['barbell', 'full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'pull', primary_muscle: 'mid_back', synergist_muscles: ['lats', 'biceps', 'erectors'], cns_fatigue_cost: 3, joint_stress_profile: 'lumbar_shear', stretch_mediated_hypertrophy: false }),
    ex({ id: 'dumbbell_row', slug: 'dumbbell_row', name: 'Single-Arm Dumbbell Row', equipment_required: ['dumbbells', 'full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'pull', primary_muscle: 'lats', synergist_muscles: ['mid_back', 'biceps', 'rear_delts'], cns_fatigue_cost: 2, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: false }),
    ex({ id: 'neutral_grip_pull_up', slug: 'neutral_grip_pull_up', name: 'Neutral-Grip Pull-Up', equipment_required: ['pull_up_bar', 'full_gym'], default_sets: 4, default_reps: 6, movement_pattern: 'pull', primary_muscle: 'lats', synergist_muscles: ['biceps', 'mid_back', 'core'], cns_fatigue_cost: 4, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'cable_pull_over', slug: 'cable_pull_over', name: 'Cable Pullover', equipment_required: ['full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'lats', synergist_muscles: ['chest', 'triceps'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'bayesian_curl', slug: 'bayesian_curl', name: 'Bayesian Cable Curl', equipment_required: ['full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'biceps', synergist_muscles: ['forearms'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'spider_curl', slug: 'spider_curl', name: 'Spider Curl (Incline Bench)', equipment_required: ['dumbbells', 'full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'biceps', synergist_muscles: ['forearms'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'preacher_curl_machine', slug: 'preacher_curl_machine', name: 'Preacher Curl (Machine)', equipment_required: ['full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'biceps', synergist_muscles: ['forearms'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'hammer_curl_incline', slug: 'hammer_curl_incline', name: 'Incline Hammer Curl', equipment_required: ['dumbbells', 'full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'biceps', synergist_muscles: ['forearms', 'brachialis'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'dumbbell_shrug', slug: 'dumbbell_shrug', name: 'Dumbbell Shrug', equipment_required: ['dumbbells', 'full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'traps', synergist_muscles: ['forearms'], cns_fatigue_cost: 2, joint_stress_profile: 'cervical_load', stretch_mediated_hypertrophy: false }),

    ex({ id: 'barbell_back_squat', slug: 'barbell_back_squat', name: 'Barbell Back Squat', equipment_required: ['barbell', 'full_gym'], default_sets: 4, default_reps: 6, movement_pattern: 'squat', primary_muscle: 'quadriceps', synergist_muscles: ['glutes', 'erectors', 'core'], cns_fatigue_cost: 5, joint_stress_profile: 'spinal_axial_load', stretch_mediated_hypertrophy: false }),
    ex({ id: 'pendulum_squat', slug: 'pendulum_squat', name: 'Pendulum Squat', equipment_required: ['full_gym'], default_sets: 3, default_reps: 10, movement_pattern: 'squat', primary_muscle: 'quadriceps', synergist_muscles: ['glutes'], cns_fatigue_cost: 3, joint_stress_profile: 'moderate_knee_stress', stretch_mediated_hypertrophy: true }),
    ex({ id: 'hack_squat_machine', slug: 'hack_squat_machine', name: 'Hack Squat (Machine)', equipment_required: ['full_gym'], default_sets: 4, default_reps: 8, movement_pattern: 'squat', primary_muscle: 'quadriceps', synergist_muscles: ['glutes'], cns_fatigue_cost: 3, joint_stress_profile: 'moderate_knee_stress', stretch_mediated_hypertrophy: false }),
    ex({ id: 'belt_squat', slug: 'belt_squat', name: 'Belt Squat', equipment_required: ['full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'squat', primary_muscle: 'quadriceps', synergist_muscles: ['glutes', 'adductors'], cns_fatigue_cost: 2, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: false }),
    ex({ id: 'deficit_bulgarian_split_squat', slug: 'deficit_bulgarian_split_squat', name: 'Deficit Bulgarian Split Squat', equipment_required: ['dumbbells', 'full_gym', 'bodyweight'], default_sets: 3, default_reps: 10, movement_pattern: 'lunge', primary_muscle: 'quadriceps', synergist_muscles: ['glutes', 'adductors', 'core'], cns_fatigue_cost: 4, joint_stress_profile: 'high_knee_shear', stretch_mediated_hypertrophy: true }),
    ex({ id: 'smith_machine_split_squat', slug: 'smith_machine_split_squat', name: 'Smith Machine Split Squat', equipment_required: ['full_gym'], default_sets: 3, default_reps: 10, movement_pattern: 'lunge', primary_muscle: 'quadriceps', synergist_muscles: ['glutes'], cns_fatigue_cost: 3, joint_stress_profile: 'moderate_knee_stress', stretch_mediated_hypertrophy: true }),
    ex({ id: 'walking_lunge', slug: 'walking_lunge', name: 'Walking Lunge', equipment_required: ['dumbbells', 'bodyweight', 'full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'lunge', primary_muscle: 'quadriceps', synergist_muscles: ['glutes', 'adductors'], cns_fatigue_cost: 3, joint_stress_profile: 'moderate_knee_stress', stretch_mediated_hypertrophy: false }),
    ex({ id: 'leg_extension', slug: 'leg_extension', name: 'Leg Extension', equipment_required: ['full_gym'], default_sets: 3, default_reps: 15, movement_pattern: 'isolation', primary_muscle: 'quadriceps', synergist_muscles: [], cns_fatigue_cost: 1, joint_stress_profile: 'moderate_knee_stress', stretch_mediated_hypertrophy: false }),
    ex({ id: 'barbell_romanian_deadlift', slug: 'barbell_romanian_deadlift', name: 'Barbell Romanian Deadlift', equipment_required: ['barbell', 'full_gym'], default_sets: 4, default_reps: 8, movement_pattern: 'hinge', primary_muscle: 'hamstrings', synergist_muscles: ['glutes', 'erectors'], cns_fatigue_cost: 4, joint_stress_profile: 'lumbar_shear', stretch_mediated_hypertrophy: true }),
    ex({ id: 'stiff_leg_deadlift', slug: 'stiff_leg_deadlift', name: 'Stiff-Leg Deadlift', equipment_required: ['barbell', 'dumbbells', 'full_gym'], default_sets: 3, default_reps: 10, movement_pattern: 'hinge', primary_muscle: 'hamstrings', synergist_muscles: ['glutes', 'erectors'], cns_fatigue_cost: 4, joint_stress_profile: 'lumbar_shear', stretch_mediated_hypertrophy: true }),
    ex({ id: 'hip_thrust_barbell', slug: 'hip_thrust_barbell', name: 'Barbell Hip Thrust', equipment_required: ['barbell', 'full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'hinge', primary_muscle: 'glutes', synergist_muscles: ['hamstrings', 'core'], cns_fatigue_cost: 3, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'seated_leg_curl', slug: 'seated_leg_curl', name: 'Seated Leg Curl', equipment_required: ['full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'hamstrings', synergist_muscles: ['calves'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'cable_kickback_glute', slug: 'cable_kickback_glute', name: 'Cable Glute Kickback', equipment_required: ['full_gym'], default_sets: 3, default_reps: 15, movement_pattern: 'isolation', primary_muscle: 'glutes', synergist_muscles: ['hamstrings'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: false }),
    ex({ id: 'seated_calf_raise', slug: 'seated_calf_raise', name: 'Seated Calf Raise', equipment_required: ['full_gym'], default_sets: 4, default_reps: 15, movement_pattern: 'isolation', primary_muscle: 'calves', synergist_muscles: [], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'standing_calf_raise', slug: 'standing_calf_raise', name: 'Standing Calf Raise', equipment_required: ['full_gym', 'bodyweight'], default_sets: 4, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'calves', synergist_muscles: [], cns_fatigue_cost: 2, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
  ];
}

describe('elite iron engine consolidation laws', () => {
  it('enforces weekly isolation memory, 90m time budget, additive shoulder 3D, and axial-load spacing', () => {
    const biological = {
      ...initialBiologicalProfile,
      frequency_iron: 6,
      preferred_split: 'ppl_x2' as const,
      available_time_iron: 90,
      goal_iron: 'Hypertrophy',
      iron_mastery: 5 as const,
      experience_level: 'advanced' as const,
    };

    const equipment: EquipmentTag[] = ['full_gym', 'barbell', 'dumbbells', 'bodyweight', 'pull_up_bar'];
    const microcycle = generateIronMicrocycle({
      libraryExercises: eliteSeedCatalog(),
      biological,
      equipment,
      logs7d: [],
      logs21d: [],
      ironDayIndices: [1, 2, 3, 4, 5, 6],
      weekStartDate: '2026-05-26',
      blockedJointProfiles: [],
      goalIron: biological.goal_iron,
      availableMinutes: 90,
    });

    expect(microcycle).toHaveLength(6);

    const isolationSlugs = microcycle.flatMap((day) =>
      day.picks
        .filter((pick) => pick.exercise.movement_pattern === 'isolation')
        .map((pick) => pick.exercise.slug),
    );
    expect(new Set(isolationSlugs).size).toBe(isolationSlugs.length);

    for (const day of microcycle) {
      expect(estimateSessionSeconds(day.picks, { exercises: [], byId: new Map(day.picks.map((pick) => [pick.exercise.id, pick.exercise])), bySlug: new Map(), byPattern: new Map(), byPrimaryMuscle: new Map() })).toBeLessThanOrEqual(90 * 60);
      expect(
        day.picks
          .filter((pick) => pick.exercise.movement_pattern === 'isolation')
          .every((pick) => pick.prescribedSets <= 4),
      ).toBe(true);
    }

    const allPicks = microcycle.flatMap((day) => day.picks);
    expect(allPicks.some((pick) => pick.exercise.slug === 'overhead_press')).toBe(true);
    expect(
      allPicks.some(
        (pick) =>
          pick.exercise.primary_muscle === 'side_delts' ||
          pick.exercise.primary_muscle === 'rear_delts' ||
          pick.slotId.includes('finisher') ||
          pick.slotId.includes('shoulder'),
      ),
    ).toBe(true);

    const shoulder = computeWeeklyShoulderBalance(microcycle);
    expect(shoulder.lateral + shoulder.posterior).toBeGreaterThan(0);

    const axialDays = microcycle
      .filter((day) => day.picks.some((pick) => isAxialLoadExercise(pick.exercise)))
      .map((day) => day.dayIndex);
    for (let i = 1; i < axialDays.length; i += 1) {
      expect(axialDays[i]! - axialDays[i - 1]!).toBeGreaterThan(1);
    }
  });
});

