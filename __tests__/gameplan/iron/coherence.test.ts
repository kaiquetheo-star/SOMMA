import { describe, expect, it } from 'vitest';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import {
  autoCorrectMicrocycle,
  cloneMicrocycle,
  syncMicrocycleToTracker,
  validateMicrocycleCoherence,
} from '@/lib/gameplan/engine/iron/CoherenceValidator';
import { createWeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import type { MicrocycleDayPlan } from '@/lib/gameplan/engine/iron/types';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';
import type { SolverConstraints } from '@/lib/gameplan/engine/iron/types';

function mockSeedExercise(
  partial: Pick<LibraryExercise, 'id' | 'slug' | 'name'> &
    Partial<
      Pick<
        LibraryExercise,
        | 'movement_pattern'
        | 'primary_muscle'
        | 'synergist_muscles'
        | 'cns_fatigue_cost'
        | 'joint_stress_profile'
        | 'equipment_required'
        | 'default_sets'
        | 'default_reps'
        | 'stretch_mediated_hypertrophy'
      >
    >,
): LibraryExercise {
  return {
    biomechanical_instructions: {},
    equipment_required: ['full_gym'],
    default_sets: 4,
    default_reps: 10,
    movement_pattern: 'push',
    primary_muscle: 'chest',
    synergist_muscles: [],
    cns_fatigue_cost: 3,
    joint_stress_profile: 'low_impact',
    stretch_mediated_hypertrophy: false,
    ...partial,
  };
}

const SEED_FIXTURES: LibraryExercise[] = [
  mockSeedExercise({
    id: 'ex-ohp',
    slug: 'overhead_press',
    name: 'Standing Overhead Press',
    movement_pattern: 'push',
    primary_muscle: 'front_delts',
    synergist_muscles: ['triceps', 'upper_chest', 'core'],
    cns_fatigue_cost: 4,
    equipment_required: ['barbell', 'full_gym'],
  }),
  mockSeedExercise({
    id: 'ex-incline',
    slug: 'incline_dumbbell_press_30',
    name: 'Incline Dumbbell Press (30°)',
    movement_pattern: 'push',
    primary_muscle: 'upper_chest',
    synergist_muscles: ['front_delts', 'triceps'],
    cns_fatigue_cost: 3,
    equipment_required: ['dumbbells', 'full_gym'],
  }),
  mockSeedExercise({
    id: 'ex-bench',
    slug: 'barbell_bench_press',
    name: 'Barbell Bench Press',
    movement_pattern: 'push',
    primary_muscle: 'chest',
    synergist_muscles: ['front_delts', 'triceps'],
    cns_fatigue_cost: 4,
    equipment_required: ['barbell', 'full_gym'],
  }),
  mockSeedExercise({
    id: 'ex-cable-lateral',
    slug: 'cable_lateral_raise',
    name: 'Cable Lateral Raise',
    movement_pattern: 'isolation',
    primary_muscle: 'side_delts',
    synergist_muscles: ['traps'],
    cns_fatigue_cost: 1,
    default_sets: 3,
    default_reps: 15,
  }),
  mockSeedExercise({
    id: 'ex-reverse-pec',
    slug: 'reverse_pec_deck',
    name: 'Reverse Pec Deck',
    movement_pattern: 'isolation',
    primary_muscle: 'rear_delts',
    synergist_muscles: ['mid_back', 'traps'],
    cns_fatigue_cost: 1,
    default_sets: 3,
    default_reps: 15,
  }),
  mockSeedExercise({
    id: 'ex-fly',
    slug: 'dumbbell_fly_flat',
    name: 'Dumbbell Fly (Flat)',
    movement_pattern: 'isolation',
    primary_muscle: 'chest',
    synergist_muscles: ['front_delts'],
    cns_fatigue_cost: 1,
    default_sets: 3,
    equipment_required: ['dumbbells', 'full_gym'],
  }),
  mockSeedExercise({
    id: 'ex-row',
    slug: 'dumbbell_row',
    name: 'Single-Arm Dumbbell Row',
    movement_pattern: 'pull',
    primary_muscle: 'lats',
    synergist_muscles: ['mid_back', 'biceps', 'rear_delts'],
    cns_fatigue_cost: 2,
    equipment_required: ['dumbbells', 'full_gym'],
  }),
  mockSeedExercise({
    id: 'ex-pulldown',
    slug: 'iliac_lat_pulldown',
    name: 'Iliac Lat Pulldown',
    movement_pattern: 'pull',
    primary_muscle: 'lats',
    synergist_muscles: ['mid_back', 'biceps', 'rear_delts'],
    cns_fatigue_cost: 2,
  }),
  mockSeedExercise({
    id: 'ex-supported-row',
    slug: 'chest_supported_row',
    name: 'Chest-Supported T-Bar Row',
    movement_pattern: 'pull',
    primary_muscle: 'mid_back',
    synergist_muscles: ['lats', 'rear_delts', 'biceps'],
    cns_fatigue_cost: 2,
  }),
];

function defaultConstraints(weekStartDate = '2026-05-26'): SolverConstraints {
  return {
    equipment: ['full_gym', 'barbell', 'dumbbells'] as EquipmentTag[],
    blockedJointProfiles: [],
    maxSessionCns: 15,
    weekStartDate,
    targetArchetype: null,
  };
}

function buildTrackerForMicrocycle(
  catalog: ReturnType<typeof buildExerciseCatalog>,
  microcycle: MicrocycleDayPlan[],
) {
  const tracker = createWeeklyVolumeTracker(catalog, [], '2026-05-26');
  syncMicrocycleToTracker(tracker, catalog, microcycle);
  return tracker;
}

describe('validateMicrocycleCoherence', () => {
  it('flags SHOULDER_IMBALANCE and auto-corrects with cable_lateral_raise from seed', () => {
    const catalog = buildExerciseCatalog(SEED_FIXTURES);
    const microcycle: MicrocycleDayPlan[] = [
      {
        day: 'push',
        picks: [
          { slotId: 'chest_compound_a', exerciseId: 'ex-ohp', prescribedSets: 4 },
          { slotId: 'chest_compound_b', exerciseId: 'ex-incline', prescribedSets: 4 },
        ],
      },
    ];

    const constraints = defaultConstraints();
    const tracker = buildTrackerForMicrocycle(catalog, microcycle);

    const initial = validateMicrocycleCoherence(microcycle, catalog, constraints, tracker);
    expect(initial.ok).toBe(false);
    expect(initial.violations.some((v) => v.code === 'SHOULDER_IMBALANCE')).toBe(true);

    const draft = cloneMicrocycle(microcycle);
    const corrected = autoCorrectMicrocycle(draft, catalog, constraints, tracker);

    expect(corrected.ok).toBe(true);
    expect(corrected.swaps.length).toBeGreaterThan(0);

    const lateralSlug = draft
      .find((day) => day.day === 'push')
      ?.picks.find((pick) => pick.slotId === 'shoulder_lateral');

    const rearSlug = draft
      .find((day) => day.day === 'pull')
      ?.picks.find((pick) => pick.exerciseId === 'ex-reverse-pec');

    const addedLateral = lateralSlug
      ? catalog.byId.get(lateralSlug.exerciseId)?.slug
      : undefined;
    const addedRear = rearSlug ? catalog.byId.get(rearSlug.exerciseId)?.slug : undefined;

    expect(
      addedLateral === 'cable_lateral_raise' || addedRear === 'reverse_pec_deck',
    ).toBe(true);
  });

  it('flags PUSH_PULL_RATIO and auto-corrects chest/back imbalance toward ~1.0', () => {
    const catalog = buildExerciseCatalog(SEED_FIXTURES);
    const microcycle: MicrocycleDayPlan[] = [
      {
        day: 'push',
        picks: [
          { slotId: 'chest_compound_a', exerciseId: 'ex-bench', prescribedSets: 8 },
          { slotId: 'chest_compound_b', exerciseId: 'ex-incline', prescribedSets: 6 },
          { slotId: 'chest_iso', exerciseId: 'ex-fly', prescribedSets: 6 },
        ],
      },
      {
        day: 'pull',
        picks: [
          { slotId: 'back_vertical', exerciseId: 'ex-pulldown', prescribedSets: 4 },
          { slotId: 'back_horizontal', exerciseId: 'ex-supported-row', prescribedSets: 4 },
        ],
      },
    ];

    const constraints = defaultConstraints();
    const tracker = buildTrackerForMicrocycle(catalog, microcycle);

    const initial = validateMicrocycleCoherence(microcycle, catalog, constraints, tracker);
    expect(initial.ok).toBe(false);
    expect(initial.violations.some((v) => v.code === 'PUSH_PULL_RATIO')).toBe(true);

    const draft = cloneMicrocycle(microcycle);
    const corrected = autoCorrectMicrocycle(draft, catalog, constraints, tracker);

    expect(corrected.ok).toBe(true);

    let chestSets = 0;
    let backSets = 0;
    for (const day of draft) {
      for (const pick of day.picks) {
        const exercise = catalog.byId.get(pick.exerciseId);
        if (!exercise) continue;
        if (exercise.primary_muscle === 'chest' || exercise.primary_muscle === 'upper_chest') {
          chestSets += pick.prescribedSets;
        }
        if (
          exercise.primary_muscle === 'back' ||
          exercise.primary_muscle === 'lats' ||
          exercise.primary_muscle === 'mid_back'
        ) {
          backSets += pick.prescribedSets;
        }
      }
    }

    const ratio = chestSets / backSets;
    expect(ratio).toBeGreaterThanOrEqual(0.85);
    expect(ratio).toBeLessThanOrEqual(1.15);
    expect(corrected.swaps.some((swap) => swap.reason === 'PUSH_PULL_RATIO')).toBe(true);
  });
});
