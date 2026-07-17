import { describe, expect, it } from 'vitest';

import {
  calculateVolumeBudget,
  isCompoundExercise,
  resolveEffectiveMesocyclePhase,
} from '@/lib/gameplan/engine/iron/volumePeriodization';
import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import { initialBiologicalProfile, type MesocyclePhase, type UserBiological } from '@/types/biological';

function catalogExercise(partial: Partial<CatalogExercise>): CatalogExercise {
  return {
    id: partial.id ?? 'exercise',
    slug: partial.slug ?? 'exercise',
    name: partial.name ?? 'Exercise',
    biomechanical_instructions: {},
    movement_pattern: partial.movement_pattern ?? 'isolation',
    primary_muscle: partial.primary_muscle ?? 'chest',
    synergist_muscles: partial.synergist_muscles ?? [],
    cns_fatigue_cost: partial.cns_fatigue_cost ?? 2,
    complexity_level: partial.complexity_level ?? 3,
    joint_stress_profile: partial.joint_stress_profile ?? null,
    equipment_required: partial.equipment_required ?? ['full_gym'],
    default_sets: partial.default_sets ?? 3,
    default_reps: partial.default_reps ?? 12,
    stretch_mediated_hypertrophy: partial.stretch_mediated_hypertrophy ?? false,
    selection_score: partial.selection_score ?? 1,
    tempo: partial.tempo ?? [3, 1, 1, 1],
    cue_card: partial.cue_card ?? {
      setup: 'Set up stable.',
      vector: 'Move with control.',
      catch: 'Keep tension.',
      anti_pattern: 'Avoid momentum.',
      failure_type: 'technical',
    },
    tactical_role: partial.tactical_role,
    stability_demand: partial.stability_demand,
    axial_loading: partial.axial_loading,
    resistance_profile: partial.resistance_profile,
    intensity_compatibility: partial.intensity_compatibility,
    requires_loading: partial.requires_loading,
    specific_cues: partial.specific_cues,
  };
}

function biological(
  mesocyclePhase: MesocyclePhase,
  overrides: Partial<UserBiological> = {},
): UserBiological {
  return {
    ...initialBiologicalProfile,
    mesocycle_phase: mesocyclePhase,
    preferred_split: 'ppl_x2',
    frequency_iron: 6,
    ...overrides,
  };
}

describe('calculateVolumeBudget', () => {
  it('allows 5-7 sets for a cutting isolation movement', () => {
    const cableFly = catalogExercise({
      slug: 'cable_fly',
      name: 'Cable Fly',
      movement_pattern: 'isolation',
      tactical_role: 'isolation_metabolic',
    });

    const budget = calculateVolumeBudget(cableFly, biological('cutting'), isCompoundExercise(cableFly));

    expect(budget).toMatchObject({
      minSets: 5,
      maxSets: 7,
      targetRepRange: '12-15',
      targetRIR: 2,
      executionTechnique: 'Myo-Reps',
    });
  });

  it('keeps a bulking compound at 4-5 sets with RIR 1', () => {
    const benchPress = catalogExercise({
      slug: 'barbell_bench_press',
      name: 'Barbell Bench Press',
      movement_pattern: 'push',
      tactical_role: 'primary_compound',
      cns_fatigue_cost: 4,
    });

    const budget = calculateVolumeBudget(benchPress, biological('bulking'), isCompoundExercise(benchPress));

    expect(budget).toMatchObject({
      minSets: 4,
      maxSets: 5,
      targetRepRange: '5-8',
      targetRIR: 1,
      executionTechnique: 'Standard',
    });
  });

  it('reduces deload prescriptions to 2-3 sets with RIR 3', () => {
    const legExtension = catalogExercise({
      slug: 'leg_extension',
      name: 'Leg Extension',
      movement_pattern: 'isolation',
    });

    const budget = calculateVolumeBudget(legExtension, biological('deload'), isCompoundExercise(legExtension));

    expect(budget).toMatchObject({
      minSets: 2,
      maxSets: 3,
      targetRepRange: '10-15',
      targetRIR: 3,
      executionTechnique: 'Standard',
    });
  });

  it('keeps maintenance isolations at 3-4 sets', () => {
    const lateralRaise = catalogExercise({
      slug: 'cable_lateral_raise',
      name: 'Cable Lateral Raise',
      movement_pattern: 'isolation',
      tactical_role: 'isolation_metabolic',
    });

    const budget = calculateVolumeBudget(lateralRaise, biological('maintenance'), isCompoundExercise(lateralRaise));

    expect(budget.minSets).toBe(3);
    expect(budget.maxSets).toBe(4);
    expect(budget.targetRepRange).toBe('10-15');
  });

  it('forces deload budgets on mesocycle weeks 4 and 6', () => {
    expect(resolveEffectiveMesocyclePhase('cutting', 4)).toBe('deload');
    expect(resolveEffectiveMesocyclePhase('bulking', 6)).toBe('deload');
  });

  it('allows higher bulking compound volume for TRT/enhanced profiles', () => {
    const benchPress = catalogExercise({
      slug: 'barbell_bench_press',
      name: 'Barbell Bench Press',
      movement_pattern: 'push',
      tactical_role: 'primary_compound',
    });

    const budget = calculateVolumeBudget(
      benchPress,
      biological('bulking', {
        hormonal_protocol: {
          type: 'trt',
          weekly_dose_mg: 200,
          recovery_multiplier: 1.5,
        },
      }),
      isCompoundExercise(benchPress),
    );

    expect(budget).toMatchObject({
      minSets: 4,
      maxSets: 6,
      targetRepRange: '6-10',
      targetRIR: 1,
      executionTechnique: 'Standard',
    });
  });

  it('keeps cutting isolation volume high for non-natural profiles', () => {
    const cableFly = catalogExercise({
      slug: 'cable_fly',
      name: 'Cable Fly',
      movement_pattern: 'isolation',
    });

    const budget = calculateVolumeBudget(
      cableFly,
      biological('cutting', {
        hormonal_protocol: {
          type: 'enhanced_cycle',
          weekly_dose_mg: 500,
          recovery_multiplier: 2.5,
        },
      }),
      isCompoundExercise(cableFly),
    );

    expect(budget).toMatchObject({
      minSets: 5,
      maxSets: 8,
      targetRepRange: '12-20',
      targetRIR: 2,
      executionTechnique: 'Myo-Reps',
    });
  });
});
