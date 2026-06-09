import { describe, expect, it } from 'vitest';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import { classifyShoulderRegion } from '@/lib/gameplan/engine/iron/taxonomy/shoulderRegions';
import type { LibraryExercise } from '@/types/catalog';

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

const BARbell_BACK_SQUAT = mockSeedExercise({
  id: 'ex-squat-1',
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

const INCLINE_DB_PRESS = mockSeedExercise({
  id: 'ex-incline-1',
  slug: 'incline_dumbbell_press_30',
  name: 'Incline Dumbbell Press (30°)',
  movement_pattern: 'push',
  primary_muscle: 'upper_chest',
  synergist_muscles: ['front_delts', 'triceps'],
  cns_fatigue_cost: 3,
  joint_stress_profile: 'shoulder_impingement_risk',
  equipment_required: ['dumbbells', 'full_gym'],
  stretch_mediated_hypertrophy: true,
});

const CABLE_LATERAL = mockSeedExercise({
  id: 'ex-lateral-1',
  slug: 'cable_lateral_raise',
  name: 'Cable Lateral Raise',
  movement_pattern: 'isolation',
  primary_muscle: 'side_delts',
  synergist_muscles: ['traps'],
  cns_fatigue_cost: 1,
  default_sets: 3,
  default_reps: 15,
});

describe('buildExerciseCatalog', () => {
  it('indexes seed mocks and classifies shoulder regions for 3D balance', () => {
    const catalog = buildExerciseCatalog([
      BARbell_BACK_SQUAT,
      INCLINE_DB_PRESS,
      CABLE_LATERAL,
    ]);

    expect(catalog.exercises).toHaveLength(3);

    const squat = catalog.bySlug.get('barbell_back_squat');
    expect(squat?.primary_muscle).toBe('quads');
    expect(catalog.byPattern.get('squat')?.map((row) => row.slug)).toContain('barbell_back_squat');

    const incline = catalog.bySlug.get('incline_dumbbell_press_30');
    expect(incline).toBeDefined();
    expect(classifyShoulderRegion(incline!)).toBe('anterior');

    const lateral = catalog.bySlug.get('cable_lateral_raise');
    expect(lateral).toBeDefined();
    expect(classifyShoulderRegion(lateral!)).toBe('lateral');

    const pushPattern = catalog.byPattern.get('push') ?? [];
    expect(pushPattern.some((row) => row.slug === 'incline_dumbbell_press_30')).toBe(true);
  });
});
