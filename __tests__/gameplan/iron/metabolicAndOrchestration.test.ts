import { describe, expect, it } from 'vitest';
import { injectRecoveryProtocols } from '@/lib/gameplan/engine/iron/recoveryInjector';
import { computeNutritionSnapshot } from '@/lib/physics/metabolicTelemetry';
import { initialBiologicalProfile } from '@/types/biological';
import type { UserBiological } from '@/types/biological';
import type { TrainingLoadSnapshot } from '@/lib/physics/loadTelemetry';
import type { MicrocycleDay } from '@/types/gameplan';

function athlete80(overrides: Partial<UserBiological> = {}): UserBiological {
  return {
    ...initialBiologicalProfile,
    weight_kg: 80,
    baseline_stress_level: 4,
    ...overrides,
  };
}

function telemetry(overrides: Partial<TrainingLoadSnapshot> = {}): TrainingLoadSnapshot {
  return {
    computedAt: '2026-06-02T00:00:00.000Z',
    pillars: {
      iron: {
        pillar: 'iron',
        sessionCount: 0,
        rpeMean: null,
        rpeStdDev: null,
        sRpe7d: 0,
        volume7d: 0,
        acwr: null,
        acwrStatus: 'insufficient',
      },
    },
    acwr: null,
    is_deload_week: false,
    globalRpeMean: null,
    ironGoal: 'hypertrophy',
    ironAcwrThresholds: {
      spike: 1.5,
      elevated: 1.3,
      under: 0.8,
      label: 'Hypertrophy',
    },
    ...overrides,
  };
}

function microcycleFixture(): MicrocycleDay[] {
  return [
    {
      day_index: 1,
      is_rest_day: false,
      focus_label: 'Iron: Legs A',
      blocks: [
        {
          id: 'block-d1-iron',
          pillar: 'iron',
          title: 'Iron: Legs A',
          subtitle: 'Barbell Back Squat',
          duration_minutes: 90,
          order: 0,
          status: 'pending',
          iron: {
            routine_id: 'iron_test',
            exercises: [
              {
                exercise_id: 'barbell_back_squat',
                slug: 'barbell_back_squat',
                target_sets: 4,
                target_reps: 8,
                target_weight_kg: 100,
                progression_note: 'E1RM 120 kg',
              },
            ],
          },
        },
      ],
    },
    {
      day_index: 2,
      is_rest_day: true,
      focus_label: 'Rest & Recovery',
      blocks: [],
    },
  ];
}

describe('metabolic telemetry and final orchestration', () => {
  it('A: computes carb cycling for Legs surplus and Rest deficit', () => {
    const biological = athlete80();
    const legs = computeNutritionSnapshot(biological, 'Iron: Legs A', 90);
    const rest = computeNutritionSnapshot(biological, 'rest', 0);

    expect(legs.carbs_g).toBe(360);
    expect(rest.carbs_g).toBe(120);
    expect(legs.total_calories).toBeGreaterThan(rest.total_calories);
    expect(legs.total_calories).toBe(80 * 33 + 250);
    expect(rest.total_calories).toBe(80 * 33 - 200);
  });

  it('B: computes TRT hydration flush and water target', () => {
    const target = computeNutritionSnapshot(
      athlete80({ hormonal_transition: true }),
      'Iron: Push A',
      60,
    );

    expect(target.hydration_focus).toBe('flush_sodium');
    expect(target.water_ml).toBe(80 * 50 + 60 * 15);
  });

  it('C: injects a Healer Zone block when ACWR spikes', () => {
    const injected = injectRecoveryProtocols(
      microcycleFixture(),
      telemetry({ acwr: 1.6 }),
      athlete80(),
    );
    const spiritBlocks = injected.flatMap((day) =>
      day.blocks.filter((block) => block.spirit?.tempo_id === 'tempo_478'),
    );

    expect(spiritBlocks).toHaveLength(1);
    expect(spiritBlocks[0]?.spirit?.tempo_id).toBe('tempo_478');
    expect(spiritBlocks[0]?.spirit?.prescribed_reason).toBe(
      'High systemic fatigue detected. Downregulate CNS.',
    );
  });

  it('D: applies automatic deload volume and load reductions', () => {
    const injected = injectRecoveryProtocols(
      microcycleFixture(),
      telemetry({ is_deload_week: true }),
      athlete80(),
    );
    const exercise = injected[0]?.blocks[0]?.iron?.exercises[0];

    expect(exercise?.target_sets).toBe(2);
    expect(exercise?.target_weight_kg).toBe(85);
  });
});
