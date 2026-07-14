import { describe, expect, it } from 'vitest';

import {
  resolveDeloadWeek,
  resolveEffectiveMesocyclePhase,
} from '@/lib/gameplan/engine/iron/volumePeriodization';
import { computeTrainingLoadSnapshot } from '@/lib/physics/loadTelemetry';

describe('deloadUnification — phase budget + clinical calendar', () => {
  it('Cenário A: semana 4 clinical + semana 6 budget ambos honrados', () => {
    const week4 = resolveDeloadWeek(4, null, null);
    const week5 = resolveDeloadWeek(5, null, null);
    const week6 = resolveDeloadWeek(6, null, null);

    expect(week4.isDeloadWeek).toBe(true);
    expect(week6.isDeloadWeek).toBe(true);
    // Week 5 is neither clinical (4) nor phase-budget (4/6) — no clamp-override
    expect(week5.isDeloadWeek).toBe(false);

    expect(resolveEffectiveMesocyclePhase('bulking', 4)).toBe('deload');
    expect(resolveEffectiveMesocyclePhase('bulking', 6)).toBe('deload');
    expect(resolveEffectiveMesocyclePhase('bulking', 5)).toBe('bulking');

    // Explicit dual calendars still honor both independently
    const custom = resolveDeloadWeek(
      4,
      { deloadWeeks: [6] },
      { deloadWeek: 4 },
    );
    expect(custom.isDeloadWeek).toBe(true);
    expect(custom.clinicalActive).toBe(true);
    expect(custom.phaseBudgetActive).toBe(false);

    const week6OnlyBudget = resolveDeloadWeek(
      6,
      { deloadWeeks: [6] },
      { deloadWeek: 4 },
    );
    expect(week6OnlyBudget.isDeloadWeek).toBe(true);
    expect(week6OnlyBudget.phaseBudgetActive).toBe(true);
    expect(week6OnlyBudget.clinicalActive).toBe(false);
  });

  it('Cenário B: deload_source sinalizado corretamente', () => {
    expect(resolveDeloadWeek(4, null, null).deload_source).toBe('both');
    expect(resolveDeloadWeek(6, null, null).deload_source).toBe('phase_budget');
    expect(
      resolveDeloadWeek(4, { deloadWeeks: [6] }, { deloadWeek: 4 }).deload_source,
    ).toBe('clinical');
    expect(resolveDeloadWeek(2, null, null).deload_source).toBeNull();

    const snapshotWeek4 = computeTrainingLoadSnapshot([], { mesocycleWeek: 4 });
    expect(snapshotWeek4.is_deload_week).toBe(true);
    expect(snapshotWeek4.deload_source).toBe('both');

    const snapshotWeek6 = computeTrainingLoadSnapshot([], { mesocycleWeek: 6 });
    expect(snapshotWeek6.is_deload_week).toBe(true);
    expect(snapshotWeek6.deload_source).toBe('phase_budget');

    const snapshotWeek5 = computeTrainingLoadSnapshot([], { mesocycleWeek: 5 });
    expect(snapshotWeek5.is_deload_week).toBe(false);
    expect(snapshotWeek5.deload_source).toBeNull();
  });
});
