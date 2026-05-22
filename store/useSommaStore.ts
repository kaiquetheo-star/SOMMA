import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isSupabaseConfigured } from '@/lib/config';
import { fetchDailyGameplan } from '@/lib/gameplan/fetchDailyGameplan';
import { generateStubGameplan, isGameplanStale } from '@/lib/gameplan/generateStubGameplan';
import { syncPerformanceQueueAndRecalibrate } from '@/lib/supabase/performance';
import { getSupabase } from '@/lib/supabase/client';
import type { BiologicalProfile } from '@/types/biological';
import { initialBiologicalProfile, isBiologicalProfileComplete } from '@/types/biological';
import type { DailyGameplan, GameplanBlockStatus } from '@/types/gameplan';
import type {
  CombatSessionLog,
  IronSessionLog,
  PerformanceLogEntry,
  PerformanceQueueItem,
  SpiritSessionLog,
  WorkoutCompletionInput,
} from '@/types/performance';

export type { WorkoutCompletionInput, PerformanceQueueItem } from '@/types/performance';

/** Equipment tags aligned with SRS REQ-1.3 / `user_environment` schema */
export type EquipmentTag =
  | 'bodyweight'
  | 'dumbbells'
  | 'heavy_bag'
  | 'barbell'
  | 'kettlebell'
  | 'pull_up_bar'
  | 'full_gym';

export type PillarId = 'iron' | 'combat' | 'flow' | 'spirit' | 'balanced';

/** Pillar ratio distribution (percentages, sum = 100) — maps to `profiles.focus_preference` */
export interface FocusPreference {
  iron: number;
  combat: number;
  flow: number;
  spirit: number;
}

export interface UserEnvironment {
  available_equipment: EquipmentTag[];
  updated_at: string | null;
}

export interface UserStats {
  body_essence: number;
  mind_essence: number;
  spirit_essence: number;
  combat_mastery: number;
}

export interface UserFoundation {
  focus_preference: FocusPreference | null;
  foundation_completed_at: string | null;
}

function applyGameplanToState(gameplan: DailyGameplan, source: SommaState['gameplan_source']) {
  return {
    currentGameplan: gameplan,
    daily_gameplan: gameplan,
    gameplan_source: source,
  };
}

interface SommaState {
  user_environment: UserEnvironment;
  user_stats: UserStats;
  user_foundation: UserFoundation;
  user_biological: BiologicalProfile;
  /** Today's AI protocol — primary read surface for Daily Command */
  currentGameplan: DailyGameplan | null;
  /** @deprecated alias — kept in sync with currentGameplan */
  daily_gameplan: DailyGameplan | null;
  performance_logs: PerformanceLogEntry[];
  performanceQueue: PerformanceQueueItem[];
  performance_syncing: boolean;
  setUserEnvironment: (patch: Partial<UserEnvironment>) => void;
  setUserStats: (patch: Partial<UserStats>) => void;
  setUserFoundation: (patch: Partial<UserFoundation>) => void;
  setUserBiological: (patch: Partial<BiologicalProfile>) => void;
  setCurrentGameplan: (gameplan: DailyGameplan | null, source?: SommaState['gameplan_source']) => void;
  gameplan_loading: boolean;
  gameplan_source: 'ai' | 'fallback' | 'stub' | 'deterministic' | null;
  ensureDailyGameplan: () => void;
  fetchDailyGameplanAsync: (options?: { forceRefresh?: boolean }) => Promise<void>;
  regenerateDailyGameplan: () => Promise<void>;
  setBlockStatus: (blockId: string, status: GameplanBlockStatus) => void;
  completeBlock: (blockId: string) => void;
  appendIronSession: (log: IronSessionLog) => void;
  appendCombatSession: (log: CombatSessionLog) => void;
  appendSpiritSession: (log: SpiritSessionLog) => void;
  completeWorkout: (input: WorkoutCompletionInput) => Promise<void>;
  flushPerformanceQueue: () => Promise<void>;
  completeFoundationScan: (payload: {
    focus_preference: FocusPreference;
    available_equipment: EquipmentTag[];
    biological: BiologicalProfile;
  }) => void;
  /** Clears all local SOMMA state and persisted offline cache */
  resetStore: () => Promise<void>;
  /** @deprecated Use resetStore */
  resetSommaState: () => void;
}

const initialEnvironment: UserEnvironment = {
  available_equipment: [],
  updated_at: null,
};

const initialStats: UserStats = {
  body_essence: 0,
  mind_essence: 0,
  spirit_essence: 0,
  combat_mastery: 0,
};

const initialFoundation: UserFoundation = {
  focus_preference: null,
  foundation_completed_at: null,
};

function findSessionForBlock(
  logs: PerformanceLogEntry[],
  blockId: string,
): PerformanceLogEntry | null {
  return logs.find((entry) => entry.block_id === blockId) ?? null;
}

export const useSommaStore = create<SommaState>()(
  persist(
    (set, get) => ({
      user_environment: initialEnvironment,
      user_stats: initialStats,
      user_foundation: initialFoundation,
      user_biological: { ...initialBiologicalProfile },
      currentGameplan: null,
      daily_gameplan: null,
      performance_logs: [],
      performanceQueue: [],
      performance_syncing: false,
      gameplan_loading: false,
      gameplan_source: null,

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
        set((state) => ({
          user_biological: { ...state.user_biological, ...patch },
        })),

      setCurrentGameplan: (gameplan, source) =>
        set((state) => ({
          currentGameplan: gameplan,
          daily_gameplan: gameplan,
          gameplan_source: source ?? state.gameplan_source,
        })),

      ensureDailyGameplan: () =>
        set((state) => {
          const focus = state.user_foundation.focus_preference;
          if (!focus) return state;

          const active = state.currentGameplan ?? state.daily_gameplan;
          if (!isGameplanStale(active)) {
            return state;
          }

          const gameplan = generateStubGameplan(focus, state.user_environment.available_equipment);
          return {
            ...applyGameplanToState(gameplan, 'stub'),
          };
        }),

      fetchDailyGameplanAsync: async (options) => {
        const state = get();
        const focus = state.user_foundation.focus_preference;
        if (!focus) return;

        set({ gameplan_loading: true });

        try {
          const userId = (await getSupabase()?.auth.getSession())?.data.session?.user?.id ?? null;
          const gameplan = await fetchDailyGameplan({
            focus,
            equipment: state.user_environment.available_equipment,
            userId,
            forceRefresh: options?.forceRefresh ?? false,
          });

          const source: SommaState['gameplan_source'] =
            isSupabaseConfigured && userId ? 'ai' : 'stub';

          set({
            ...applyGameplanToState(gameplan, source),
            gameplan_loading: false,
          });
        } catch {
          const gameplan = generateStubGameplan(
            focus,
            state.user_environment.available_equipment,
          );
          set({
            ...applyGameplanToState(gameplan, 'fallback'),
            gameplan_loading: false,
          });
        }
      },

      regenerateDailyGameplan: async () => {
        await get().fetchDailyGameplanAsync({ forceRefresh: true });
      },

      setBlockStatus: (blockId, status) =>
        set((state) => {
          const plan = state.currentGameplan ?? state.daily_gameplan;
          if (!plan) return state;

          const next = {
            ...plan,
            blocks: plan.blocks.map((block) =>
              block.id === blockId ? { ...block, status } : block,
            ),
          };

          return applyGameplanToState(next, state.gameplan_source);
        }),

      completeBlock: (blockId) =>
        set((state) => {
          const plan = state.currentGameplan ?? state.daily_gameplan;
          if (!plan) return state;

          const next = {
            ...plan,
            blocks: plan.blocks.map((block) =>
              block.id === blockId ? { ...block, status: 'completed' as const } : block,
            ),
          };

          return applyGameplanToState(next, state.gameplan_source);
        }),

      appendIronSession: (log) =>
        set((state) => ({
          performance_logs: [
            {
              id: `iron-${log.block_id}-${Date.now()}`,
              pillar: 'iron',
              block_id: log.block_id,
              iron: log,
              timestamp: log.completed_at,
            },
            ...state.performance_logs,
          ],
        })),

      appendCombatSession: (log) =>
        set((state) => ({
          performance_logs: [
            {
              id: `combat-${log.block_id}-${Date.now()}`,
              pillar: 'combat',
              block_id: log.block_id,
              combat: log,
              timestamp: log.completed_at,
            },
            ...state.performance_logs,
          ],
        })),

      appendSpiritSession: (log) =>
        set((state) => ({
          performance_logs: [
            {
              id: `spirit-${log.block_id}-${Date.now()}`,
              pillar: 'spirit',
              block_id: log.block_id,
              spirit: log,
              timestamp: log.completed_at,
            },
            ...state.performance_logs,
          ],
        })),

      flushPerformanceQueue: async () => {
        const state = get();
        if (state.performanceQueue.length === 0) return;

        const focus = state.user_foundation.focus_preference;
        if (!focus) return;

        set({ performance_syncing: true });

        try {
          const result = await syncPerformanceQueueAndRecalibrate(state.performanceQueue, {
            focus,
            equipment: state.user_environment.available_equipment,
          });

          if (result.insertedCount > 0) {
            const previous = get().currentGameplan ?? get().daily_gameplan;
            const patch: Partial<SommaState> = { performanceQueue: [] };

            if (result.gameplan) {
              const mergedBlocks = result.gameplan.blocks.map((block) => {
                const wasCompleted =
                  previous?.blocks.find((prev) => prev.id === block.id)?.status === 'completed';
                return wasCompleted ? { ...block, status: 'completed' as const } : block;
              });

              Object.assign(patch, applyGameplanToState(
                { ...result.gameplan, blocks: mergedBlocks },
                result.source ?? 'ai',
              ));
            }

            set(patch);
          }
        } catch (err) {
          console.warn('[SOMMA] flushPerformanceQueue failed:', err);
        } finally {
          set({ performance_syncing: false });
        }
      },

      completeWorkout: async (input) => {
        const state = get();
        const session = findSessionForBlock(state.performance_logs, input.block_id);

        const queueItem: PerformanceQueueItem = {
          id: `queue-${input.block_id}-${Date.now()}`,
          input,
          session,
          created_at: new Date().toISOString(),
        };

        set({
          performanceQueue: [...state.performanceQueue, queueItem],
          performance_syncing: true,
        });

        const focus = state.user_foundation.focus_preference;
        const equipment = state.user_environment.available_equipment;

        try {
          if (focus) {
            const result = await syncPerformanceQueueAndRecalibrate([queueItem], {
              focus,
              equipment,
            });

            if (result.gameplan) {
              const previous = get().currentGameplan ?? get().daily_gameplan;
              const mergedBlocks = result.gameplan.blocks.map((block) => {
                const wasCompleted =
                  previous?.blocks.find((prev) => prev.id === block.id)?.status === 'completed';
                return wasCompleted ? { ...block, status: 'completed' as const } : block;
              });

              set({
                ...applyGameplanToState(
                  { ...result.gameplan, blocks: mergedBlocks },
                  result.source ?? 'ai',
                ),
                performanceQueue: get().performanceQueue.filter((item) => item.id !== queueItem.id),
              });
              return;
            }
          }
        } catch (err) {
          console.warn('[SOMMA] Performance sync failed:', err);
        } finally {
          set({ performance_syncing: false });
        }
      },

      completeFoundationScan: ({ focus_preference, available_equipment, biological }) => {
        const gameplan = generateStubGameplan(focus_preference, available_equipment);
        set({
          user_foundation: {
            focus_preference,
            foundation_completed_at: new Date().toISOString(),
          },
          user_biological: { ...biological },
          user_environment: {
            available_equipment,
            updated_at: new Date().toISOString(),
          },
          user_stats: {
            body_essence: focus_preference.iron,
            mind_essence: focus_preference.flow,
            spirit_essence: focus_preference.spirit,
            combat_mastery: focus_preference.combat,
          },
          ...applyGameplanToState(gameplan, 'stub'),
        });
      },

      resetStore: async () => {
        set({
          user_environment: { ...initialEnvironment },
          user_stats: { ...initialStats },
          user_foundation: { ...initialFoundation },
          user_biological: { ...initialBiologicalProfile },
          currentGameplan: null,
          daily_gameplan: null,
          performance_logs: [],
          performanceQueue: [],
          performance_syncing: false,
          gameplan_loading: false,
          gameplan_source: null,
        });

        try {
          await useSommaStore.persist.clearStorage();
        } catch {
          // Storage may be unavailable on some web/private modes
        }
      },

      resetSommaState: () => {
        void useSommaStore.getState().resetStore();
      },
    }),
    {
      name: 'somma-offline-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user_environment: state.user_environment,
        user_stats: state.user_stats,
        user_foundation: state.user_foundation,
        user_biological: state.user_biological,
        currentGameplan: state.currentGameplan,
        daily_gameplan: state.daily_gameplan,
        performance_logs: state.performance_logs,
        performanceQueue: state.performanceQueue,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.user_biological) {
          state.user_biological = { ...initialBiologicalProfile };
        }
        if (!state.currentGameplan && state.daily_gameplan) {
          state.currentGameplan = state.daily_gameplan;
        }
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
