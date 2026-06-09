/**
 * Movement taxonomy aligned with `seed_hypertrophy.sql` / `library_exercises.movement_pattern`.
 */
export const IRON_MOVEMENT_PATTERNS = [
  'squat',
  'hinge',
  'lunge',
  'push',
  'pull',
  'isolation',
  'carry',
] as const;

export type IronMovementPattern = (typeof IRON_MOVEMENT_PATTERNS)[number];

const PATTERN_SET = new Set<string>(IRON_MOVEMENT_PATTERNS);

export function isIronMovementPattern(value: string): value is IronMovementPattern {
  return PATTERN_SET.has(value);
}

export function normalizeMovementPattern(
  raw: string | null | undefined,
): IronMovementPattern | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().trim().replace(/-/g, '_') as string;
  return isIronMovementPattern(normalized) ? normalized : null;
}
