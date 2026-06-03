import { describe, expect, it } from 'vitest';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import { mapToExerciseCueCard } from '@/lib/gameplan/engine/iron/cueMapper';
import { generateIronMicrocycle } from '@/lib/gameplan/engine/iron/generateIronMicrocycle';
import { initialBiologicalProfile } from '@/types/biological';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';

function ex(
  partial: Omit<LibraryExercise, 'biomechanical_instructions'> & {
    biomechanical_instructions?: Record<string, string>;
  },
): LibraryExercise {
  return {
    biomechanical_instructions: partial.biomechanical_instructions ?? {
      setup: 'Stable setup from seed.',
      eccentric: 'Control the eccentric.',
      concentric: 'Move through the target muscle.',
      safety: 'Stop when technique breaks.',
    },
    ...partial,
  };
}

function dupSeedCatalog(): LibraryExercise[] {
  return [
    ex({ id: 'barbell_bench_press', slug: 'barbell_bench_press', name: 'Barbell Bench Press', equipment_required: ['barbell', 'full_gym'], default_sets: 4, default_reps: 8, movement_pattern: 'push', primary_muscle: 'chest', synergist_muscles: ['front_delts', 'triceps'], cns_fatigue_cost: 4, joint_stress_profile: 'shoulder_impingement_risk', stretch_mediated_hypertrophy: false }),
    ex({ id: 'incline_dumbbell_press_30', slug: 'incline_dumbbell_press_30', name: 'Incline Dumbbell Press (30)', equipment_required: ['dumbbells', 'full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'push', primary_muscle: 'upper_chest', synergist_muscles: ['front_delts', 'triceps'], cns_fatigue_cost: 3, joint_stress_profile: 'shoulder_impingement_risk', stretch_mediated_hypertrophy: true }),
    ex({ id: 'machine_shoulder_press', slug: 'machine_shoulder_press', name: 'Machine Shoulder Press', equipment_required: ['full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'push', primary_muscle: 'front_delts', synergist_muscles: ['triceps', 'upper_chest'], cns_fatigue_cost: 3, joint_stress_profile: 'rotator_cuff_heavy', stretch_mediated_hypertrophy: false }),
    ex({ id: 'cable_lateral_raise', slug: 'cable_lateral_raise', name: 'Cable Lateral Raise', equipment_required: ['full_gym'], default_sets: 3, default_reps: 15, movement_pattern: 'isolation', primary_muscle: 'side_delts', synergist_muscles: ['traps'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: false }),
    ex({ id: 'incline_cable_fly', slug: 'incline_cable_fly', name: 'Incline Cable Fly', equipment_required: ['full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'upper_chest', synergist_muscles: ['front_delts'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'tricep_rope_pushdown', slug: 'tricep_rope_pushdown', name: 'Tricep Rope Pushdown', equipment_required: ['full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'triceps', synergist_muscles: [], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: false }),
    ex({ id: 'ez_bar_skullcrusher', slug: 'ez_bar_skullcrusher', name: 'EZ-Bar Skullcrusher', equipment_required: ['barbell', 'full_gym'], default_sets: 3, default_reps: 10, movement_pattern: 'isolation', primary_muscle: 'triceps', synergist_muscles: [], cns_fatigue_cost: 2, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),

    ex({ id: 'iliac_lat_pulldown', slug: 'iliac_lat_pulldown', name: 'Iliac Lat Pulldown', equipment_required: ['full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'pull', primary_muscle: 'lats', synergist_muscles: ['mid_back', 'biceps', 'rear_delts'], cns_fatigue_cost: 2, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'chest_supported_row', slug: 'chest_supported_row', name: 'Chest-Supported Row', equipment_required: ['full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'pull', primary_muscle: 'mid_back', synergist_muscles: ['lats', 'rear_delts', 'biceps'], cns_fatigue_cost: 2, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: false }),
    ex({ id: 'face_pull', slug: 'face_pull', name: 'Face Pull', equipment_required: ['full_gym'], default_sets: 3, default_reps: 15, movement_pattern: 'isolation', primary_muscle: 'rear_delts', synergist_muscles: ['traps', 'rotator_cuff'], cns_fatigue_cost: 1, joint_stress_profile: 'rotator_cuff_heavy', stretch_mediated_hypertrophy: false }),
    ex({ id: 'bayesian_curl', slug: 'bayesian_curl', name: 'Bayesian Cable Curl', equipment_required: ['full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'biceps', synergist_muscles: ['forearms'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'preacher_curl_machine', slug: 'preacher_curl_machine', name: 'Preacher Curl Machine', equipment_required: ['full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'biceps', synergist_muscles: ['forearms'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'dumbbell_shrug', slug: 'dumbbell_shrug', name: 'Dumbbell Shrug', equipment_required: ['dumbbells', 'full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'traps', synergist_muscles: ['forearms'], cns_fatigue_cost: 2, joint_stress_profile: 'cervical_load', stretch_mediated_hypertrophy: false }),

    ex({ id: 'barbell_back_squat', slug: 'barbell_back_squat', name: 'Barbell Back Squat', equipment_required: ['barbell', 'full_gym'], default_sets: 4, default_reps: 6, movement_pattern: 'squat', primary_muscle: 'quadriceps', synergist_muscles: ['glutes', 'erectors', 'core'], cns_fatigue_cost: 5, joint_stress_profile: 'spinal_axial_load', stretch_mediated_hypertrophy: false, biomechanical_instructions: { setup: 'High-bar or low-bar, brace 360 degrees, heels hip-width.', eccentric: 'Sit between hips; knees track toes; neutral spine.', concentric: 'Drive floor; hips and chest rise together.', safety: 'Safety bars set; avoid valgus collapse.' } }),
    ex({ id: 'hack_squat_machine', slug: 'hack_squat_machine', name: 'Hack Squat Machine', equipment_required: ['full_gym'], default_sets: 4, default_reps: 8, movement_pattern: 'squat', primary_muscle: 'quadriceps', synergist_muscles: ['glutes'], cns_fatigue_cost: 3, joint_stress_profile: 'moderate_knee_stress', stretch_mediated_hypertrophy: false }),
    ex({ id: 'deficit_bulgarian_split_squat', slug: 'deficit_bulgarian_split_squat', name: 'Deficit Bulgarian Split Squat', equipment_required: ['dumbbells', 'full_gym', 'bodyweight'], default_sets: 3, default_reps: 10, movement_pattern: 'lunge', primary_muscle: 'quadriceps', synergist_muscles: ['glutes', 'adductors', 'core'], cns_fatigue_cost: 3, joint_stress_profile: 'moderate_knee_stress', stretch_mediated_hypertrophy: true }),
    ex({ id: 'single_leg_leg_press', slug: 'single_leg_leg_press', name: 'Single-Leg Leg Press', equipment_required: ['full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'lunge', primary_muscle: 'quadriceps', synergist_muscles: ['glutes'], cns_fatigue_cost: 2, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: false }),
    ex({ id: 'leg_extension', slug: 'leg_extension', name: 'Leg Extension', equipment_required: ['full_gym'], default_sets: 3, default_reps: 15, movement_pattern: 'isolation', primary_muscle: 'quadriceps', synergist_muscles: [], cns_fatigue_cost: 1, joint_stress_profile: 'moderate_knee_stress', stretch_mediated_hypertrophy: false }),
    ex({ id: 'barbell_romanian_deadlift', slug: 'barbell_romanian_deadlift', name: 'Barbell Romanian Deadlift', equipment_required: ['barbell', 'full_gym'], default_sets: 4, default_reps: 8, movement_pattern: 'hinge', primary_muscle: 'hamstrings', synergist_muscles: ['glutes', 'erectors'], cns_fatigue_cost: 4, joint_stress_profile: 'lumbar_shear', stretch_mediated_hypertrophy: true }),
    ex({ id: 'hip_thrust_barbell', slug: 'hip_thrust_barbell', name: 'Barbell Hip Thrust', equipment_required: ['barbell', 'full_gym'], default_sets: 4, default_reps: 10, movement_pattern: 'hinge', primary_muscle: 'glutes', synergist_muscles: ['hamstrings', 'core'], cns_fatigue_cost: 3, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'seated_leg_curl', slug: 'seated_leg_curl', name: 'Seated Leg Curl', equipment_required: ['full_gym'], default_sets: 3, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'hamstrings', synergist_muscles: ['calves'], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'standing_calf_raise', slug: 'standing_calf_raise', name: 'Standing Calf Raise', equipment_required: ['full_gym', 'bodyweight'], default_sets: 4, default_reps: 12, movement_pattern: 'isolation', primary_muscle: 'calves', synergist_muscles: [], cns_fatigue_cost: 2, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
    ex({ id: 'seated_calf_raise', slug: 'seated_calf_raise', name: 'Seated Calf Raise', equipment_required: ['full_gym'], default_sets: 4, default_reps: 15, movement_pattern: 'isolation', primary_muscle: 'calves', synergist_muscles: [], cns_fatigue_cost: 1, joint_stress_profile: 'low_impact', stretch_mediated_hypertrophy: true }),
  ];
}

describe('DUP and Text-Only Elite cues', () => {
  it('A: applies six-day DUP ranges and includes unilateral stability on Legs B', () => {
    const equipment: EquipmentTag[] = ['full_gym', 'barbell', 'dumbbells', 'bodyweight'];
    const microcycle = generateIronMicrocycle({
      libraryExercises: dupSeedCatalog(),
      biological: {
        ...initialBiologicalProfile,
        frequency_iron: 6,
        available_time_iron: 90,
        goal_iron: 'Hypertrophy',
        iron_mastery: 3,
        experience_level: 'advanced',
      },
      equipment,
      logs7d: [],
      logs21d: [],
      ironDayIndices: [1, 2, 3, 4, 5, 6],
      weekStartDate: '2026-05-26',
      blockedJointProfiles: [],
      goalIron: 'Hypertrophy',
      availableMinutes: 90,
    });

    const legsA = microcycle.find((day) => day.ironSlotIndex === 2);
    const legsB = microcycle.find((day) => day.ironSlotIndex === 5);

    expect(legsA).toBeDefined();
    expect(legsB).toBeDefined();
    expect(legsA?.picks[0]?.prescription.target_reps).toBeGreaterThanOrEqual(5);
    expect(legsA?.picks[0]?.prescription.target_reps).toBeLessThanOrEqual(8);
    expect(['barbell_back_squat', 'hack_squat_machine']).toContain(legsA?.picks[0]?.exercise.slug);

    const legsBSlugs = legsB?.picks.map((pick) => pick.exercise.slug) ?? [];
    expect(legsB?.picks[0]?.prescription.target_reps).toBeGreaterThanOrEqual(10);
    expect(legsB?.picks[0]?.prescription.target_reps).toBeLessThanOrEqual(12);
    expect(legsBSlugs.some((slug) => slug === 'single_leg_leg_press' || slug === 'deficit_bulgarian_split_squat')).toBe(true);
  });

  it('B: injects squat tempo and technical failure cues for Legs A', () => {
    const catalog = buildExerciseCatalog(dupSeedCatalog());
    const squat = catalog.bySlug.get('barbell_back_squat');

    expect(squat).toBeDefined();
    const cueCard = mapToExerciseCueCard(squat!, 'pure_mechanical_tension');

    expect(squat?.tempo).toEqual([3, 1, 'X', 0]);
    expect(cueCard.failure_type).toBe('technical');
  });

  it('C: falls back to safe movement-pattern cues when JSONB is empty', () => {
    const catalog = buildExerciseCatalog([
      ex({
        id: 'fallback_push',
        slug: 'fallback_push',
        name: 'Fallback Push',
        biomechanical_instructions: {},
        equipment_required: ['full_gym'],
        default_sets: 3,
        default_reps: 10,
        movement_pattern: 'push',
        primary_muscle: 'chest',
        synergist_muscles: ['front_delts', 'triceps'],
        cns_fatigue_cost: 3,
        joint_stress_profile: 'low_impact',
        stretch_mediated_hypertrophy: false,
      }),
    ]);
    const exercise = catalog.bySlug.get('fallback_push');

    expect(exercise).toBeDefined();
    const cueCard = mapToExerciseCueCard(exercise!, 'metabolic_hypertrophy');

    expect(cueCard.setup).toContain('scapulae');
    expect(cueCard.setup).toContain('45 degrees');
    expect(cueCard.failure_type).toBe('technical');
    expect(cueCard.anti_pattern).toContain('scapular retraction');
  });
});
