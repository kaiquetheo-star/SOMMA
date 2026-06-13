import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'web',
    select: <T,>(values: { web?: T; default?: T }) => values.web ?? values.default,
  },
}));

vi.mock('@/lib/gameplan/fetchDailyGameplan', () => ({
  fetchDailyGameplan: vi.fn(),
}));

vi.mock('@/lib/catalog/library', () => ({
  fetchLibraryExercises: vi.fn(async () => []),
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

let useSommaStore: typeof import('@/store/useSommaStore').useSommaStore;

describe('performance logging store', () => {
  beforeAll(async () => {
    vi.stubGlobal('__DEV__', false);
    ({ useSommaStore } = await import('@/store/useSommaStore'));
  });

  beforeEach(() => {
    useSommaStore.setState({
      performance_logs: [],
      performanceQueue: [],
      pendingSession: null,
      performance_syncing: false,
      weeklyMicrocycle: null,
    });
  });

  it('commits one idempotent Iron session log per completed workout', async () => {
    const baseSet = {
      set_index: 1,
      weight_kg: 80,
      reps: 8,
      target_reps: 8,
      target_rir: 2,
      reported_rir: 2,
      rest_seconds_used: 90,
      logged_at: '2026-06-13T15:00:00.000Z',
    };

    useSommaStore.getState().logIronSet({
      block_id: 'block-iron-a',
      exercise_id: 'exercise-bench',
      exercise_slug: 'barbell_bench_press',
      exercise_name: 'Barbell Bench Press',
      set: baseSet,
      target_rir: 2,
    });
    useSommaStore.getState().logIronSet({
      block_id: 'block-iron-a',
      exercise_id: 'exercise-bench',
      exercise_slug: 'barbell_bench_press',
      exercise_name: 'Barbell Bench Press',
      set: {
        ...baseSet,
        reps: 9,
        logged_at: '2026-06-13T15:01:00.000Z',
      },
      target_rir: 2,
    });

    expect(useSommaStore.getState().performance_logs).toHaveLength(0);
    expect(useSommaStore.getState().pendingSession?.exercises[0]?.sets).toHaveLength(1);

    await useSommaStore.getState().completeWorkout({
      block_id: 'block-iron-a',
      pillar: 'iron',
      exercise_id: 'exercise-bench',
      reps_completed: 9,
      weight_used: 80,
      actual_rest_seconds: 90,
    });

    const stateAfterCommit = useSommaStore.getState();
    expect(stateAfterCommit.pendingSession).toBeNull();
    expect(stateAfterCommit.performance_logs).toHaveLength(1);
    expect(stateAfterCommit.performanceQueue).toHaveLength(1);
    const committedLog = stateAfterCommit.performance_logs[0];
    expect(committedLog?.type).toBe('session');
    if (!committedLog?.data) throw new Error('Expected committed session data');
    expect(committedLog.data.exercises[0]?.sets).toHaveLength(1);
    expect(committedLog.data.exercises[0]?.sets[0]?.reps).toBe(9);

    await useSommaStore.getState().completeWorkout({
      block_id: 'block-iron-a',
      pillar: 'iron',
      exercise_id: 'exercise-bench',
    });

    const stateAfterDuplicateCompletion = useSommaStore.getState();
    expect(stateAfterDuplicateCompletion.performance_logs).toHaveLength(1);
    expect(stateAfterDuplicateCompletion.performanceQueue).toHaveLength(1);
  });
});
