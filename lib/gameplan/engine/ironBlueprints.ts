// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import {
  selectExercisesFromPatternPools,
} from '@/lib/gameplan/engine/exercisePoolSelection';
import type { DeterministicGenerationContext } from '@/lib/gameplan/engine/generation';
import {
  normalizeCatalogSlug,
  type IronDayBlueprintKey,
} from '@/lib/gameplan/engine/goldStandardBlueprint';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';

export type { IronDayBlueprintKey } from '@/lib/gameplan/engine/goldStandardBlueprint';

export function inferIronDayBlueprintKey(focusLabel: string): IronDayBlueprintKey {
  const lower = focusLabel.toLowerCase();
  if (lower.includes('push')) return 'push';
  if (lower.includes('pull')) return 'pull';
  if (lower.includes('leg')) return 'legs';
  if (lower.includes('upper')) return 'upper';
  if (lower.includes('lower')) return 'lower';
  return 'full';
}

/**
 * Pattern-pool selection — seeded draw from filtered catalog (not gold-slug lock).
 */
export function selectExercisesByIronBlueprint(
  focusLabel: string,
  catalog: LibraryExercise[],
  equipment: EquipmentTag[],
  targetCount: number,
  blockedJointProfiles: string[],
  generation: DeterministicGenerationContext,
): string[] {
  const dayKey = inferIronDayBlueprintKey(focusLabel);
  return selectExercisesFromPatternPools(
    dayKey,
    catalog,
    equipment,
    targetCount,
    blockedJointProfiles,
    generation,
  );
}

/** @deprecated Precision Blueprint uses slug lock — matchers retained for Edge sync only */
export function isTricepsMuscle(row: LibraryExercise): boolean {
  const blob = `${row.primary_muscle ?? ''} ${row.name} ${row.slug}`.toLowerCase();
  return /tricep|pushdown/.test(blob);
}

/** @deprecated Precision Blueprint uses slug lock */
export function isBicepsMuscle(row: LibraryExercise): boolean {
  const blob = `${row.primary_muscle ?? ''} ${row.name} ${row.slug}`.toLowerCase();
  return /bicep|curl|brachialis/.test(blob) && !/leg curl|tricep/.test(blob);
}

export function slotsForBlueprint(_key: IronDayBlueprintKey): { id: string; count: number }[] {
  return [];
}

export function normalizeSlugForCatalog(slug: string): string {
  return normalizeCatalogSlug(slug);
}
