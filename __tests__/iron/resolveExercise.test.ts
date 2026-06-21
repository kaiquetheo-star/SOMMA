import { describe, it, expect } from 'vitest';
import { resolveIronExerciseView } from '@/lib/iron/resolveExercise';
import type { IronExercisePrescription } from '@/types/gameplan';

function makePrescription(overrides: Partial<IronExercisePrescription> = {}): IronExercisePrescription {
  return {
    exercise_id: 'bench-press',
    target_sets: 4,
    target_reps: 8,
    target_weight_kg: 80,
    ...overrides,
  };
}

const mockLibrary = {
  id: 'bench-press',
  slug: 'bench-press',
  name: 'Bench Press',
  biomechanical_instructions: { setup: 'Grip at shoulder width', eccentric: 'Lower to chest' },
  equipment_required: ['barbell'],
  default_sets: 4,
  default_reps: 8,
  movement_pattern: 'push' as const,
  primary_muscle: 'chest',
  synergist_muscles: ['triceps', 'anterior_deltoid'],
  cns_fatigue_cost: 7,
  joint_stress_profile: 'rotator_cuff_heavy' as const,
  stretch_mediated_hypertrophy: false,
};

describe('resolveIronExerciseView', () => {
  it('resolves a basic exercise view with library data', () => {
    const result = resolveIronExerciseView({
      prescription: makePrescription(),
      library: mockLibrary,
      fallbackName: 'Unknown',
      fallbackWeight: 0,
      fallbackReps: 10,
      fallbackSets: 3,
      libraryCatalog: [],
    });

    expect(result.exercise_id).toBe('bench-press');
    expect(result.exercise_slug).toBe('bench-press');
    expect(result.name).toBe('Bench Press');
    expect(result.target_sets).toBe(4);
    expect(result.target_reps).toBe(8);
    expect(result.target_weight_kg).toBe(80);
    expect(result.target_rir).toBe(2); // default RIR
    expect(result.instructions).toEqual(mockLibrary.biomechanical_instructions);
    expect(result.primary_muscle).toBe('chest');
  });

  it('uses fallback values when prescription fields are missing', () => {
    const result = resolveIronExerciseView({
      prescription: { exercise_id: 'unknown-exercise' } as IronExercisePrescription,
      library: null,
      fallbackName: 'Fallback Name',
      fallbackWeight: 50,
      fallbackReps: 12,
      fallbackSets: 3,
      libraryCatalog: [],
    });

    expect(result.name).toBe('Fallback Name');
    expect(result.target_weight_kg).toBe(50);
    expect(result.target_reps).toBe(12);
    expect(result.target_sets).toBe(3);
    expect(result.primary_muscle).toBeNull();
    expect(result.instructions).toEqual({});
  });

  it('uses exerciseIdOverride when provided', () => {
    const result = resolveIronExerciseView({
      prescription: makePrescription(),
      library: null,
      fallbackName: 'Original',
      fallbackWeight: 0,
      fallbackReps: 8,
      fallbackSets: 4,
      exerciseIdOverride: 'incline-bench',
      libraryCatalog: [{ ...mockLibrary, id: 'incline-bench', name: 'Incline Bench' }],
    });

    expect(result.exercise_id).toBe('incline-bench');
    expect(result.name).toBe('Incline Bench');
  });

  it('prefers libraryCatalog match over initialLibrary', () => {
    const catalogEntry = { ...mockLibrary, id: 'bench-press', name: 'Catalog Bench Press' };
    const result = resolveIronExerciseView({
      prescription: makePrescription(),
      library: { ...mockLibrary, name: 'Initial Library Name' },
      fallbackName: 'Fallback',
      fallbackWeight: 0,
      fallbackReps: 8,
      fallbackSets: 4,
      libraryCatalog: [catalogEntry],
    });

    expect(result.name).toBe('Catalog Bench Press');
  });

  it('generates target_rep_range from target_reps and RIR', () => {
    const result = resolveIronExerciseView({
      prescription: makePrescription({ target_reps: 10, target_rir: 3 }),
      library: null,
      fallbackName: 'Ex',
      fallbackWeight: 0,
      fallbackReps: 10,
      fallbackSets: 3,
      libraryCatalog: [],
    });

    expect(result.target_rep_range).toBe('8-10 @ 3 RIR');
  });

  it('uses prescription.target_rep_range when provided', () => {
    const result = resolveIronExerciseView({
      prescription: makePrescription({ target_rep_range: '6-8 @ 2 RIR' }),
      library: null,
      fallbackName: 'Ex',
      fallbackWeight: 0,
      fallbackReps: 8,
      fallbackSets: 3,
      libraryCatalog: [],
    });

    expect(result.target_rep_range).toBe('6-8 @ 2 RIR');
  });

  it('includes alternative_exercise_id from prescription', () => {
    const result = resolveIronExerciseView({
      prescription: makePrescription({ alternative_exercise_id: 'dumbbell-press' }),
      library: mockLibrary,
      fallbackName: 'Ex',
      fallbackWeight: 0,
      fallbackReps: 8,
      fallbackSets: 4,
      libraryCatalog: [],
    });

    expect(result.alternative_exercise_id).toBe('dumbbell-press');
  });

  it('defaults alternative_exercise_id to null', () => {
    const result = resolveIronExerciseView({
      prescription: makePrescription(),
      library: mockLibrary,
      fallbackName: 'Ex',
      fallbackWeight: 0,
      fallbackReps: 8,
      fallbackSets: 4,
      libraryCatalog: [],
    });

    expect(result.alternative_exercise_id).toBeNull();
  });
});
