import { classifyClinicalPhase } from '@/lib/gameplan/engine/clinicalMatrix';
import { sortIronExercises } from '@/lib/gameplan/engine/clinicalLaws';
import type { LibraryExercise } from '@/types/catalog';
import type { GameplanBlock, IronExercisePrescription } from '@/types/gameplan';

/** Minutes at or above this value = “Unlimited / Max Results” time budget */
export const UNLIMITED_IRON_MINUTES = 90;

export interface IronTimeBudgetLimits {
  cap: number;
  compoundsOnly: boolean;
}

/** Strict scissors — applied after generation and clinical sort */
export function maxIronExercisesForMinutes(minutes: number): IronTimeBudgetLimits {
  if (minutes <= 30) {
    return { cap: 3, compoundsOnly: true };
  }
  if (minutes <= 45) {
    return { cap: 4, compoundsOnly: false };
  }
  return { cap: 6, compoundsOnly: false };
}

function isCompoundPhase(phase: number): boolean {
  return phase <= 3;
}

/**
 * Drop isolation / finisher slots first — compounds retained when `compoundsOnly`.
 */
export function pruneIronExercisesForTimeBudget(
  exercises: IronExercisePrescription[],
  catalog: LibraryExercise[],
  prerequisiteSlugs: string[],
  availableMinutes: number,
): IronExercisePrescription[] {
  const { cap, compoundsOnly } = maxIronExercisesForMinutes(availableMinutes);
  if (exercises.length === 0) return exercises;

  let ordered = sortIronExercises(exercises, catalog, prerequisiteSlugs);

  if (compoundsOnly) {
    ordered = ordered.filter((exercise) => {
      const meta = catalog.find((row) => row.id === exercise.exercise_id);
      const phase = classifyClinicalPhase(meta, prerequisiteSlugs);
      return isCompoundPhase(phase);
    });
  }

  if (ordered.length === 0) {
    return sortIronExercises(exercises, catalog, prerequisiteSlugs).slice(0, cap);
  }

  return ordered.slice(0, cap);
}

export function pruneIronBlocksInMicrocycle(
  microcycle: Array<{ blocks: GameplanBlock[] }>,
  catalog: LibraryExercise[],
  availableMinutes: number,
  prerequisiteSlugs: string[] = [],
): void {
  for (const day of microcycle) {
    day.blocks = day.blocks.map((block) => {
      if (block.pillar !== 'iron' || !block.iron?.exercises?.length) return block;

      const exercises = pruneIronExercisesForTimeBudget(
        block.iron.exercises,
        catalog,
        prerequisiteSlugs,
        availableMinutes,
      );

      const names = exercises
        .map((row) => row.display_name)
        .filter(Boolean)
        .join(' · ');

      return {
        ...block,
        subtitle: names || block.subtitle,
        iron: { ...block.iron, exercises },
      };
    });
  }
}
