import { describe, expect, it } from 'vitest';

import {
  resolveDeloadWeek,
  resolveEffectiveMesocyclePhase,
} from '@/lib/gameplan/engine/iron/volumePeriodization';
import { computeTrainingLoadSnapshot } from '@/lib/physics/loadTelemetry';

describe('calendar deload — phase budget only', () => {
  it('uses weeks 4 and 6 as the only automatic deloads', () => {
    const week4 = resolveDeloadWeek(4, null, null);
    const week5 = resolveDeloadWeek(5, null, null);
    const week6 = resolveDeloadWeek(6, null, null);

    expect(week4.isDeloadWeek).toBe(true);
    expect(week6.isDeloadWeek).toBe(true);
    expect(week5.isDeloadWeek).toBe(false);

    expect(resolveEffectiveMesocyclePhase('bulking', 4)).toBe('deload');
    expect(resolveEffectiveMesocyclePhase('bulking', 6)).toBe('deload');
    expect(resolveEffectiveMesocyclePhase('bulking', 5)).toBe('bulking');

    const custom = resolveDeloadWeek(
      4,
      { deloadWeeks: [6] },
      { deloadWeek: 4 },
    );
    expect(custom.isDeloadWeek).toBe(false);
    expect(custom.phaseBudgetActive).toBe(false);

    const week6OnlyBudget = resolveDeloadWeek(
      6,
      { deloadWeeks: [6] },
      { deloadWeek: 4 },
    );
    expect(week6OnlyBudget.isDeloadWeek).toBe(true);
    expect(week6OnlyBudget.phaseBudgetActive).toBe(true);
  });

  it('reports phase_budget as the sole source', () => {
    expect(resolveDeloadWeek(4, null, null).deload_source).toBe('phase_budget');
    expect(resolveDeloadWeek(6, null, null).deload_source).toBe('phase_budget');
    expect(
      resolveDeloadWeek(4, { deloadWeeks: [6] }, { deloadWeek: 4 }).deload_source,
    ).toBeNull();
    expect(resolveDeloadWeek(2, null, null).deload_source).toBeNull();

    const snapshotWeek4 = computeTrainingLoadSnapshot([], { mesocycleWeek: 4 });
    expect(snapshotWeek4.is_deload_week).toBe(true);
    expect(snapshotWeek4.deload_source).toBe('phase_budget');

    const snapshotWeek6 = computeTrainingLoadSnapshot([], { mesocycleWeek: 6 });
    expect(snapshotWeek6.is_deload_week).toBe(true);
    expect(snapshotWeek6.deload_source).toBe('phase_budget');

    const snapshotWeek5 = computeTrainingLoadSnapshot([], { mesocycleWeek: 5 });
    expect(snapshotWeek5.is_deload_week).toBe(false);
    expect(snapshotWeek5.deload_source).toBeNull();
  });
});
