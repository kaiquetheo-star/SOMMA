/**
 * Constitution set floors — single source of truth.
 * Compounds ≥ 2 · Isolators ≥ 1 per session (never below 1 except explicit deload).
 */

export const SET_FLOORS = {
  primary_compound: 2,
  secondary_compound: 2,
  isolation_metabolic: 1,
  isolation_mechanical: 1,
  pre_exhaust: 1,
  corrective: 1,
} as const;

export type SetFloorRole = keyof typeof SET_FLOORS;

export function applySetFloors(sets: number, tacticalRole: string | null | undefined): number {
  const floor =
    tacticalRole != null && tacticalRole in SET_FLOORS
      ? SET_FLOORS[tacticalRole as SetFloorRole]
      : 1;
  return Math.max(floor, sets);
}

/** Resolve Constitution floor from tactical role, falling back by movement pattern. */
export function setFloorForExercise(exercise: {
  tactical_role?: string | null;
  movement_pattern?: string | null;
}): number {
  if (exercise.tactical_role != null && exercise.tactical_role in SET_FLOORS) {
    return SET_FLOORS[exercise.tactical_role as SetFloorRole];
  }
  if (exercise.movement_pattern != null && exercise.movement_pattern !== 'isolation') {
    return SET_FLOORS.primary_compound;
  }
  return SET_FLOORS.isolation_metabolic;
}
