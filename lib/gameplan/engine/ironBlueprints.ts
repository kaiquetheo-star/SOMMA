// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import {
  selectExercisesFromPatternPools,
} from '@/lib/gameplan/engine/exercisePoolSelection';
import type { DeterministicGenerationContext } from '@/lib/gameplan/engine/generation';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';
import {
  inferIronDayBlueprintKey,
  isTricepsMuscle,
  isBicepsMuscle,
  normalizeSlugForCatalog,
} from '@/lib/shared/blueprintMatcher';

export { inferIronDayBlueprintKey, isTricepsMuscle, isBicepsMuscle, normalizeSlugForCatalog };
export type { IronDayBlueprintKey } from '@/lib/shared/blueprintMatcher';

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

export function slotsForBlueprint(_key: import('@/lib/shared/blueprintMatcher').IronDayBlueprintKey): { id: string; count: number }[] {
  return [];
}
