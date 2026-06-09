import type { CatalogExercise, ShoulderRegion } from '@/lib/gameplan/engine/iron/types';

const FRONT_DELT = 'front_delts';
const SIDE_DELT = 'side_delts';
const REAR_DELT = 'rear_delts';
const UPPER_CHEST = 'upper_chest';

const SHOULDER_SYNERGIST_TOKENS = new Set([
  FRONT_DELT,
  SIDE_DELT,
  REAR_DELT,
  'shoulders',
  'deltoids',
  'delts',
  'rotator_cuff',
]);

function normalizeToken(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, '_');
}

function hasFrontDeltInvolvement(exercise: CatalogExercise): boolean {
  const primary = normalizeToken(exercise.primary_muscle);
  if (primary === FRONT_DELT) return true;

  return exercise.synergist_muscles.some((muscle) => normalizeToken(muscle) === FRONT_DELT);
}

function hasUpperChestWithShoulderSynergists(exercise: CatalogExercise): boolean {
  const primary = normalizeToken(exercise.primary_muscle);
  if (primary !== UPPER_CHEST) return false;

  return exercise.synergist_muscles.some((muscle) =>
    SHOULDER_SYNERGIST_TOKENS.has(normalizeToken(muscle)),
  );
}

/**
 * Maps an exercise to an anterior / lateral / posterior shoulder region for 3D balance rules.
 * Returns `null` when the movement does not materially load the shoulder complex.
 */
export function classifyShoulderRegion(exercise: CatalogExercise): ShoulderRegion | null {
  const primary = normalizeToken(exercise.primary_muscle);

  if (primary === SIDE_DELT) return 'lateral';
  if (primary === REAR_DELT || primary === 'rear delt') return 'posterior';

  if (primary === 'shoulders') {
    if (/lateral/i.test(exercise.slug)) return 'lateral';
    if (/rear|reverse|face.pull|pec_deck/i.test(exercise.slug)) return 'posterior';
  }

  if (hasFrontDeltInvolvement(exercise) || hasUpperChestWithShoulderSynergists(exercise)) {
    return 'anterior';
  }

  return null;
}
