/**
 * Recovery Composition Policy — additive volume penalties, never multiplicative.
 * Canonical order: ACWR → Readiness → RPE → Mapper → Injector.
 * Global floor: final volume never below 40% of original (maintenance band).
 */

export type RecoveryLeverId = 'acwr' | 'readiness' | 'rpe' | 'mapper' | 'injector';

/** Canonical application order (also used as dominant-lever tie-break). */
export const RECOVERY_LEVER_ORDER: readonly RecoveryLeverId[] = [
  'acwr',
  'readiness',
  'rpe',
  'mapper',
  'injector',
] as const;

/** Volume penalty fractions (Δ) per lever. Mapper is load-only → 0 for sets. */
export const VOLUME_PENALTY_BY_LEVER: Readonly<Record<RecoveryLeverId, number>> = {
  acwr: 0.3,
  readiness: 0.3,
  rpe: 0.2,
  mapper: 0,
  injector: 0.5,
};

/** Final volume scale never goes below this (maintenance floor). */
export const RECOVERY_VOLUME_FLOOR = 0.4;

/** Max additive penalty before floor clamp (1 − floor). */
export const RECOVERY_MAX_PENALTY = 1 - RECOVERY_VOLUME_FLOOR;

const isRecoveryCompositionDebug =
  (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.NODE_ENV !== 'production';

export interface RecoveryLeverActivation {
  lever: RecoveryLeverId;
  active: boolean;
  /** Volume penalty contribution when active (0 for mapper). */
  volumePenalty: number;
}

export interface RecoveryVolumeSignals {
  acwr?: boolean;
  readiness?: boolean;
  rpe?: boolean;
  /** Mapper participates in order/logging; does not cut sets. */
  mapper?: boolean;
  injector?: boolean;
}

export interface RecoveryCompositionResult {
  /** Multiplier applied once to original sets (additive composition). */
  scale: number;
  totalPenalty: number;
  capped: boolean;
  dominant: RecoveryLeverId | null;
  applied: readonly RecoveryLeverId[];
  activations: readonly RecoveryLeverActivation[];
}

function leverOrderIndex(lever: RecoveryLeverId): number {
  return RECOVERY_LEVER_ORDER.indexOf(lever);
}

/**
 * Build ordered activations from boolean signals.
 * Inactive levers are omitted from penalty sum but order is preserved in `activations`.
 */
export function buildRecoveryActivations(
  signals: RecoveryVolumeSignals,
): RecoveryLeverActivation[] {
  return RECOVERY_LEVER_ORDER.map((lever) => {
    const active = signals[lever] === true;
    return {
      lever,
      active,
      volumePenalty: active ? VOLUME_PENALTY_BY_LEVER[lever] : 0,
    };
  });
}

/**
 * Compose volume scale from lever activations.
 * Penalties are additive: ACWR −30% + RPE −20% → scale 0.50 (not 0.7×0.8).
 */
export function composeRecoveryVolumeScale(
  activations: readonly RecoveryLeverActivation[],
): RecoveryCompositionResult {
  const ordered = [...activations].sort(
    (a, b) => leverOrderIndex(a.lever) - leverOrderIndex(b.lever),
  );

  const applied = ordered
    .filter((entry) => entry.active && entry.volumePenalty > 0)
    .map((entry) => entry.lever);

  const rawPenalty = ordered.reduce(
    (sum, entry) => sum + (entry.active ? entry.volumePenalty : 0),
    0,
  );
  const capped = rawPenalty > RECOVERY_MAX_PENALTY;
  const totalPenalty = Math.min(rawPenalty, RECOVERY_MAX_PENALTY);
  const scale = 1 - totalPenalty;

  let dominant: RecoveryLeverId | null = null;
  let dominantPenalty = -1;
  for (const entry of ordered) {
    if (!entry.active || entry.volumePenalty <= 0) continue;
    if (entry.volumePenalty > dominantPenalty) {
      dominantPenalty = entry.volumePenalty;
      dominant = entry.lever;
    }
  }

  if (isRecoveryCompositionDebug && dominant != null) {
    // eslint-disable-next-line no-console
    console.debug(
      `[recoveryComposition] dominant=${dominant} scale=${scale.toFixed(2)} ` +
        `penalty=${totalPenalty.toFixed(2)}${capped ? ' (capped)' : ''} ` +
        `applied=[${applied.join(',')}]`,
    );
  }

  return {
    scale,
    totalPenalty,
    capped,
    dominant,
    applied,
    activations: ordered,
  };
}

export function composeRecoveryFromSignals(
  signals: RecoveryVolumeSignals,
): RecoveryCompositionResult {
  return composeRecoveryVolumeScale(buildRecoveryActivations(signals));
}

/** Apply composed scale to set count (min 1 when original > 0). */
export function applyRecoveryCompositionToSets(
  originalSets: number,
  composition: RecoveryCompositionResult,
): number {
  if (!Number.isFinite(originalSets) || originalSets <= 0) return 0;
  return Math.max(1, Math.round(originalSets * composition.scale));
}
