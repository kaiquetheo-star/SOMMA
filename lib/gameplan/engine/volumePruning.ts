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
  if (minutes >= UNLIMITED_IRON_MINUTES) {
    return { cap: 7, compoundsOnly: false };
  }
  return { cap: 6, compoundsOnly: false };
}

function isCompoundPhase(phase: number): boolean {
  return phase <= 3;
}

function isDisposableFinisher(exercise: IronExercisePrescription): boolean {
  const category = exercise.slot_category ?? '';
  return (
    category.length === 0 ||
    category.includes('finisher') ||
    category.includes('shoulder_3d') ||
    category.includes('_extra')
  );
}

/**
 * Drop isolation / finisher slots first — compounds retained when `compoundsOnly`.
 * Template slots (chest/triceps/biceps/…) are protected over coherence finishers.
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

  if (ordered.length <= cap) return ordered;

  const templateSlots = ordered.filter((exercise) => !isDisposableFinisher(exercise));
  const finishers = ordered.filter((exercise) => isDisposableFinisher(exercise));

  if (templateSlots.length >= cap) {
    return templateSlots.slice(0, cap);
  }

  const remaining = cap - templateSlots.length;
  return [...templateSlots, ...finishers.slice(0, remaining)];
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

      return {
        ...block,
        subtitle: `${exercises.length} movimentos · sessão Iron`,
        iron: { ...block.iron, exercises },
      };
    });
  }
}

/**
 * Time-budget prune on Iron day picks (pre-map). Same scissors as
 * `pruneIronExercisesForTimeBudget`, applied before `mapToIronPrescription`.
 */
export function pruneIronDayBlockPicks<
  TPick extends { exerciseId: string; prescription: IronExercisePrescription },
>(
  dayBlocks: Array<{ picks: TPick[] }>,
  catalog: LibraryExercise[],
  availableMinutes: number,
  prerequisiteSlugs: string[] = [],
): void {
  for (const block of dayBlocks) {
    if (block.picks.length === 0) continue;

    const prescriptions = block.picks.map((pick) => pick.prescription);
    const pruned = pruneIronExercisesForTimeBudget(
      prescriptions,
      catalog,
      prerequisiteSlugs,
      availableMinutes,
    );

    const remaining = [...block.picks];
    block.picks = pruned.flatMap((exercise) => {
      const index = remaining.findIndex((pick) => pick.exerciseId === exercise.exercise_id);
      if (index < 0) return [];
      const [pick] = remaining.splice(index, 1);
      return pick ? [pick] : [];
    });
  }
}
