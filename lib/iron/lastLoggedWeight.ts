import {
  normalizeExerciseSlug,
  slugFromExerciseName,
} from '@/lib/gameplan/engine/iron/exerciseLogMatch';
import {
  ironExercisesFromPerformanceLog,
  setsFromSessionExercise,
  type IronSessionLog,
  type PerformanceLogEntry,
} from '@/types/performance';

function ironEntryMatches(
  iron: { exercise_id: string; exercise_slug?: string; exercise_name?: string },
  exerciseId: string,
  exerciseSlug?: string | null,
): boolean {
  if (iron.exercise_id === exerciseId) return true;

  const targetSlug = exerciseSlug ? normalizeExerciseSlug(exerciseSlug) : null;
  if (!targetSlug) return false;

  if (iron.exercise_slug && normalizeExerciseSlug(iron.exercise_slug) === targetSlug) return true;
  if (iron.exercise_name && slugFromExerciseName(iron.exercise_name) === targetSlug) return true;

  return false;
}

/** Last working-set weight for an exercise from in-progress session or committed logs. */
export function lastLoggedWeightFromPerformanceHistory(
  exerciseId: string,
  performanceLogs: readonly PerformanceLogEntry[],
  pendingSession: IronSessionLog | null,
  blockId?: string | null,
  exerciseSlug?: string | null,
): number | null {
  if (pendingSession && (!blockId || pendingSession.blockId === blockId)) {
    const inProgress = pendingSession.exercises.find(
      (row) =>
        row.exerciseId === exerciseId ||
        (exerciseSlug != null &&
          normalizeExerciseSlug(row.exerciseSlug) === normalizeExerciseSlug(exerciseSlug)),
    );
    const lastInProgress = inProgress?.sets[inProgress.sets.length - 1];
    if (lastInProgress?.weightKg != null && lastInProgress.weightKg > 0) {
      return lastInProgress.weightKg;
    }
  }

  for (const entry of performanceLogs) {
    if (entry.pillar !== 'iron') continue;
    for (const iron of ironExercisesFromPerformanceLog(entry)) {
      if (!ironEntryMatches(iron, exerciseId, exerciseSlug)) continue;
      const lastSet = iron.sets[iron.sets.length - 1];
      if (lastSet?.weight_kg != null && lastSet.weight_kg > 0) {
        return lastSet.weight_kg;
      }
    }
  }

  return null;
}

/** Rebuild per-exercise set logs from a persisted in-progress Iron session. */
export function ironExerciseLogsFromPendingSession(
  pendingSession: IronSessionLog | null,
  blockId: string,
): { exercise_id: string; exercise_name: string; sets: ReturnType<typeof setsFromSessionExercise> }[] {
  if (!pendingSession || pendingSession.blockId !== blockId) return [];

  return pendingSession.exercises.map((exercise) => ({
    exercise_id: exercise.exerciseId,
    exercise_name: exercise.exerciseName ?? exercise.exerciseSlug,
    sets: setsFromSessionExercise(exercise),
  }));
}
