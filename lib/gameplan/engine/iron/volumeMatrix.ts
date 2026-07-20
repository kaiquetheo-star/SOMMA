import type { PreferredSplit, UserBiological } from '@/types/biological';
import { normalizePreferredSplit } from '@/types/biological';

/**
 * RP hypertrophy volume landmarks — split-frequency adaptive matrix.
 * @see https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth
 */
export type SplitFrequencyClass = 'once_per_week' | 'twice_per_week';

export interface VolumeMatrixRow {
  /** MEV — minimum effective volume (effective sets / muscle / week). */
  mev: number;
  /** Soft MRV — scoring penalty zone begins above this. */
  mrvSoft: number;
  /** Hard MRV — weekly ledger rejects additions above this. */
  mrvHard: number;
  /** Max working sets for a single muscle in one Iron session. */
  maxSetsSession: number;
  synergistFractionDefault: number;
  synergistFractionDayFocus: number;
}

export const VOLUME_MATRIX: Record<SplitFrequencyClass, VolumeMatrixRow> = {
  once_per_week: {
    // MEV 14 — RP 1× frequency needs higher per-exposure floor for large muscles.
    mev: 14,
    mrvSoft: 22,
    mrvHard: 26,
    maxSetsSession: 16,
    // 0.33 — compounds must not starve direct isolation MEV on day-focus muscles.
    synergistFractionDefault: 0.33,
    synergistFractionDayFocus: 0.33,
  },
  twice_per_week: {
    mev: 10,
    mrvSoft: 18,
    mrvHard: 22,
    maxSetsSession: 12,
    synergistFractionDefault: 0.33,
    synergistFractionDayFocus: 0.33,
  },
};

/** Catalog-normalized day-focus muscles for ABCDE calendar days. */
const ABCDE_DAY_FOCUS: Readonly<Record<number, readonly string[]>> = {
  1: ['chest', 'upper_chest', 'triceps'],
  2: ['quads', 'calves', 'glutes'],
  4: ['back', 'rear_delts', 'biceps', 'traps'],
  5: ['hamstrings', 'glutes', 'calves', 'erectors', 'core'],
  6: ['side_delts', 'front_delts', 'rear_delts', 'biceps', 'triceps', 'traps', 'core'],
};

export interface VolumeLimits {
  mev: number;
  mrvSoft: number;
  mrvHard: number;
  maxSetsSession: number;
}

export interface VolumeCreditContext {
  frequencyClass: SplitFrequencyClass;
  dayFocusMuscles: ReadonlySet<string>;
}

export function resolveSplitFrequencyClass(
  preferredSplit: PreferredSplit | string | null | undefined,
): SplitFrequencyClass {
  const split = normalizePreferredSplit(preferredSplit);
  return split === 'ppl_x2' ? 'twice_per_week' : 'once_per_week';
}

export function resolveVolumeMatrix(
  preferredSplit: PreferredSplit | string | null | undefined,
): VolumeMatrixRow {
  return VOLUME_MATRIX[resolveSplitFrequencyClass(preferredSplit)];
}

function hormonalVolumeBoost(
  biological: Pick<UserBiological, 'hormonal_protocol' | 'hormonal_transition'> | null | undefined,
): { mevScale: number; softScale: number; hardScale: number } {
  const trt = biological?.hormonal_protocol?.type === 'trt';
  const transition = biological?.hormonal_transition === true;
  if (!trt && !transition) {
    return { mevScale: 1, softScale: 1, hardScale: 1 };
  }
  // TRT raises the weekly TARGET (MEV), not only the ceiling (MRV).
  return { mevScale: 1.15, softScale: 1.2, hardScale: 1.15 };
}

export function resolveVolumeLimitsForSplit(
  preferredSplit: PreferredSplit | string | null | undefined,
  biological?: Pick<UserBiological, 'hormonal_protocol' | 'hormonal_transition'> | null,
): VolumeLimits {
  const row = resolveVolumeMatrix(preferredSplit);
  const boost = hormonalVolumeBoost(biological);
  return {
    mev: Math.round(row.mev * boost.mevScale),
    mrvSoft: Math.round(row.mrvSoft * boost.softScale),
    mrvHard: Math.round(row.mrvHard * boost.hardScale),
    maxSetsSession: row.maxSetsSession,
  };
}

export function resolveDayFocusMuscles(
  preferredSplit: PreferredSplit | string | null | undefined,
  calendarDayIndex: number,
): ReadonlySet<string> {
  const split = normalizePreferredSplit(preferredSplit);
  if (split === 'abcde' || split === 'abcdef') {
    return new Set(ABCDE_DAY_FOCUS[calendarDayIndex] ?? []);
  }
  return new Set();
}

export function synergistFractionForMuscle(
  muscle: string,
  ctx: VolumeCreditContext,
): number {
  const row = VOLUME_MATRIX[ctx.frequencyClass];
  if (ctx.dayFocusMuscles.has(muscle)) {
    return row.synergistFractionDayFocus;
  }
  return row.synergistFractionDefault;
}

export function defaultVolumeCreditContext(
  preferredSplit: PreferredSplit | string | null | undefined,
): VolumeCreditContext {
  return {
    frequencyClass: resolveSplitFrequencyClass(preferredSplit),
    dayFocusMuscles: new Set(),
  };
}
