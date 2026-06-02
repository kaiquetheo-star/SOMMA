import { describe, expect, it } from 'vitest';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import {
  createInitialSolverState,
  solveDaySlots,
} from '@/lib/gameplan/engine/iron/ConstraintSolver';
import { PPL_DAY_SLOTS } from '@/lib/gameplan/engine/iron/splits/pplSplit';
import { createWeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';

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

const DUMBBELL_LATERAL = mockSeedExercise({
  id: 'ex-db-lateral',
  slug: 'dumbbell_lateral_raise',
  name: 'Dumbbell Lateral Raise',
  movement_pattern: 'isolation',
  primary_muscle: 'side_delts',
  synergist_muscles: ['traps'],
  cns_fatigue_cost: 2,
  equipment_required: ['dumbbells', 'full_gym'],
});

/** Isolation with anterior synergist load — should lose vs cable when front_delts are fatigued. */
const LEANING_LATERAL_WITH_ANTERIOR_SYNERGIST = mockSeedExercise({
  id: 'ex-leaning-lateral',
  slug: 'leaning_lateral_raise',
  name: 'Leaning Lateral Raise',
  movement_pattern: 'isolation',
  primary_muscle: 'side_delts',
  synergist_muscles: ['front_delts', 'traps'],
  cns_fatigue_cost: 2,
});

const OVERHEAD_PRESS = mockSeedExercise({
  id: 'ex-ohp',
  slug: 'overhead_press',
  name: 'Standing Overhead Press',
  movement_pattern: 'push',
  primary_muscle: 'front_delts',
  synergist_muscles: ['triceps', 'upper_chest', 'core'],
  cns_fatigue_cost: 4,
  equipment_required: ['barbell', 'full_gym'],
  default_sets: 4,
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

describe('solveDaySlots — Push shoulder_lateral (3D shoulder rule)', () => {
  it('prefers cable lateral raise when front_delts are near MRV from prior volume', () => {
    const catalog = buildExerciseCatalog([
      CABLE_LATERAL,
      DUMBBELL_LATERAL,
      LEANING_LATERAL_WITH_ANTERIOR_SYNERGIST,
      OVERHEAD_PRESS,
      MACHINE_SHOULDER_PRESS,
    ]);

    const weekStartDate = '2026-05-26';
    const tracker = createWeeklyVolumeTracker(catalog, [], weekStartDate);

    const anteriorLoader = catalog.bySlug.get('machine_shoulder_press');
    expect(anteriorLoader).toBeDefined();
    tracker.creditVolume(anteriorLoader!, 18);

    expect(tracker.completedSetsForMuscle('front_delts')).toBe(18);

    const shoulderSlot = PPL_DAY_SLOTS.push.find((slot) => slot.slotId === 'shoulder_lateral');
    expect(shoulderSlot).toBeDefined();

    const equipment: EquipmentTag[] = ['full_gym', 'dumbbells', 'barbell'];
    const { picks } = solveDaySlots(
      'push',
      [shoulderSlot!],
      catalog,
      {
        equipment,
        blockedJointProfiles: [],
        maxSessionCns: 15,
        weekStartDate,
        targetArchetype: null,
      },
      createInitialSolverState(tracker),
      tracker,
    );

    expect(picks).toHaveLength(1);
    expect(picks[0]?.slotId).toBe('shoulder_lateral');

    const chosen = catalog.byId.get(picks[0]!.exerciseId);
    expect(chosen?.slug).toBe('cable_lateral_raise');

    const machinePress = catalog.bySlug.get('machine_shoulder_press');
    const overheadPress = catalog.bySlug.get('overhead_press');
    expect(machinePress).toBeDefined();
    expect(overheadPress).toBeDefined();
    expect(tracker.canAddSets(machinePress!, shoulderSlot!.defaultSets).allowed).toBe(false);
    expect(tracker.canAddSets(overheadPress!, shoulderSlot!.defaultSets).allowed).toBe(false);
  });
});
