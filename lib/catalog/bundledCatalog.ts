/**
 * Offline-first Iron catalog — Elite Hypertrophy only.
 * Source of truth: supabase/seed_hypertrophy.sql → lib/catalog/eliteCatalog.ts
 * Regenerate: npx tsx scripts/extractEliteCatalog.ts
 */
import { enrichExerciseWithCues } from '@/lib/catalog/biomechanicalMapper';
import { ELITE_EXERCISES } from '@/lib/catalog/eliteCatalog';
import { inferSlotCategory } from '@/lib/catalog/inferSlotCategory';
import type { CatalogExercise, LibraryExercise } from '@/types/catalog';

function withEliteSlotCategory(exercise: LibraryExercise): LibraryExercise {
  return {
    ...exercise,
    slot_category: exercise.slot_category ?? inferSlotCategory(exercise),
  };
}

/**
 * Runtime catalog for local-first mode.
 * Intentionally ignores the Wger dump (`bundledCatalog.full.ts`).
 */
export function getBundledExercises(): CatalogExercise[] {
  if (ELITE_EXERCISES.length === 0) {
    throw new Error(
      'ELITE_CATALOG_EMPTY: run `npx tsx scripts/extractEliteCatalog.ts` from seed_hypertrophy.sql',
    );
  }
  return ELITE_EXERCISES.map((exercise) => enrichExerciseWithCues(withEliteSlotCategory(exercise)));
}

/** Re-export for callers that need the raw seed-shaped rows (pre X-Frame cues). */
export { ELITE_EXERCISES } from '@/lib/catalog/eliteCatalog';
