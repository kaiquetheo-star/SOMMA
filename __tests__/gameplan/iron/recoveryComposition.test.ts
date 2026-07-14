import { describe, expect, it } from 'vitest';

import {
  RECOVERY_LEVER_ORDER,
  RECOVERY_VOLUME_FLOOR,
  VOLUME_PENALTY_BY_LEVER,
  applyRecoveryCompositionToSets,
  buildRecoveryActivations,
  composeRecoveryFromSignals,
  composeRecoveryVolumeScale,
} from '@/lib/gameplan/engine/iron/recoveryComposition';

describe('recoveryComposition — additive policy', () => {
  it('Cenário A: ACWR + RPE aplicados aditivamente com cap de 40%', () => {
    const composition = composeRecoveryFromSignals({ acwr: true, rpe: true });

    // Additive: −30% + −20% = −50% → scale 0.50 (not 0.7×0.8 = 0.56)
    expect(composition.totalPenalty).toBeCloseTo(0.5);
    expect(composition.scale).toBeCloseTo(0.5);
    expect(composition.capped).toBe(false);
    expect(applyRecoveryCompositionToSets(10, composition)).toBe(5);

    const capped = composeRecoveryFromSignals({
      acwr: true,
      readiness: true,
      rpe: true,
      injector: true,
    });
    // −30 −30 −20 −50 = −130 → clamp to −60 → floor scale 0.40
    expect(capped.totalPenalty).toBeCloseTo(1 - RECOVERY_VOLUME_FLOOR);
    expect(capped.scale).toBeCloseTo(RECOVERY_VOLUME_FLOOR);
    expect(capped.capped).toBe(true);
    expect(applyRecoveryCompositionToSets(10, capped)).toBe(4);
  });

  it('Cenário B: ordem de aplicação respeitada', () => {
    expect(RECOVERY_LEVER_ORDER).toEqual([
      'acwr',
      'readiness',
      'rpe',
      'mapper',
      'injector',
    ]);

    const activations = buildRecoveryActivations({
      injector: true,
      acwr: true,
      mapper: true,
      readiness: true,
      rpe: true,
    });
    expect(activations.map((a) => a.lever)).toEqual([...RECOVERY_LEVER_ORDER]);

    const composition = composeRecoveryVolumeScale(activations);
    // Injector (−50%) dominates over ACWR/Readiness (−30%) and RPE (−20%)
    expect(composition.dominant).toBe('injector');
    expect(composition.applied).toEqual(['acwr', 'readiness', 'rpe', 'injector']);
    // Mapper is active for order/logging but contributes 0 volume penalty
    expect(VOLUME_PENALTY_BY_LEVER.mapper).toBe(0);
    expect(activations.find((a) => a.lever === 'mapper')?.volumePenalty).toBe(0);

    // Tie-break: equal penalties → earlier in canonical order wins (ACWR > Readiness)
    const tie = composeRecoveryFromSignals({ acwr: true, readiness: true });
    expect(tie.dominant).toBe('acwr');
    expect(tie.scale).toBeCloseTo(0.4); // −30 −30 = −60 → floor
  });
});
