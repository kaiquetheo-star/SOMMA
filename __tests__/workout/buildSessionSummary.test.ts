import { describe, it, expect } from 'vitest';
import {
  computeTotalVolumeKg,
  computeCnsFatigueTotal,
  detectE1rmUnlocks,
} from '@/lib/workout/buildSessionSummary';
import type { PerformanceLogEntry } from '@/types/performance';
import type { LibraryExercise } from '@/lib/catalog/library';

function makeIronLog(overrides: Partial<PerformanceLogEntry> & {
  exercise_id?: string;
  exercise_name?: string;
  sets?: { weight_kg: number; reps: number }[];
} = {}): PerformanceLogEntry {
  const { exercise_id = 'bench-press', exercise_name = 'Bench Press', sets = [], ...rest } = overrides;
  return {
    id: `log-${Math.random().toString(36).slice(2)}`,
    pillar: 'iron',
    block_id: 'block-1',
    timestamp: new Date().toISOString(),
    iron: {
      block_id: 'block-1',
      exercise_id,
      exercise_name,
      completed_at: new Date().toISOString(),
      sets: sets.map((s, i) => ({
        set_index: i + 1,
        weight_kg: s.weight_kg,
        reps: s.reps,
        target_reps: s.reps,
        rest_seconds_used: 90,
        logged_at: new Date().toISOString(),
      })),
    },
    ...rest,
  };
}

describe('computeTotalVolumeKg', () => {
  it('returns 0 for empty logs', () => {
    expect(computeTotalVolumeKg([])).toBe(0);
  });

  it('sums weight × reps across all sets', () => {
    const logs = [
      makeIronLog({ sets: [{ weight_kg: 100, reps: 5 }, { weight_kg: 100, reps: 5 }] }),
      makeIronLog({ exercise_id: 'squat', sets: [{ weight_kg: 80, reps: 8 }] }),
    ];
    // (100×5 + 100×5) + (80×8) = 500 + 500 + 640 = 1640
    expect(computeTotalVolumeKg(logs)).toBe(1640);
  });

  it('skips sets with zero weight or reps', () => {
    const logs = [
      makeIronLog({ sets: [{ weight_kg: 0, reps: 10 }, { weight_kg: 50, reps: 0 }, { weight_kg: 60, reps: 8 }] }),
    ];
    expect(computeTotalVolumeKg(logs)).toBe(480); // only 60×8
  });

  it('ignores non-iron pillar logs', () => {
    const logs: PerformanceLogEntry[] = [
      { id: 'n1', pillar: 'nutrition', block_id: 'b', timestamp: new Date().toISOString() },
    ];
    expect(computeTotalVolumeKg(logs)).toBe(0);
  });
});

describe('computeCnsFatigueTotal', () => {
  const catalog: LibraryExercise[] = [
    { id: 'bench-press', cns_fatigue_cost: 7 } as LibraryExercise,
    { id: 'bicep-curl', cns_fatigue_cost: 2 } as LibraryExercise,
  ];

  it('returns 0 for empty logs', () => {
    expect(computeCnsFatigueTotal([], catalog)).toBe(0);
  });

  it('multiplies CNS cost by number of sets per exercise', () => {
    const logs = [
      makeIronLog({ exercise_id: 'bench-press', sets: [{ weight_kg: 80, reps: 8 }, { weight_kg: 80, reps: 8 }, { weight_kg: 80, reps: 8 }] }),
    ];
    // 7 CNS × 3 sets = 21
    expect(computeCnsFatigueTotal(logs, catalog)).toBe(21);
  });

  it('defaults to CNS cost of 3 when exercise not in catalog', () => {
    const logs = [
      makeIronLog({ exercise_id: 'unknown-exercise', sets: [{ weight_kg: 50, reps: 10 }, { weight_kg: 50, reps: 10 }] }),
    ];
    // 3 default × 2 sets = 6
    expect(computeCnsFatigueTotal(logs, catalog)).toBe(6);
  });

  it('sums across multiple exercises', () => {
    const logs = [
      makeIronLog({ exercise_id: 'bench-press', sets: [{ weight_kg: 80, reps: 8 }] }),
      makeIronLog({ exercise_id: 'bicep-curl', sets: [{ weight_kg: 15, reps: 12 }, { weight_kg: 15, reps: 12 }] }),
    ];
    // 7×1 + 2×2 = 11
    expect(computeCnsFatigueTotal(logs, catalog)).toBe(11);
  });
});

describe('detectE1rmUnlocks', () => {
  it('returns empty array when no logs exist', () => {
    expect(detectE1rmUnlocks([], [])).toEqual([]);
  });

  it('detects a new E1RM when no prior history exists', () => {
    const todayLogs = [
      makeIronLog({
        exercise_id: 'bench-press',
        exercise_name: 'Bench Press',
        sets: [{ weight_kg: 100, reps: 5 }],
        timestamp: new Date().toISOString(),
      }),
    ];
    const unlocks = detectE1rmUnlocks(todayLogs, []);
    expect(unlocks).toHaveLength(1);
    expect(unlocks[0].exercise_id).toBe('bench-press');
    expect(unlocks[0].e1rm_kg).toBeGreaterThan(0);
    expect(unlocks[0].previous_best_kg).toBeNull();
  });

  it('detects an E1RM improvement over prior best', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const priorLogs = [
      makeIronLog({
        exercise_id: 'bench-press',
        exercise_name: 'Bench Press',
        sets: [{ weight_kg: 80, reps: 5 }],
        timestamp: yesterday.toISOString(),
      }),
    ];

    const todayLogs = [
      makeIronLog({
        exercise_id: 'bench-press',
        exercise_name: 'Bench Press',
        sets: [{ weight_kg: 90, reps: 5 }],
        timestamp: new Date().toISOString(),
      }),
    ];

    const allLogs = [...priorLogs, ...todayLogs];
    const unlocks = detectE1rmUnlocks(todayLogs, allLogs);
    expect(unlocks).toHaveLength(1);
    expect(unlocks[0].e1rm_kg).toBeGreaterThan(unlocks[0].previous_best_kg!);
  });

  it('does not report unlock when today is not better than prior', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const priorLogs = [
      makeIronLog({
        exercise_id: 'squat',
        exercise_name: 'Squat',
        sets: [{ weight_kg: 120, reps: 5 }],
        timestamp: yesterday.toISOString(),
      }),
    ];

    const todayLogs = [
      makeIronLog({
        exercise_id: 'squat',
        exercise_name: 'Squat',
        sets: [{ weight_kg: 100, reps: 5 }], // weaker today
        timestamp: new Date().toISOString(),
      }),
    ];

    const allLogs = [...priorLogs, ...todayLogs];
    const unlocks = detectE1rmUnlocks(todayLogs, allLogs);
    expect(unlocks).toHaveLength(0);
  });

  it('deduplicates by exercise_id', () => {
    const todayLogs = [
      makeIronLog({
        exercise_id: 'bench-press',
        exercise_name: 'Bench Press',
        sets: [{ weight_kg: 80, reps: 8 }],
        timestamp: new Date().toISOString(),
      }),
      makeIronLog({
        exercise_id: 'bench-press',
        exercise_name: 'Bench Press',
        sets: [{ weight_kg: 85, reps: 6 }],
        timestamp: new Date().toISOString(),
      }),
    ];

    const unlocks = detectE1rmUnlocks(todayLogs, []);
    // Should only have one entry for bench-press
    expect(unlocks.filter((u) => u.exercise_id === 'bench-press')).toHaveLength(1);
  });
});
