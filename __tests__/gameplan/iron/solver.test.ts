import { describe, expect, it } from 'vitest';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import {
  createInitialSolverState,
  solveDaySlots,
} from '@/lib/gameplan/engine/iron/ConstraintSolver';
import { mapToIronPrescription } from '@/lib/gameplan/engine/iron/loadPrescriptionMapper';
import { createWeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import { lastLoggedWeightFromPerformanceHistory } from '@/lib/iron/lastLoggedWeight';
import { initialBiologicalProfile } from '@/types/biological';
import type { PerformanceLogEntry } from '@/types/performance';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';
import type {
  SolverConstraints,
  SolverSlot,
} from '@/lib/gameplan/engine/iron/types';

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
    default_sets: 3,
    default_reps: 12,
    movement_pattern: 'isolation',
    primary_muscle: 'side_delts',
    synergist_muscles: [],
    cns_fatigue_cost: 2,
    joint_stress_profile: 'low_impact',
    stretch_mediated_hypertrophy: false,
    ...partial,
  };
}

const CABLE_LATERAL = mockSeedExercise({
  id: 'ex-cable-lateral',
  slug: 'cable_lateral_raise',
  name: 'Cable Lateral Raise',
  movement_pattern: 'isolation',
  primary_muscle: 'side_delts',
  synergist_muscles: ['traps'],
  cns_fatigue_cost: 1,
});

const MACHINE_SHOULDER_PRESS = mockSeedExercise({
  id: 'ex-machine-press',
  slug: 'machine_shoulder_press',
  name: 'Machine Shoulder Press',
  movement_pattern: 'push',
  primary_muscle: 'front_delts',
  synergist_muscles: ['triceps', 'upper_chest'],
  cns_fatigue_cost: 3,
});

const BARBELL_BACK_SQUAT = mockSeedExercise({
  id: 'ex-barbell-back-squat',
  slug: 'barbell_back_squat',
  name: 'Barbell Back Squat',
  movement_pattern: 'squat',
  primary_muscle: 'quadriceps',
  synergist_muscles: ['glutes', 'erectors', 'core'],
  cns_fatigue_cost: 5,
  joint_stress_profile: 'spinal_axial_load',
  equipment_required: ['barbell', 'full_gym'],
  default_sets: 4,
  default_reps: 6,
});

const BELT_SQUAT = mockSeedExercise({
  id: 'ex-belt-squat',
  slug: 'belt_squat',
  name: 'Belt Squat',
  movement_pattern: 'squat',
  primary_muscle: 'quadriceps',
  synergist_muscles: ['glutes'],
  cns_fatigue_cost: 2,
  joint_stress_profile: 'low_impact',
  equipment_required: ['full_gym'],
  default_sets: 4,
  default_reps: 10,
});

const LEG_EXTENSION = mockSeedExercise({
  id: 'ex-leg-extension',
  slug: 'leg_extension',
  name: 'Leg Extension',
  movement_pattern: 'isolation',
  primary_muscle: 'quadriceps',
  synergist_muscles: [],
  cns_fatigue_cost: 1,
  joint_stress_profile: 'low_impact',
});

const BARBELL_RDL = mockSeedExercise({
  id: 'ex-barbell-rdl',
  slug: 'barbell_romanian_deadlift',
  name: 'Barbell Romanian Deadlift',
  movement_pattern: 'hinge',
  primary_muscle: 'hamstrings',
  synergist_muscles: ['glutes', 'erectors'],
  cns_fatigue_cost: 4,
  joint_stress_profile: 'lumbar_shear',
  equipment_required: ['barbell', 'full_gym'],
});

const FACE_PULL = mockSeedExercise({
  id: 'ex-face-pull',
  slug: 'face_pull',
  name: 'Face Pull',
  movement_pattern: 'isolation',
  primary_muscle: 'rear_delts',
  synergist_muscles: ['traps', 'rotator_cuff'],
  cns_fatigue_cost: 1,
  joint_stress_profile: 'rotator_cuff_heavy',
});

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
    ...overrides,
  };
}

describe('solveDaySlots — V8 constraint solver', () => {
  it('A: prioritizes cable lateral raise over machine shoulder press by X-Frame score', () => {
    const catalog = buildExerciseCatalog([CABLE_LATERAL, MACHINE_SHOULDER_PRESS]);
    const tracker = createWeeklyVolumeTracker(catalog, [], [], initialBiologicalProfile);
    const shoulderSlot: SolverSlot = {
      slotId: 'shoulder_x_frame',
      day: 'push',
      requiredPatterns: ['isolation', 'push'],
      defaultSets: 3,
    };

    const { picks } = solveDaySlots(
      'push',
      [shoulderSlot],
      catalog,
      defaultConstraints(),
      createInitialSolverState(tracker),
      tracker,
    );

    expect(picks).toHaveLength(1);
    const chosen = catalog.byId.get(picks[0]!.exerciseId);
    expect(chosen?.slug).toBe('cable_lateral_raise');
    expect(chosen?.selection_score).toBe(3.0);
    expect(catalog.bySlug.get('machine_shoulder_press')?.selection_score).toBe(1.0);
  });

  it('B: in recovery mode rejects axial squats and selects low-CNS legs work', () => {
    const catalog = buildExerciseCatalog([BARBELL_BACK_SQUAT, BELT_SQUAT, LEG_EXTENSION]);
    const tracker = createWeeklyVolumeTracker(catalog, [], [], {
      ...initialBiologicalProfile,
      hormonal_transition: true,
    });
    const legSlot: SolverSlot = {
      slotId: 'legs_recovery',
      day: 'legs',
      requiredPatterns: ['squat', 'isolation'],
      primaryMuscleHint: 'quads',
      defaultSets: 3,
    };

    const state = {
      ...createInitialSolverState(tracker),
      isRecoveryMode: true,
    };
    const { picks } = solveDaySlots('legs', [legSlot], catalog, defaultConstraints(), state, tracker);

    expect(tracker.isRecoveryMode).toBe(true);
    expect(picks).toHaveLength(1);
    const chosen = catalog.byId.get(picks[0]!.exerciseId);
    expect(chosen?.slug).not.toBe('barbell_back_squat');
    expect(['belt_squat', 'leg_extension']).toContain(chosen?.slug);
    expect(chosen?.cns_fatigue_cost).toBeLessThanOrEqual(2);
    expect(chosen?.joint_stress_profile).toBe('low_impact');
  });

  it('C: blocks squat and hinge patterns on legs after HIIT', () => {
    const catalog = buildExerciseCatalog([BARBELL_BACK_SQUAT, BARBELL_RDL]);
    const tracker = createWeeklyVolumeTracker(catalog, [], [], initialBiologicalProfile);
    const postHiitSlot: SolverSlot = {
      slotId: 'post_hiit_legs',
      day: 'legs',
      requiredPatterns: ['squat', 'hinge'],
      defaultSets: 3,
    };

    const { picks } = solveDaySlots(
      'legs',
      [postHiitSlot],
      catalog,
      defaultConstraints({ previousDayWasHiit: true }),
      createInitialSolverState(tracker),
      tracker,
    );

    expect(picks).toHaveLength(0);
  });

  it('D: blocks exact duplicate isolation exercises across the microcycle', () => {
    const catalog = buildExerciseCatalog([FACE_PULL]);
    const tracker = createWeeklyVolumeTracker(catalog, [], [], initialBiologicalProfile);
    const facePullSlot: SolverSlot = {
      slotId: 'rear_delt_health',
      day: 'pull',
      requiredPatterns: ['isolation'],
      primaryMuscleHint: 'rear_delts',
      isolationOnly: true,
      defaultSets: 3,
    };

    const first = solveDaySlots(
      'pull',
      [facePullSlot],
      catalog,
      defaultConstraints(),
      createInitialSolverState(tracker),
      tracker,
    );

    const second = solveDaySlots(
      'pull',
      [facePullSlot],
      catalog,
      defaultConstraints(),
      first.state,
      tracker,
    );

    expect(first.picks).toHaveLength(1);
    expect(catalog.byId.get(first.picks[0]!.exerciseId)?.slug).toBe('face_pull');
    expect(second.picks).toHaveLength(0);
  });

  it('E: recovers prior logged weight from local performance history for prescription', () => {
    const catalog = buildExerciseCatalog([CABLE_LATERAL]);
    const exercise = catalog.byId.get('ex-cable-lateral')!;
    const logs21d: EnginePerformanceRow[] = [
      {
        pillar: 'iron',
        exercise_id: exercise.id,
        weight_used: 20,
        reps_completed: 12,
        rpe_score: 7,
        timestamp: '2026-06-20T18:00:00.000Z',
        payload: {
          iron: {
            exercise_id: exercise.id,
            sets: [{ weight_kg: 20, reps: 12, reported_rir: 2, target_rir: 2 }],
          },
        },
      },
    ];

    const prescription = mapToIronPrescription(
      {
        slotId: 'shoulder_x_frame',
        exerciseId: exercise.id,
        prescribedSets: 3,
        score: 1,
        diagnostic_reason: 'test',
        intensity_technique: 'standard',
      },
      exercise,
      null,
      logs21d,
      'Hypertrophy',
      null,
    );

    expect(prescription.target_weight_kg).toBeCloseTo(20.5, 1);
    expect(prescription.progression_note).toMatch(/Last logged|RPE/i);
  });

  it('F: lastLoggedWeightFromPerformanceHistory reads committed session logs', () => {
    const performanceLogs: PerformanceLogEntry[] = [
      {
        id: 'session-1',
        type: 'session',
        pillar: 'iron',
        block_id: 'block-d1-iron',
        timestamp: '2026-06-20T18:00:00.000Z',
        data: {
          sessionId: 'session-1',
          blockId: 'block-d1-iron',
          completedAt: '2026-06-20T18:00:00.000Z',
          exercises: [
            {
              exerciseId: 'ex-barbell-back-squat',
              exerciseSlug: 'barbell_back_squat',
              exerciseName: 'Barbell Back Squat',
              completedAt: '2026-06-20T18:00:00.000Z',
              sets: [
                {
                  setIndex: 1,
                  weightKg: 120,
                  reps: 5,
                  rir: 2,
                  restSecondsUsed: 120,
                  loggedAt: '2026-06-20T18:00:00.000Z',
                  targetReps: 5,
                  targetRir: 2,
                },
              ],
            },
          ],
        },
      },
    ];

    expect(
      lastLoggedWeightFromPerformanceHistory(
        'ex-barbell-back-squat',
        performanceLogs,
        null,
        undefined,
        'barbell_back_squat',
      ),
    ).toBe(120);
  });
});
