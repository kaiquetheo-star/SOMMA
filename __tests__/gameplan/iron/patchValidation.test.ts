import { describe, expect, it } from 'vitest';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import {
  createInitialSolverState,
  solveDaySlots,
} from '@/lib/gameplan/engine/iron/ConstraintSolver';
import {
  createWeeklyVolumeTracker,
  MAX_TRACKED_SETS_PER_EXERCISE,
} from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import { initialBiologicalProfile } from '@/types/biological';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import type {
  SolverConstraints,
  SolverSlot,
} from '@/lib/gameplan/engine/iron/types';
import type { EquipmentTag } from '@/store/useSommaStore';
import type { LibraryExercise } from '@/types/catalog';

function mockExercise(
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
    default_sets: 3,
    default_reps: 12,
    movement_pattern: 'isolation',
    primary_muscle: 'side_delts',
    synergist_muscles: [],
    cns_fatigue_cost: 1,
    joint_stress_profile: 'low_impact',
    stretch_mediated_hypertrophy: false,
    ...partial,
  };
}

function defaultConstraints(overrides: Partial<SolverConstraints> = {}): SolverConstraints {
  const equipment: EquipmentTag[] = ['full_gym', 'barbell', 'dumbbells'];
  return {
    available_equipment: equipment,
    equipment,
    blockedJointProfiles: [],
    maxSessionCns: 15,
    iron_mastery: 3,
    available_time_minutes: 5,
    weekStartDate: '2026-05-26',
    targetArchetype: null,
    ...overrides,
  };
}

function ironLogWithSetCount(exerciseId: string, setCount: number): EnginePerformanceRow {
  return {
    pillar: 'iron',
    exercise_id: exerciseId,
    weight_used: null,
    reps_completed: null,
    rpe_score: 7,
    timestamp: '2026-05-27T10:00:00.000Z',
    payload: {
      iron: {
        exercise_id: exerciseId,
        sets: Array.from({ length: setCount }, () => ({ reps: 12, weight_kg: 40 })),
      },
    },
  };
}

const LOW_CNS_ISOLATIONS: LibraryExercise[] = Array.from({ length: 8 }, (_, index) =>
  mockExercise({
    id: `ex-low-cns-iso-${index}`,
    slug: `low_cns_iso_${index}`,
    name: `Low CNS Isolation ${index}`,
    movement_pattern: 'isolation',
    primary_muscle: index % 2 === 0 ? 'side_delts' : 'triceps',
    cns_fatigue_cost: 1,
  }),
);

const PUSH_UP = mockExercise({
  id: 'ex-push-up',
  slug: 'push_up',
  name: 'Push-up',
  movement_pattern: 'push',
  primary_muscle: 'chest',
  synergist_muscles: ['triceps', 'front_delts'],
  cns_fatigue_cost: 2,
  equipment_required: [],
});

const LAT_PULLDOWN = mockExercise({
  id: 'ex-lat-pulldown',
  slug: 'lat_pulldown',
  name: 'Lat Pulldown',
  movement_pattern: 'pull',
  primary_muscle: 'back',
  synergist_muscles: ['biceps', 'rear_delts'],
  cns_fatigue_cost: 2,
});

const BARBELL_BACK_SQUAT = mockExercise({
  id: 'ex-barbell-back-squat',
  slug: 'barbell_back_squat',
  name: 'Barbell Back Squat',
  movement_pattern: 'squat',
  primary_muscle: 'quadriceps',
  synergist_muscles: ['glutes', 'erectors'],
  cns_fatigue_cost: 5,
  joint_stress_profile: 'spinal_axial_load',
  equipment_required: ['barbell', 'full_gym'],
});

const CABLE_FLY = mockExercise({
  id: 'ex-cable-fly',
  slug: 'cable_fly',
  name: 'Cable Fly',
  movement_pattern: 'isolation',
  primary_muscle: 'chest',
  cns_fatigue_cost: 1,
});

describe('Iron patch validation: Finisher Hard Cap', () => {
  it('caps low-CNS isolation work at 4 sets even when the time budget tries to inflate volume', () => {
    const catalog = buildExerciseCatalog(LOW_CNS_ISOLATIONS);
    const tracker = createWeeklyVolumeTracker(catalog, [], [], initialBiologicalProfile);
    const slots: SolverSlot[] = Array.from({ length: 7 }, (_, index) => ({
      slotId: `pump_slot_${index}`,
      day: 'push',
      requiredPatterns: ['isolation'],
      isolationOnly: true,
      defaultSets: 3,
    }));

    const { picks } = solveDaySlots(
      'push',
      slots,
      catalog,
      defaultConstraints({ available_time_minutes: 240 }),
      createInitialSolverState(tracker),
      tracker,
    );

    const isolationPicks = picks.filter((pick) => {
      const exercise = catalog.byId.get(pick.exerciseId);
      return exercise?.movement_pattern === 'isolation' || pick.slotId.includes('finisher');
    });

    // Elite hypertrophy uses finishers to spend local fatigue, not to prescribe 30 junk sets.
    expect(isolationPicks.length).toBeGreaterThanOrEqual(7);
    expect(isolationPicks.some((pick) => pick.prescribedSets === 4)).toBe(true);
    expect(isolationPicks.every((pick) => pick.prescribedSets <= 4)).toBe(true);
  });
});

describe('Iron patch validation: Minimum Viable Workout Fallback', () => {
  it('injects 2 deload-volume exercises when MRV/CNS constraints would otherwise deadlock the day', () => {
    const catalog = buildExerciseCatalog([PUSH_UP, LAT_PULLDOWN, BARBELL_BACK_SQUAT]);
    const tracker = createWeeklyVolumeTracker(catalog, [], [], initialBiologicalProfile);

    for (let i = 0; i < 3; i += 1) {
      tracker.creditVolume(catalog.bySlug.get('push_up')!, MAX_TRACKED_SETS_PER_EXERCISE);
      tracker.creditVolume(catalog.bySlug.get('lat_pulldown')!, MAX_TRACKED_SETS_PER_EXERCISE);
    }

    const slots: SolverSlot[] = [
      {
        slotId: 'basic_push',
        day: 'push',
        requiredPatterns: ['push'],
        defaultSets: 3,
      },
      {
        slotId: 'basic_pull',
        day: 'push',
        requiredPatterns: ['pull'],
        defaultSets: 3,
      },
      {
        slotId: 'blocked_axial',
        day: 'push',
        requiredPatterns: ['squat'],
        defaultSets: 3,
      },
    ];

    const { picks } = solveDaySlots(
      'push',
      slots,
      catalog,
      defaultConstraints({
        blockedJointProfiles: ['spinal_axial_load'],
        iron_mastery: 5,
        maxSessionCns: 1,
      }),
      createInitialSolverState(tracker),
      tracker,
    );

    const exercises = picks.map((pick) => ({
      ...pick,
      target_sets: pick.prescribedSets,
      exercise: catalog.byId.get(pick.exerciseId),
    }));

    // When MRV is already saturated, the correct coaching response is a deload protocol,
    // not an empty workout screen that abandons the training day.
    expect(exercises).toHaveLength(2);
    expect(exercises.every((exercise) => exercise.target_sets === 2)).toBe(true);
    expect(exercises.map((exercise) => exercise.exercise?.slug).sort()).toEqual([
      'lat_pulldown',
      'push_up',
    ]);
    expect(exercises.every((exercise) => exercise.exercise?.joint_stress_profile !== 'spinal_axial_load')).toBe(true);
  });
});

describe('Iron patch validation: Tracker Sanitization & Anti-Poisoning', () => {
  it('caps a 30-set anomaly at 8 sets so chronic volume does not poison the next prescription', () => {
    const catalog = buildExerciseCatalog([CABLE_FLY]);
    const anomalousLog = ironLogWithSetCount('ex-cable-fly', 30);
    const tracker = createWeeklyVolumeTracker(
      catalog,
      [anomalousLog],
      [anomalousLog],
      initialBiologicalProfile,
    );
    const cableFly = catalog.bySlug.get('cable_fly')!;

    // ACWR and weekly volume should reflect plausible effective sets; one corrupted 30-set
    // payload must not make the athlete look like they exceeded MRV for the whole week.
    expect(tracker.completedSetsForMuscle('chest')).toBe(MAX_TRACKED_SETS_PER_EXERCISE);
    expect(tracker.canAddSets(cableFly, 1).allowed).toBe(true);

    const freshTracker = createWeeklyVolumeTracker(catalog, [], [], initialBiologicalProfile);
    expect(freshTracker.canAddSets(cableFly, 30).clampedSets).toBe(MAX_TRACKED_SETS_PER_EXERCISE);
  });
});
