import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';

const BACK_MUSCLES = new Set(['back', 'lats', 'mid_back']);

/** Slot `primaryMuscleHint` matching — bridges bundled catalog (`shoulders`) and seed (`side_delts`). */
export function matchesMuscleSlotHint(exercise: CatalogExercise, hint: string | undefined): boolean {
  if (!hint) return true;

  if (hint === 'back') return BACK_MUSCLES.has(exercise.primary_muscle);

  if (hint === 'side_delts') {
    return (
      exercise.primary_muscle === 'side_delts' ||
      ((exercise.primary_muscle === 'shoulders' || exercise.primary_muscle === 'general') &&
        /lateral|side/i.test(exercise.slug))
    );
  }

  if (hint === 'rear_delts') {
    return (
      exercise.primary_muscle === 'rear_delts' ||
      exercise.primary_muscle === 'rear delt' ||
      ((exercise.primary_muscle === 'shoulders' || exercise.primary_muscle === 'general') &&
        /rear|reverse|face.pull|pec_deck|posterior/i.test(exercise.slug))
    );
  }

  if (hint === 'front_delts') {
    return (
      exercise.primary_muscle === 'front_delts' ||
      exercise.primary_muscle === 'shoulders' ||
      exercise.primary_muscle === 'delts' ||
      /front|anterior/i.test(exercise.slug)
    );
  }

  if (hint === 'upper_chest') {
    return exercise.primary_muscle === 'upper_chest' || exercise.primary_muscle === 'chest';
  }

  if (hint === 'chest') {
    return exercise.primary_muscle === 'chest' || exercise.primary_muscle === 'upper_chest';
  }

  if (hint === 'hamstrings') {
    return (
      exercise.primary_muscle === 'hamstrings' ||
      exercise.synergist_muscles.includes('hamstrings') ||
      /rdl|romanian|stiff_leg|deadlift|good_morning|hip_thrust/i.test(exercise.slug)
    );
  }

  if (hint === 'quads') {
    return (
      exercise.primary_muscle === 'quads' ||
      exercise.primary_muscle === 'quadriceps' ||
      exercise.synergist_muscles.includes('quads') ||
      exercise.synergist_muscles.includes('quadriceps')
    );
  }

  if (hint === 'glutes') {
    return (
      exercise.primary_muscle === 'glutes' ||
      exercise.primary_muscle === 'gluteus_maximus' ||
      exercise.synergist_muscles.includes('glutes')
    );
  }

  if (hint === 'calves') {
    return exercise.primary_muscle === 'calves' || exercise.primary_muscle === 'calf';
  }

  return exercise.primary_muscle === hint;
}
