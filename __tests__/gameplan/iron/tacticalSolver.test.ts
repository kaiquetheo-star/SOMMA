import { describe, expect, it } from 'vitest';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import {
  createInitialSolverState,
  solveDaySlots,
} from '@/lib/gameplan/engine/iron/ConstraintSolver';
import { createWeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import { initialBiologicalProfile } from '@/types/biological';
import type { LibraryExercise } from '@/types/catalog';
import type {
  SolverConstraints,
  SolverSlot,
} from '@/lib/gameplan/engine/iron/types';
import type { EquipmentTag } from '@/store/useSommaStore';

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

const BARBELL_SQUAT = mockExercise({
  id: 'ex-squat',
  slug: 'barbell_back_squat',
  name: 'Barbell Back Squat',
  movement_pattern: 'squat',
  primary_muscle: 'quadriceps',
  synergist_muscles: ['glutes', 'erectors'],
  cns_fatigue_cost: 5,
  joint_stress_profile: 'spinal_axial_load',
  equipment_required: ['barbell', 'full_gym'],
});

const BENT_OVER_ROW = mockExercise({
  id: 'ex-bent-row',
  slug: 'barbell_bent_over_row',
  name: 'Barbell Bent-Over Row',
  movement_pattern: 'pull',
  primary_muscle: 'back',
  synergist_muscles: ['biceps', 'erectors'],
  cns_fatigue_cost: 4,
  joint_stress_profile: 'lumbar_shear',
  equipment_required: ['barbell', 'full_gym'],
});

const SEATED_CABLE_ROW = mockExercise({
  id: 'ex-cable-row',
  slug: 'seated_cable_row',
  name: 'Seated Cable Row',
  movement_pattern: 'pull',
  primary_muscle: 'back',
  synergist_muscles: ['biceps'],
  cns_fatigue_cost: 3,
  joint_stress_profile: 'low_impact',
  equipment_required: ['full_gym'],
});

const BENCH_PRESS = mockExercise({
  id: 'ex-bench',
  slug: 'barbell_bench_press',
  name: 'Barbell Bench Press',
  movement_pattern: 'push',
  primary_muscle: 'chest',
  synergist_muscles: ['triceps', 'front_delts'],
  cns_fatigue_cost: 4,
  equipment_required: ['barbell', 'full_gym'],
});

const DUMBBELL_FLY = mockExercise({
  id: 'ex-fly',
  slug: 'dumbbell_fly',
  name: 'Dumbbell Fly',
  movement_pattern: 'isolation',
  primary_muscle: 'chest',
  synergist_muscles: [],
  cns_fatigue_cost: 2,
  equipment_required: ['dumbbells', 'full_gym'],
  default_reps: 12,
});

const HACK_SQUAT = mockExercise({
  id: 'ex-hack',
  slug: 'hack_squat',
  name: 'Hack Squat',
  movement_pattern: 'squat',
  primary_muscle: 'quadriceps',
  synergist_muscles: ['glutes'],
  cns_fatigue_cost: 4,
  equipment_required: ['full_gym'],
});

function defaultConstraints(overrides: Partial<SolverConstraints> = {}): SolverConstraints {
  const equipment: EquipmentTag[] = ['full_gym', 'barbell', 'dumbbells'];
  return {
    available_equipment: equipment,
    equipment,
    blockedJointProfiles: [],
    maxSessionCns: 15,
    iron_mastery: 3,
    available_time_minutes: 20,
    weekStartDate: '2026-06-08',
    ...overrides,
  };
}

describe('solveDaySlots — V9 tactical intelligence', () => {
  it('rejects lumbar-heavy rowing after a heavy squat and selects a low-axial row', () => {
    const catalog = buildExerciseCatalog([BARBELL_SQUAT, BENT_OVER_ROW, SEATED_CABLE_ROW]);
    const tracker = createWeeklyVolumeTracker(catalog, [], [], initialBiologicalProfile);
    const slots: SolverSlot[] = [
      {
        slotId: 'quad_primary',
        day: 'legs',
        requiredPatterns: ['squat'],
        primaryMuscleHint: 'quads',
        defaultSets: 3,
      },
      {
        slotId: 'back_horizontal',
        day: 'pull',
        requiredPatterns: ['pull'],
        primaryMuscleHint: 'back',
        defaultSets: 3,
      },
    ];

    const { picks } = solveDaySlots(
      'legs',
      slots,
      catalog,
      defaultConstraints(),
      createInitialSolverState(tracker),
      tracker,
    );

    const slugs = picks.map((pick) => catalog.byId.get(pick.exerciseId)?.slug);
    expect(slugs).toContain('barbell_back_squat');
    expect(slugs).toContain('seated_cable_row');
    expect(slugs).not.toContain('barbell_bent_over_row');
  });

  it('orders primary compounds before isolations even when the isolation slot is filled first', () => {
    const catalog = buildExerciseCatalog([DUMBBELL_FLY, BENCH_PRESS]);
    const tracker = createWeeklyVolumeTracker(catalog, [], [], initialBiologicalProfile);
    const slots: SolverSlot[] = [
      {
        slotId: 'chest_iso',
        day: 'push',
        requiredPatterns: ['isolation'],
        primaryMuscleHint: 'chest',
        isolationOnly: true,
        defaultSets: 3,
      },
      {
        slotId: 'chest_compound_a',
        day: 'push',
        requiredPatterns: ['push'],
        primaryMuscleHint: 'chest',
        defaultSets: 3,
      },
    ];

    const { picks } = solveDaySlots(
      'push',
      slots,
      catalog,
      defaultConstraints(),
      createInitialSolverState(tracker),
      tracker,
    );

    expect(picks.map((pick) => catalog.byId.get(pick.exerciseId)?.slug)).toEqual([
      'barbell_bench_press',
      'dumbbell_fly',
    ]);
  });

  it('prefers low-stability-demand machine work over barbell squat under high CNS fatigue', () => {
    const catalog = buildExerciseCatalog([BARBELL_SQUAT, HACK_SQUAT]);
    const tracker = createWeeklyVolumeTracker(catalog, [], [], initialBiologicalProfile);
    const slot: SolverSlot = {
      slotId: 'quad_primary',
      day: 'legs',
      requiredPatterns: ['squat'],
      primaryMuscleHint: 'quads',
      defaultSets: 3,
    };

    const { picks } = solveDaySlots(
      'legs',
      [slot],
      catalog,
      defaultConstraints({ cns_fatigue_score: 85 }),
      createInitialSolverState(tracker),
      tracker,
    );

    const chosen = catalog.byId.get(picks[0]!.exerciseId);
    expect(chosen?.slug).toBe('hack_squat');
    expect(chosen?.stability_demand).toBe('low');
    expect(chosen?.axial_loading).toBeLessThanOrEqual(1);
  });
});
