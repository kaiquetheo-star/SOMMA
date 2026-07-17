import { describe, expect, it } from 'vitest';
import { computeNutritionSnapshot } from '@/lib/physics/metabolicTelemetry';
import { initialBiologicalProfile } from '@/types/biological';
import type { UserBiological } from '@/types/biological';

function athlete80(overrides: Partial<UserBiological> = {}): UserBiological {
  return {
    ...initialBiologicalProfile,
    weight_kg: 80,
    baseline_stress_level: 4,
    ...overrides,
  };
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
});