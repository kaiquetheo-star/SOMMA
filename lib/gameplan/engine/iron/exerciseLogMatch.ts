import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';

/** Normalize catalog / log slugs for stable cross-generation matching. */
export function normalizeExerciseSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function slugFromExerciseName(name: string): string {
  return normalizeExerciseSlug(name);
}

export function rowExerciseId(row: EnginePerformanceRow): string | null {
  return row.payload?.iron?.exercise_id ?? row.exercise_id ?? null;
}

export function rowExerciseSlug(row: EnginePerformanceRow): string | null {
  const slug = row.payload?.iron?.exercise_slug;
  if (slug) return normalizeExerciseSlug(slug);
  const name = row.payload?.iron?.exercise_name;
  if (name) return slugFromExerciseName(name);
  return null;
}

/** Match iron performance row by UUID and/or slug (protocol regeneration safe). */
export function exerciseRowMatches(
  row: EnginePerformanceRow,
  exerciseId: string,
  exerciseSlug?: string | null,
): boolean {
  if (row.pillar !== 'iron') return false;

  const rowId = rowExerciseId(row);
  if (rowId && rowId === exerciseId) return true;

  const normalizedSlug = exerciseSlug ? normalizeExerciseSlug(exerciseSlug) : null;
  if (!normalizedSlug) return false;

  const rowSlug = rowExerciseSlug(row);
  return rowSlug != null && rowSlug === normalizedSlug;
}

export function findLastLogForExercise(
  logs: readonly EnginePerformanceRow[],
  exerciseId: string,
  exerciseSlug?: string | null,
): EnginePerformanceRow | null {
  for (const row of logs) {
    if (!exerciseRowMatches(row, exerciseId, exerciseSlug)) continue;
    if (row.weight_used != null && row.weight_used > 0) return row;
  }
  return null;
}
