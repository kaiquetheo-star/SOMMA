import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { sommaPersistStorage } from '@/lib/storage/persistStorage';

import { fetchLibraryExercises } from '@/lib/catalog/library';
import {
    computeReadinessScore,
    type AdaptationLogEntry,
    type BiometricCheckpoint,
    type ReadinessScan,
} from '@/lib/gameplan/engine/adaptiveStateMachine';
import { applyReadinessAutoregulationToMicrocycle } from '@/lib/gameplan/engine/clinicalLaws';
import { fetchDailyGameplan } from '@/lib/gameplan/fetchDailyGameplan';
import { isGameplanFetchError } from '@/lib/gameplan/gameplanErrors';
import { isProtocolDateStale } from '@/lib/gameplan/generateStubGameplan';
import {
    isDegenerateMicrocycle,
    sanitizeMicrocycleIronVolume,
} from '@/lib/gameplan/microcycleValidation';
import { getMicrocycleDay, getTodayDayIndex } from '@/lib/gameplan/microcycleWeek';
import { normalizePersistedSnapshot, type SommaPersistedSnapshot } from '@/lib/local/backup';
import {
    mergePerformanceLogsWithQueue,
    recalibrateFromPerformanceQueue,
} from '@/lib/local/recalibrate';
import {
    applyDamageControl,
    injectMetabolicFlushBlock,
    restoreDamageControlTarget,
} from '@/lib/physics/damageControl';
import { buildWorkoutSessionSummary } from '@/lib/workout/buildSessionSummary';
import type { BiologicalProfile } from '@/types/biological';
import {
    DEFAULT_TRAINING_DAYS_PER_WEEK,
    initialBiologicalProfile,
    isBiologicalProfileComplete,
    normalizeBodyFatFields,
    withFixedBiologicalProfile,
} from '@/types/biological';
import type { ClinicalExitInterview } from '@/types/clinical';
import type {
    DailyGameplan,
    GameplanBlock,
    GameplanBlockStatus,
    MicrocycleDay,
} from '@/types/gameplan';
import type {
    IronSessionLog,
    LogIronSetInput,
    PerformanceLogEntry,
    PerformanceQueueItem,
    WorkoutCompletionInput,
    WorkoutSessionSummary,
} from '@/types/performance';

export type { LogIronSetInput, PerformanceQueueItem, WorkoutCompletionInput } from '@/types/performance';

/** Equipment tags aligned with SRS REQ-1.3 / `user_environment` schema */
export type EquipmentTag =
  | 'bodyweight'
  | 'dumbbells'
  | 'barbell'
  | 'kettlebell'
  | 'pull_up_bar'
  | 'full_gym';

export type PillarId = 'iron' | 'nutrition';

/** Product focus distribution for Iron + nutrition */
export interface FocusPreference {
  iron: number;
  nutrition: number;
}

export interface UserEnvironment {
  available_equipment: EquipmentTag[];
  updated_at: string | null;
}

export interface UserStats {
  iron_sessions_completed: number;
  nutrition_checkins_completed: number;
}

export interface UserFoundation {
  focus_preference: FocusPreference | null;
  foundation_completed_at: string | null;
}

function applyGameplanToState(gameplan: DailyGameplan, source: SommaState['gameplan_source']) {
  const state = useSommaStore.getState();
  const weeklyMicrocycle = applyDamageControlToMicrocycle(
    sanitizeMicrocycleIronVolume(gameplan.microcycle),
    state.damageControlActiveDates,
  );
  return {
    weeklyMicrocycle,
    protocolDate: gameplan.date,
    weekStartDate: gameplan.week_start_date ?? null,
    protocolGeneratedAt: gameplan.generated_at,
    selectedDayIndex: getTodayDayIndex(gameplan.week_start_date),
    gameplan_source: source,
    adaptationLogs: gameplan.adaptation_logs ?? [],
  };
}

function applyDamageControlToMicrocycle(
  microcycle: MicrocycleDay[],
  activeDates: readonly string[],
): MicrocycleDay[] {
  const active = new Set(activeDates);

  return microcycle.map((day) => {
    const date = day.date;
    const shouldApply = Boolean(date && active.has(date));
    const existingFlush = day.blocks.find((block) => block.id === `block-d${day.day_index}-metabolic-flush`);
    const blocksWithoutFlush = day.blocks.filter((block) => block.id !== `block-d${day.day_index}-metabolic-flush`);
    const normalizedBlocks = blocksWithoutFlush.map((block) => {
      if (block.pillar !== 'nutrition' || !block.nutrition?.nutrition_target) return block;

      const target = shouldApply
        ? applyDamageControl(block.nutrition.nutrition_target)
        : restoreDamageControlTarget(block.nutrition.nutrition_target);

      return {
        ...block,
        subtitle: `${target.total_calories} kcal · ${target.carbs_g}g C · ${target.protein_g}g P · ${target.fat_g}g F`,
        nutrition: {
          ...block.nutrition,
          note: target.note
            ? `${target.note} · Water ${target.water_ml}ml`
            : `Peri-workout carbs: ${Math.round(target.carbs_g * target.peri_workout_carb_ratio)}g · Water ${target.water_ml}ml`,
          nutrition_target: target,
        },
      };
    });

    if (!shouldApply) {
      return {
        ...day,
        blocks: normalizedBlocks.sort((a, b) => a.order - b.order),
      };
    }

    const maxOrder = normalizedBlocks.reduce((max, block) => Math.max(max, block.order), -1);
    const flushBlock = {
      ...injectMetabolicFlushBlock(day.day_index),
      order: maxOrder + 1,
      status: existingFlush?.status ?? 'pending',
    };

    return {
      ...day,
      blocks: [...normalizedBlocks, flushBlock].sort((a, b) => a.order - b.order),
    };
  });
}

function mergeBlockStatuses(
  microcycle: MicrocycleDay[],
  previous: MicrocycleDay[] | null,
): MicrocycleDay[] {
  if (!previous) return microcycle;

  return microcycle.map((day) => {
    const previousDay = previous.find((entry) => entry.day_index === day.day_index);
    const blocks = day.blocks ?? [];
    return {
      ...day,
      is_completed: previousDay?.is_completed ?? day.is_completed,
      blocks: blocks.map((block) => {
        const wasCompleted = previous
          .flatMap((prevDay) => prevDay.blocks ?? [])
          .find((prev) => prev.id === block.id);
        return wasCompleted?.status === 'completed'
          ? {
              ...block,
              status: 'completed' as const,
              completed_at: wasCompleted.completed_at,
            }
          : block;
      }),
    };
  });
}

function markBlockCompletedInMicrocycle(
  microcycle: MicrocycleDay[] | null,
  blockId: string,
  completedAt: string,
): MicrocycleDay[] | null {
  if (!microcycle) return microcycle;

  let completedDayIndex: number | null = null;
  const withBlockComplete = microcycle.map((day) => {
    let dayContainsBlock = false;
    const blocks = (day.blocks ?? []).map((block) => {
      if (block.id !== blockId) return block;
      dayContainsBlock = true;
      return {
        ...block,
        status: 'completed' as const,
        completed_at: block.completed_at ?? completedAt,
      };
    });

    if (!dayContainsBlock) return { ...day, blocks };
    completedDayIndex = day.day_index;
    return { ...day, blocks };
  });

  return completedDayIndex == null
    ? withBlockComplete
    : markDayCompletedIfReady(withBlockComplete, completedDayIndex);
}

export { getMicrocycleDay } from '@/lib/gameplan/microcycleWeek';

/** Today's scheduled training blocks */
export function getTodayBlocksFromStore(state: {
  weeklyMicrocycle: MicrocycleDay[] | null;
  weekStartDate: string | null;
}): GameplanBlock[] {
  const todayIndex = getTodayDayIndex(state.weekStartDate);
  return getMicrocycleDay(state.weeklyMicrocycle, todayIndex)?.blocks ?? [];
}

/** True when every training block on the selected strip day is completed */
export function isSelectedDayProtocolComplete(state: {
  weeklyMicrocycle: MicrocycleDay[] | null;
  selectedDayIndex: number;
}): boolean {
  const day = getMicrocycleDay(state.weeklyMicrocycle, state.selectedDayIndex);
  const blocks = day?.blocks ?? [];
  if (!day || day.is_rest_day || blocks.length === 0) return false;
  return blocks.every((block) => block.status === 'completed');
}

function markDayCompletedIfReady(
  microcycle: MicrocycleDay[] | null,
  dayIndex: number,
): MicrocycleDay[] | null {
  if (!microcycle) return microcycle;

  return microcycle.map((day) => {
    if (day.day_index !== dayIndex || day.is_rest_day) return day;
    const blocks = day.blocks ?? [];
    const allBlocksDone =
      blocks.length > 0 && blocks.every((block) => block.status === 'completed');
    return allBlocksDone ? { ...day, is_completed: true } : day;
  });
}

function createSessionId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createEmptyIronSession(blockId: string): IronSessionLog {
  const now = new Date().toISOString();
  return {
    sessionId: createSessionId(),
    blockId,
    exercises: [],
    completedAt: now,
  };
}

function updateExerciseInSession(
  exercises: IronSessionLog['exercises'],
  input: LogIronSetInput,
): IronSessionLog['exercises'] {
  const set = {
    setIndex: input.set.set_index,
    weightKg: input.set.weight_kg,
    reps: input.set.reps,
    rir: input.set.reported_rir ?? input.set.rir ?? input.target_rir ?? 2,
    restSecondsUsed: input.set.rest_seconds_used,
    loggedAt: input.set.logged_at,
    targetReps: input.set.target_reps,
    targetRir: input.set.target_rir ?? input.target_rir ?? null,
  };
  const existing = exercises.find((exercise) => exercise.exerciseId === input.exercise_id);
  const completedAt = input.set.logged_at;

  if (!existing) {
    return [
      ...exercises,
      {
        exerciseId: input.exercise_id,
        exerciseSlug: input.exercise_slug ?? input.exercise_id,
        exerciseName: input.exercise_name,
        sets: [set],
        completedAt,
      },
    ];
  }

  return exercises.map((exercise) => {
    if (exercise.exerciseId !== input.exercise_id) return exercise;
    const sets = [...exercise.sets.filter((row) => row.setIndex !== set.setIndex), set].sort(
      (a, b) => a.setIndex - b.setIndex,
    );
    return {
      ...exercise,
      exerciseSlug: input.exercise_slug ?? exercise.exerciseSlug,
      exerciseName: input.exercise_name ?? exercise.exerciseName,
      sets,
      completedAt,
    };
  });
}

function createSessionLog(session: IronSessionLog, completedAt: string): PerformanceLogEntry {
  const completedSession: IronSessionLog = {
    ...session,
    completedAt,
    exercises: session.exercises.map((exercise) => ({
      ...exercise,
      completedAt: exercise.completedAt || completedAt,
    })),
  };

  return {
    id: completedSession.sessionId,
    type: 'session',
    data: completedSession,
    pillar: 'iron',
    block_id: completedSession.blockId,
    timestamp: completedAt,
  };
}

interface SommaState {
  /** False until persist rehydration completes — never written to storage */
  _hasHydrated: boolean;
  user_environment: UserEnvironment;
  user_stats: UserStats;
  user_foundation: UserFoundation;
  user_biological: BiologicalProfile;
  /** 7-day Head Coach microcycle (Mon–Sun) */
  weeklyMicrocycle: MicrocycleDay[] | null;
  /** Calendar date the protocol was generated for (staleness gate) */
  protocolDate: string | null;
  weekStartDate: string | null;
  protocolGeneratedAt: string | null;
  /** Active day in the strip (1 = Monday … 7 = Sunday) */
  selectedDayIndex: number;
  /** Daily readiness scan (Clinical Law II) — calendar date when last completed */
  readinessScanDate: string | null;
  subjectiveReadiness: number | null;
  readinessScan: ReadinessScan | null;
  biometricCheckpoints: BiometricCheckpoint[];
  showReadinessModal: boolean;
  adaptationLogs: AdaptationLogEntry[];
  damageControlActiveDates: string[];
  setSelectedDayIndex: (dayIndex: number) => void;
  toggleDamageControlDate: (date: string) => void;
  needsDailyReadinessScan: () => boolean;
  applySubjectiveReadiness: (score: number) => void;
  submitReadinessScan: (scan: ReadinessScan) => void;
  submitBiometricCheckpoint: (checkpoint: BiometricCheckpoint) => void;
  setShowReadinessModal: (show: boolean) => void;
  submitClinicalExitInterview: (interview: ClinicalExitInterview) => Promise<void>;
  getClinicalReviewTrigger: () => null;
  performance_logs: PerformanceLogEntry[];
  performanceQueue: PerformanceQueueItem[];
  pendingSession: IronSessionLog | null;
  performance_syncing: boolean;
  lastWorkoutSummary: WorkoutSessionSummary | null;
  setUserEnvironment: (patch: Partial<UserEnvironment>) => void;
  setUserStats: (patch: Partial<UserStats>) => void;
  setUserFoundation: (patch: Partial<UserFoundation>) => void;
  setUserBiological: (patch: Partial<BiologicalProfile>) => void;
  setWeeklyMicrocycle: (
    gameplan: DailyGameplan | null,
    source?: SommaState['gameplan_source'],
  ) => void;
  gameplan_loading: boolean;
  gameplan_source: 'ai' | 'fallback' | 'stub' | 'deterministic' | 'local' | null;
  /** Set when Head Coach / Edge generation fails — Home shows Neural Link Failed */
  gameplan_error: string | null;
  clearGameplanError: () => void;
  ensureDailyGameplan: () => void;
  fetchDailyGameplanAsync: (options?: { forceRefresh?: boolean }) => Promise<void>;
  regenerateDailyGameplan: () => Promise<void>;
  setBlockStatus: (blockId: string, status: GameplanBlockStatus) => void;
  completeBlock: (blockId: string) => void;
  logIronSet: (input: LogIronSetInput) => void;
  prepareWorkoutSummary: () => Promise<WorkoutSessionSummary | null>;
  completeWorkout: (input: WorkoutCompletionInput) => Promise<void>;
  flushPerformanceQueue: () => Promise<void>;
  completeFoundationScan: (payload: {
    focus_preference: FocusPreference;
    available_equipment: EquipmentTag[];
    biological: BiologicalProfile;
  }) => void;
  /** Remote profile sync — foundation fields only; gameplan owned by Home fetch */
  hydrateFoundationFromRemote: (payload: {
    focus_preference: FocusPreference;
    available_equipment: EquipmentTag[];
    biological: BiologicalProfile;
  }) => void;
  /** Clears all local SOMMA state and persisted offline cache */
  resetStore: () => Promise<void>;
  /** Replace persisted offline data from a backup JSON payload */
  restoreFromBackup: (raw: unknown) => Promise<void>;
  /** @deprecated Use resetStore */
  resetSommaState: () => void;
}

const initialEnvironment: UserEnvironment = {
  available_equipment: [],
  updated_at: null,
};

const initialStats: UserStats = {
  iron_sessions_completed: 0,
  nutrition_checkins_completed: 0,
};

const initialFoundation: UserFoundation = {
  focus_preference: null,
  foundation_completed_at: null,
};

export const useSommaStore = create<SommaState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      user_environment: initialEnvironment,
      user_stats: initialStats,
      user_foundation: initialFoundation,
      user_biological: withFixedBiologicalProfile(initialBiologicalProfile),
      weeklyMicrocycle: null,
      protocolDate: null,
      weekStartDate: null,
      protocolGeneratedAt: null,
      selectedDayIndex: getTodayDayIndex(),
      readinessScanDate: null,
      subjectiveReadiness: null,
      readinessScan: null,
      biometricCheckpoints: [],
      showReadinessModal: false,
      adaptationLogs: [],
      damageControlActiveDates: [],
      performance_logs: [],
      performanceQueue: [],
      pendingSession: null,
      performance_syncing: false,
      lastWorkoutSummary: null,
      gameplan_loading: false,
      gameplan_source: null,
      gameplan_error: null,

      setUserEnvironment: (patch) =>
        set((state) => ({
          user_environment: {
            ...state.user_environment,
            ...patch,
            updated_at: patch.updated_at ?? new Date().toISOString(),
          },
        })),

      setUserStats: (patch) =>
        set((state) => ({
          user_stats: { ...state.user_stats, ...patch },
        })),

      setUserFoundation: (patch) =>
        set((state) => ({
          user_foundation: { ...state.user_foundation, ...patch },
        })),

      setUserBiological: (patch) =>
        set((state) => {
          const merged = withFixedBiologicalProfile({
            ...state.user_biological,
            ...patch,
            ...normalizeBodyFatFields({ ...state.user_biological, ...patch }),
          });
          return { user_biological: merged };
        }),

      setSelectedDayIndex: (dayIndex) =>
        set({
          selectedDayIndex: Math.min(7, Math.max(1, Math.round(dayIndex))),
        }),

      toggleDamageControlDate: (date) =>
        set((state) => {
          const active = new Set(state.damageControlActiveDates);
          if (active.has(date)) active.delete(date);
          else active.add(date);

          const damageControlActiveDates = [...active].sort();
          return {
            damageControlActiveDates,
            weeklyMicrocycle: state.weeklyMicrocycle
              ? applyDamageControlToMicrocycle(state.weeklyMicrocycle, damageControlActiveDates)
              : state.weeklyMicrocycle,
          };
        }),

      needsDailyReadinessScan: () => {
        const state = get();
        const today = new Date().toISOString().slice(0, 10);
        return state.readinessScanDate !== today;
      },

      applySubjectiveReadiness: (score) => {
        const clamped = Math.min(10, Math.max(1, Math.round(score)));
        const today = new Date().toISOString().slice(0, 10);
        set((state) => {
          const microcycle = state.weeklyMicrocycle
            ? applyReadinessAutoregulationToMicrocycle(
                state.weeklyMicrocycle,
                state.selectedDayIndex,
                clamped,
              )
            : null;

          return {
            subjectiveReadiness: clamped,
            readinessScanDate: today,
            weeklyMicrocycle: microcycle,
          };
        });
      },

      submitReadinessScan: (scan) => {
        const today = new Date().toISOString().slice(0, 10);
        set((state) => ({
          readinessScan: scan,
          subjectiveReadiness: computeReadinessScore(scan),
          readinessScanDate: today,
          showReadinessModal: false,
        }));
      },

      submitBiometricCheckpoint: (checkpoint) => {
        set((state) => ({
          biometricCheckpoints: [...state.biometricCheckpoints, checkpoint].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        }));
      },

      setShowReadinessModal: (show) => set({ showReadinessModal: show }),

      getClinicalReviewTrigger: () => null,

      submitClinicalExitInterview: async (interview) => {
        set((state) => ({
          user_biological: {
            ...state.user_biological,
            clinical_exit_interview: interview,
          },
        }));

        try {
          await get().regenerateDailyGameplan();
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Recalibration after Exit Interview failed';
          console.warn('[SOMMA] Month 2 recalibration after Exit Interview failed:', message);
          set({ gameplan_error: message });
        }
      },

      clearGameplanError: () => set({ gameplan_error: null }),

      setWeeklyMicrocycle: (gameplan, source) =>
        set((state) =>
          gameplan
            ? {
                ...applyGameplanToState(gameplan, source ?? state.gameplan_source),
              }
            : {
                weeklyMicrocycle: null,
                protocolDate: null,
                weekStartDate: null,
                protocolGeneratedAt: null,
                gameplan_source: source ?? state.gameplan_source,
              },
        ),

      ensureDailyGameplan: () => {
        const state = get();
        if (!state.user_foundation.focus_preference) return;
        if (!isProtocolDateStale(state.protocolDate) && state.weeklyMicrocycle) return;
        void get().fetchDailyGameplanAsync();
      },

      fetchDailyGameplanAsync: async (options) => {
        const state = get();
        const focus = state.user_foundation.focus_preference;
        if (!focus) return;
        if (!isBiologicalProfileComplete(state.user_biological)) return;

        set({ gameplan_loading: true, gameplan_error: null });

        try {
          const performanceLogs = mergePerformanceLogsWithQueue(
            state.performance_logs,
            state.performanceQueue,
          );

          const result = await fetchDailyGameplan({
            focus,
            equipment: state.user_environment.available_equipment,
            forceRefresh: options?.forceRefresh ?? false,
            biological: state.user_biological,
            userStats: state.user_stats,
            performanceLogs,
            readinessScan: state.readinessScan ?? undefined,
            biometricCheckpoints: state.biometricCheckpoints,
          });

          set({
            ...applyGameplanToState(result.gameplan, result.source),
            gameplan_loading: false,
            gameplan_error: null,
          });
        } catch (error) {
          const message = isGameplanFetchError(error)
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Head Coach could not build your protocol locally';
          console.error('[SOMMA] fetchDailyGameplanAsync failed:', message, error);
          const current = get();
          set({
            gameplan_loading: false,
            gameplan_error: message,
            ...(current.weeklyMicrocycle
              ? {}
              : {
                  weeklyMicrocycle: null,
                  protocolDate: null,
                  weekStartDate: null,
                  protocolGeneratedAt: null,
                }),
          });
        }
      },

      regenerateDailyGameplan: async () => {
        await get().fetchDailyGameplanAsync({ forceRefresh: true });
      },

      setBlockStatus: (blockId, status) =>
        set((state) => {
          if (!state.weeklyMicrocycle) return state;
          if (status === 'completed') {
            return {
              weeklyMicrocycle: markBlockCompletedInMicrocycle(
                state.weeklyMicrocycle,
                blockId,
                new Date().toISOString(),
              ),
            };
          }

          return {
            weeklyMicrocycle: state.weeklyMicrocycle.map((day) => ({
              ...day,
              blocks: (day.blocks ?? []).map((block) =>
                block.id === blockId ? { ...block, status } : block,
              ),
            })),
          };
        }),

      completeBlock: (blockId) =>
        set((state) => {
          return {
            weeklyMicrocycle: markBlockCompletedInMicrocycle(
              state.weeklyMicrocycle,
              blockId,
              new Date().toISOString(),
            ),
          };
        }),

      logIronSet: (input) => {
        set((state) => {
          const currentSession =
            state.pendingSession?.blockId === input.block_id
              ? state.pendingSession
              : createEmptyIronSession(input.block_id);

          return {
            pendingSession: {
              ...currentSession,
              exercises: updateExerciseInSession(currentSession.exercises, input),
            },
          };
        });
      },

      prepareWorkoutSummary: async () => {
        const state = get();
        try {
          const exerciseCatalog = await fetchLibraryExercises();

          const summary = buildWorkoutSessionSummary({
            dayIndex: state.selectedDayIndex,
            weeklyMicrocycle: state.weeklyMicrocycle,
            performanceLogs: state.performance_logs,
            exerciseCatalog,
          });

          set({ lastWorkoutSummary: summary });
          return summary;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Could not prepare workout summary';
          console.error('[SOMMA] prepareWorkoutSummary failed:', message, err);
          set({ gameplan_error: message });
          return null;
        }
      },

      flushPerformanceQueue: async () => {
        const state = get();
        if (state.performanceQueue.length === 0) return;

        const focus = state.user_foundation.focus_preference;
        if (!focus) return;

        set({ performance_syncing: true });

        try {
          const result = await recalibrateFromPerformanceQueue(state.performanceQueue, {
            focus,
            equipment: state.user_environment.available_equipment,
            biological: state.user_biological,
            userStats: state.user_stats,
            performanceLogs: state.performance_logs,
          });

          if (result.processedCount > 0) {
            const previousMicrocycle = get().weeklyMicrocycle;
            const patch: Partial<SommaState> = { performanceQueue: [] };

            if (result.cns_fatigue_score != null) {
              patch.user_biological = {
                ...get().user_biological,
                cns_fatigue_score: result.cns_fatigue_score,
              };
            }

            if (result.gameplan) {
              const mergedMicrocycle = mergeBlockStatuses(
                result.gameplan.microcycle,
                previousMicrocycle,
              );

              Object.assign(
                patch,
                applyGameplanToState(
                  { ...result.gameplan, microcycle: mergedMicrocycle },
                  result.source ?? 'local',
                ),
              );
            }

            set(patch);
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Performance queue flush failed';
          console.error('[SOMMA] flushPerformanceQueue failed:', message, err);
          set({ gameplan_error: message });
        } finally {
          set({ performance_syncing: false });
        }
      },

      completeWorkout: async (input) => {
        const state = get();
        const completedAt = new Date().toISOString();
        const session = state.pendingSession?.blockId === input.block_id ? state.pendingSession : null;
        if (input.pillar === 'iron' && !session) {
          set((current) => ({
            weeklyMicrocycle: markBlockCompletedInMicrocycle(
              current.weeklyMicrocycle,
              input.block_id,
              completedAt,
            ),
          }));
          return;
        }
        const sessionLog = session ? createSessionLog(session, completedAt) : null;

        const queueItem: PerformanceQueueItem = {
          id: sessionLog?.id ?? `queue-${input.block_id}-${Date.now()}`,
          type: sessionLog?.type,
          data: sessionLog?.data,
          input,
          session: sessionLog,
          created_at: completedAt,
        };
        const pendingQueue = [...state.performanceQueue, queueItem];
        const processedQueueIds = new Set(pendingQueue.map((item) => item.id));

        set({
          performance_logs: sessionLog
            ? [
                sessionLog,
                ...state.performance_logs.filter((entry) => entry.id !== sessionLog.id),
              ]
            : state.performance_logs,
          performanceQueue: pendingQueue,
          pendingSession: session ? null : state.pendingSession,
          performance_syncing: true,
        });

        const focus = state.user_foundation.focus_preference;
        const equipment = state.user_environment.available_equipment;

        try {
          if (focus) {
            const result = await recalibrateFromPerformanceQueue(pendingQueue, {
              focus,
              equipment,
              biological: get().user_biological,
              userStats: get().user_stats,
              performanceLogs: get().performance_logs,
            });

            if (result.gameplan) {
              const previousMicrocycle = get().weeklyMicrocycle;
              const mergedMicrocycle = mergeBlockStatuses(
                result.gameplan.microcycle,
                previousMicrocycle,
              );

              const patch: Partial<SommaState> = {
                ...applyGameplanToState(
                  { ...result.gameplan, microcycle: mergedMicrocycle },
                  result.source ?? 'local',
                ),
                performanceQueue: get().performanceQueue.filter((item) => !processedQueueIds.has(item.id)),
              };
              if (result.cns_fatigue_score != null) {
                patch.user_biological = {
                  ...get().user_biological,
                  cns_fatigue_score: result.cns_fatigue_score,
                };
              }
              set(patch);
              return;
            }

            if (result.processedCount > 0) {
              const patch: Partial<SommaState> = {
                performanceQueue: get().performanceQueue.filter((item) => !processedQueueIds.has(item.id)),
              };
              if (result.cns_fatigue_score != null) {
                patch.user_biological = {
                  ...get().user_biological,
                  cns_fatigue_score: result.cns_fatigue_score,
                };
              }
              set(patch);
            }
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Post-workout recalibration failed';
          console.error('[SOMMA] Local recalibration failed:', message, err);
          set({ gameplan_error: message });
        } finally {
          set((current) => ({
            performance_syncing: false,
            weeklyMicrocycle: markBlockCompletedInMicrocycle(
              current.weeklyMicrocycle,
              input.block_id,
              completedAt,
            ),
          }));
        }
      },

      completeFoundationScan: ({ focus_preference, available_equipment, biological }) => {
        set({
          user_foundation: {
            focus_preference,
            foundation_completed_at: new Date().toISOString(),
          },
          user_biological: withFixedBiologicalProfile(biological),
          user_environment: {
            available_equipment,
            updated_at: new Date().toISOString(),
          },
          user_stats: {
            iron_sessions_completed: 0,
            nutrition_checkins_completed: 0,
          },
        });
        void get().fetchDailyGameplanAsync({ forceRefresh: true });
      },

      hydrateFoundationFromRemote: ({
        focus_preference,
        available_equipment,
        biological,
      }) =>
        set((state) => ({
          user_foundation: {
            focus_preference,
            foundation_completed_at:
              state.user_foundation.foundation_completed_at ?? new Date().toISOString(),
          },
          user_biological: withFixedBiologicalProfile(biological),
          user_environment: {
            available_equipment,
            updated_at: new Date().toISOString(),
          },
        })),

      resetStore: async () => {
        set({
          _hasHydrated: true,
          user_environment: { ...initialEnvironment },
          user_stats: { ...initialStats },
          user_foundation: { ...initialFoundation },
          user_biological: withFixedBiologicalProfile(initialBiologicalProfile),
          weeklyMicrocycle: null,
          protocolDate: null,
          weekStartDate: null,
          protocolGeneratedAt: null,
          selectedDayIndex: getTodayDayIndex(),
          readinessScanDate: null,
          subjectiveReadiness: null,
          readinessScan: null,
          biometricCheckpoints: [],
          showReadinessModal: false,
          adaptationLogs: [],
          damageControlActiveDates: [],
          performance_logs: [],
          performanceQueue: [],
          pendingSession: null,
          performance_syncing: false,
          lastWorkoutSummary: null,
          gameplan_loading: false,
          gameplan_source: null,
          gameplan_error: null,
        });

        try {
          await useSommaStore.persist.clearStorage();
        } catch (err) {
          console.warn(
            '[SOMMA] clearStorage failed (may be unavailable in private browsing):',
            err instanceof Error ? err.message : err,
          );
        }
      },

      restoreFromBackup: async (raw) => {
        const snapshot = normalizePersistedSnapshot(raw);
        if (!snapshot) {
          throw new Error('Invalid SOMMA backup file.');
        }

        const patch: SommaPersistedSnapshot & {
          _hasHydrated: boolean;
          performance_syncing: boolean;
          gameplan_loading: boolean;
          gameplan_error: string | null;
          readinessScan?: ReadinessScan | null;
          biometricCheckpoints?: BiometricCheckpoint[];
          adaptationLogs?: AdaptationLogEntry[];
        } = {
          ...snapshot,
          _hasHydrated: true,
          performance_syncing: false,
          gameplan_loading: false,
          gameplan_error: null,
        };

        set(patch);
      },

      resetSommaState: () => {
        void useSommaStore.getState().resetStore();
      },
    }),
    {
      name: 'somma-offline-store',
      storage: sommaPersistStorage,
      skipHydration: true,
      partialize: (state) => ({
        user_environment: state.user_environment,
        user_stats: state.user_stats,
        user_foundation: state.user_foundation,
        user_biological: state.user_biological,
        weeklyMicrocycle: state.weeklyMicrocycle,
        protocolDate: state.protocolDate,
        weekStartDate: state.weekStartDate,
        protocolGeneratedAt: state.protocolGeneratedAt,
        selectedDayIndex: state.selectedDayIndex,
        readinessScanDate: state.readinessScanDate,
        subjectiveReadiness: state.subjectiveReadiness,
        readinessScan: state.readinessScan,
        biometricCheckpoints: state.biometricCheckpoints,
        showReadinessModal: state.showReadinessModal,
        adaptationLogs: state.adaptationLogs,
        damageControlActiveDates: state.damageControlActiveDates,
        performance_logs: state.performance_logs,
        performanceQueue: state.performanceQueue,
        pendingSession: state.pendingSession,
        lastWorkoutSummary: state.lastWorkoutSummary,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('[SOMMA] Persist rehydrate error:', error);
        }
        if (!state) {
          useSommaStore.setState({ _hasHydrated: true });
          return;
        }
        if (!state.user_biological) {
          state.user_biological = withFixedBiologicalProfile(initialBiologicalProfile);
        } else {
          state.user_biological = withFixedBiologicalProfile({
            ...state.user_biological,
            ...normalizeBodyFatFields({
              ...initialBiologicalProfile,
              ...state.user_biological,
            }),
            training_days_per_week:
              state.user_biological.training_days_per_week ?? DEFAULT_TRAINING_DAYS_PER_WEEK,
          });
        }
        const legacy = state as SommaState & {
          currentGameplan?: DailyGameplan | null;
          daily_gameplan?: DailyGameplan | null;
        };

        if (!state.performance_logs) {
          state.performance_logs = [];
        }
        if (!state.performanceQueue) {
          state.performanceQueue = [];
        }
        if (!state.pendingSession) {
          state.pendingSession = null;
        }
        if (!state.damageControlActiveDates) {
          state.damageControlActiveDates = [];
        }
        if (!state.readinessScan) {
          state.readinessScan = null;
        }
        if (!state.biometricCheckpoints) {
          state.biometricCheckpoints = [];
        }
        if (!state.adaptationLogs) {
          state.adaptationLogs = [];
        }

        if (!state.weeklyMicrocycle) {
          const legacyPlan = legacy.currentGameplan ?? legacy.daily_gameplan;
          if (legacyPlan?.microcycle?.length) {
            state.weeklyMicrocycle = sanitizeMicrocycleIronVolume(legacyPlan.microcycle);
            state.protocolDate = legacyPlan.date;
            state.weekStartDate = legacyPlan.week_start_date ?? null;
            state.protocolGeneratedAt = legacyPlan.generated_at;
          }
        }

        if (!state.selectedDayIndex) {
          state.selectedDayIndex = getTodayDayIndex(state.weekStartDate);
        } else if (isProtocolDateStale(state.protocolDate)) {
          state.selectedDayIndex = getTodayDayIndex(state.weekStartDate);
          state.readinessScanDate = null;
          state.subjectiveReadiness = null;
        }

        const today = new Date().toISOString().slice(0, 10);
        if (state.readinessScanDate && state.readinessScanDate !== today) {
          state.readinessScanDate = null;
          state.subjectiveReadiness = null;
        }

        const expectedTraining =
          state.user_biological.training_days_per_week ?? DEFAULT_TRAINING_DAYS_PER_WEEK;
        if (state.weeklyMicrocycle) {
          state.weeklyMicrocycle = applyDamageControlToMicrocycle(
            sanitizeMicrocycleIronVolume(state.weeklyMicrocycle),
            state.damageControlActiveDates,
          );
        }

        if (
          state.weeklyMicrocycle &&
          isDegenerateMicrocycle(state.weeklyMicrocycle, expectedTraining)
        ) {
          console.warn('[SOMMA] Cleared degenerate persisted microcycle on rehydrate');
          state.weeklyMicrocycle = null;
          state.protocolDate = null;
          state.weekStartDate = null;
          state.protocolGeneratedAt = null;
          state.gameplan_source = null;
        }

        useSommaStore.setState({ _hasHydrated: true });
      },
    },
  ),
);

/** True when onboarding questionnaire has been completed (offline gate for routing). */
export function hasCompletedFoundationScan(state: {
  user_foundation: UserFoundation;
  user_environment: UserEnvironment;
  user_biological: BiologicalProfile;
}): boolean {
  return (
    state.user_foundation.foundation_completed_at !== null &&
    state.user_foundation.focus_preference !== null &&
    state.user_environment.available_equipment.length > 0 &&
    isBiologicalProfileComplete(state.user_biological)
  );
}
