import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';

const BACK_MUSCLES = new Set(['back', 'lats', 'mid_back']);

/** Slot `primaryMuscleHint` matching — bridges bundled catalog (`shoulders`) and seed (`side_delts`). */
export function matchesMuscleSlotHint(exercise: CatalogExercise, hint: string | undefined): boolean {
  if (!hint) return true;

  if (hint === 'back') return BACK_MUSCLES.has(exercise.primary_muscle);

  if (hint === 'side_delts') {
    return (
      exercise.primary_muscle === 'side_delts' ||
      (exercise.primary_muscle === 'shoulders' && /lateral/i.test(exercise.slug))
    );
  }

  if (hint === 'rear_delts') {
    return (
      exercise.primary_muscle === 'rear_delts' ||
      exercise.primary_muscle === 'rear delt' ||
      (exercise.primary_muscle === 'shoulders' && /rear|reverse|face.pull|pec_deck/i.test(exercise.slug))
    );
  }

  if (hint === 'front_delts') {
    return exercise.primary_muscle === 'front_delts' || exercise.primary_muscle === 'shoulders';
  }

  if (hint === 'upper_chest') {
    return exercise.primary_muscle === 'upper_chest' || exercise.primary_muscle === 'chest';
  }

  if (hint === 'chest') {
    return exercise.primary_muscle === 'chest' || exercise.primary_muscle === 'upper_chest';
  }

  return exercise.primary_muscle === hint;
}
