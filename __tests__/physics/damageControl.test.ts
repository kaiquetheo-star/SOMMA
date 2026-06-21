import { describe, it, expect } from 'vitest';
import {
  DAMAGE_CONTROL_NOTE,
  applyDamageControl,
  restoreDamageControlTarget,
  injectMetabolicFlushBlock,
} from '@/lib/physics/damageControl';
import type { NutritionTarget } from '@/types/gameplan';

function makeNutritionTarget(overrides: Partial<NutritionTarget> = {}): NutritionTarget {
  return {
    total_calories: 2500,
    protein_g: 180,
    carbs_g: 300,
    fat_g: 80,
    water_ml: 3000,
    peri_workout_carb_ratio: 0.65,
    hydration_focus: 'standard',
    ...overrides,
  };
}

describe('applyDamageControl', () => {
  it('reduces carbs and fat by 40%, adds 1L water', () => {
    const target = makeNutritionTarget();
    const result = applyDamageControl(target);

    expect(result.protein_g).toBe(180); // protein unchanged
    expect(result.carbs_g).toBe(Math.round(300 * 0.6)); // 180
    expect(result.fat_g).toBe(Math.round(80 * 0.6)); // 48
    expect(result.water_ml).toBe(4000); // +1000
  });

  it('recalculates total calories from macros', () => {
    const target = makeNutritionTarget();
    const result = applyDamageControl(target);
    const expectedCal = result.protein_g * 4 + result.carbs_g * 4 + result.fat_g * 9;
    expect(result.total_calories).toBe(expectedCal);
  });

  it('sets hydration_focus to flush_sodium', () => {
    const result = applyDamageControl(makeNutritionTarget());
    expect(result.hydration_focus).toBe('flush_sodium');
  });

  it('appends damage control note', () => {
    const result = applyDamageControl(makeNutritionTarget({ note: 'Custom note' }));
    expect(result.note).toContain(DAMAGE_CONTROL_NOTE);
    expect(result.note).toContain('Custom note');
  });

  it('is idempotent — does not apply twice', () => {
    const target = makeNutritionTarget();
    const first = applyDamageControl(target);
    const second = applyDamageControl(first);
    expect(second).toEqual(first);
  });

  it('handles non-finite values by clamping to 0', () => {
    const target = makeNutritionTarget({ carbs_g: NaN, fat_g: -10 });
    const result = applyDamageControl(target);
    expect(result.carbs_g).toBe(0);
    expect(result.fat_g).toBe(0);
  });
});

describe('restoreDamageControlTarget', () => {
  it('reverses damage control adjustments', () => {
    const original = makeNutritionTarget();
    const damaged = applyDamageControl(original);
    const restored = restoreDamageControlTarget(damaged);

    expect(restored.carbs_g).toBe(original.carbs_g);
    expect(restored.fat_g).toBe(original.fat_g);
    expect(restored.water_ml).toBe(original.water_ml);
  });

  it('removes the damage control note', () => {
    const damaged = applyDamageControl(makeNutritionTarget({ note: 'Base note' }));
    const restored = restoreDamageControlTarget(damaged);
    expect(restored.note).not.toContain(DAMAGE_CONTROL_NOTE);
    expect(restored.note).toBe('Base note');
  });

  it('is a no-op when note does not contain damage control marker', () => {
    const target = makeNutritionTarget({ note: 'Normal note' });
    const result = restoreDamageControlTarget(target);
    expect(result).toEqual(target);
  });

  it('restores hydration_focus from flush_sodium to standard', () => {
    const damaged = applyDamageControl(makeNutritionTarget());
    const restored = restoreDamageControlTarget(damaged);
    expect(restored.hydration_focus).toBe('standard');
  });
});

describe('injectMetabolicFlushBlock', () => {
  it('creates a spirit block with correct structure', () => {
    const block = injectMetabolicFlushBlock(3);
    expect(block.id).toBe('block-d3-metabolic-flush');
    expect(block.pillar).toBe('spirit');
    expect(block.duration_minutes).toBe(15);
    expect(block.order).toBe(0);
    expect(block.status).toBe('pending');
  });

  it('includes spirit prescription with active_recovery mode', () => {
    const block = injectMetabolicFlushBlock(1);
    expect(block.spirit).toBeDefined();
    expect(block.spirit!.mode).toBe('active_recovery');
    expect(block.spirit!.tempo_id).toBe('zone2_steady');
    expect(block.spirit!.duration_minutes).toBe(15);
  });

  it('uses the day index in the block ID', () => {
    expect(injectMetabolicFlushBlock(5).id).toBe('block-d5-metabolic-flush');
    expect(injectMetabolicFlushBlock(7).id).toBe('block-d7-metabolic-flush');
  });
});
