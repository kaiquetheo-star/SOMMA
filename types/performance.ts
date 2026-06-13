export type WorkoutPillarLog = 'iron' | 'nutrition';

export interface IronSetLog {
  set_index: number;
  weight_kg: number;
  reps: number;
  target_reps: number;
  /** Prescribed RIR at set completion (0–4) */
  target_rir?: number | null;
  /** Athlete-reported RIR after the set (0–4) — drives load telemetry */
  reported_rir?: number | null;
  /** @deprecated Use reported_rir — kept for persisted offline rows */
  rir?: number | null;
  rest_seconds_used: number;
  logged_at: string;
}

export interface LegacyIronSessionLog {
  block_id: string;
  exercise_name: string;
  exercise_id: string;
  sets: IronSetLog[];
  completed_at: string;
}

export interface IronSessionSetLog {
  setIndex: number;
  weightKg: number;
  reps: number;
  rir: number;
  restSecondsUsed: number;
  loggedAt: string;
  targetReps?: number;
  targetRir?: number | null;
}

export interface IronSessionExerciseLog {
  exerciseId: string;
  exerciseSlug: string;
  exerciseName?: string;
  sets: IronSessionSetLog[];
  completedAt: string;
}

export interface IronSessionLog {
  sessionId: string;
  blockId: string;
  exercises: IronSessionExerciseLog[];
  completedAt: string;
}

export interface PerformanceLog {
  type: 'session';
  data: IronSessionLog;
}

export interface PerformanceLogEntry {
  id: string;
  /** New canonical contract. Optional only so persisted/test legacy rows remain readable. */
  type?: 'session';
  /** New canonical session payload. Optional only so persisted/test legacy rows remain readable. */
  data?: IronSessionLog;
  pillar: WorkoutPillarLog;
  block_id: string;
  /** @deprecated Read from `data.exercises`; accepted only for persisted legacy rows. */
  iron?: LegacyIronSessionLog;
  timestamp: string;
}

export interface WorkoutCompletionInput {
  block_id: string;
  pillar: WorkoutPillarLog;
  rpe_score?: number | null;
  volume?: number | null;
  exercise_id?: string | null;
  weight_used?: number | null;
  reps_completed?: number | null;
  actual_rest_seconds?: number | null;
  /** Iron set sync metadata */
  target_rir?: number | null;
}

export type PerformanceSyncKind = 'block_complete' | 'iron_set';

export interface PerformanceQueueItem {
  id: string;
  type?: 'session';
  data?: IronSessionLog;
  kind?: PerformanceSyncKind;
  input: WorkoutCompletionInput;
  session: PerformanceLogEntry | null;
  /** Present when kind is iron_set — one row per logged set */
  iron_set?: IronSetLog;
  created_at: string;
}

export interface E1rmUnlock {
  exercise_id: string;
  exercise_name: string;
  e1rm_kg: number;
  previous_best_kg: number | null;
}

/** Premium post-workout summary — shown when a microcycle day is fully complete */
export interface WorkoutSessionSummary {
  day_index: number;
  focus_label: string;
  total_volume_kg: number;
  cns_fatigue_total: number;
  e1rm_unlocks: E1rmUnlock[];
  completed_at: string;
}

export interface LogIronSetInput {
  block_id: string;
  exercise_id: string;
  exercise_slug?: string;
  exercise_name: string;
  set: IronSetLog;
  target_rir?: number | null;
}

export function setsFromSessionExercise(exercise: IronSessionExerciseLog): IronSetLog[] {
  return exercise.sets.map((set) => ({
    set_index: set.setIndex,
    weight_kg: set.weightKg,
    reps: set.reps,
    target_reps: set.targetReps ?? set.reps,
    target_rir: set.targetRir ?? null,
    reported_rir: set.rir,
    rir: set.rir,
    rest_seconds_used: set.restSecondsUsed,
    logged_at: set.loggedAt,
  }));
}

export function ironExercisesFromPerformanceLog(entry: PerformanceLogEntry): LegacyIronSessionLog[] {
  if (entry.type === 'session' && entry.data?.exercises?.length) {
    const session = entry.data;
    return session.exercises.map((exercise) => ({
      block_id: session.blockId,
      exercise_id: exercise.exerciseId,
      exercise_name: exercise.exerciseName ?? exercise.exerciseSlug,
      sets: setsFromSessionExercise(exercise),
      completed_at: exercise.completedAt,
    }));
  }

  return entry.iron ? [entry.iron] : [];
}
