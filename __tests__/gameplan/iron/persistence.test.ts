import { describe, expect, it } from 'vitest';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import { mapToIronPrescription } from '@/lib/gameplan/engine/iron/loadPrescriptionMapper';
import { lastLoggedWeightFromPerformanceHistory } from '@/lib/iron/lastLoggedWeight';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import type { PerformanceLogEntry } from '@/types/performance';
import type { LibraryExercise } from '@/types/catalog';

function mockInclineBench(partial: Partial<LibraryExercise> = {}): LibraryExercise {
  return {
    id: 'new-uuid-incline-bench',
    slug: 'barbell_incline_bench_press',
    name: 'Barbell Incline Bench Press',
    biomechanical_instructions: {},
    equipment_required: ['barbell', 'full_gym'],
    default_sets: 4,
    default_reps: 8,
    movement_pattern: 'push',
    primary_muscle: 'upper_chest',
    synergist_muscles: ['front_delts', 'triceps'],
    cns_fatigue_cost: 4,
    joint_stress_profile: 'low_impact',
    stretch_mediated_hypertrophy: false,
    ...partial,
  };
}

describe('Iron persistence — weight recovery from local store', () => {
  it('mapToIronPrescription returns ≥ last logged weight when UUID changed but slug matches', () => {
    const catalog = buildExerciseCatalog([mockInclineBench()]);
    const exercise = catalog.bySlug.get('barbell_incline_bench_press')!;

    const logs21d: EnginePerformanceRow[] = [
      {
        pillar: 'iron',
        exercise_id: 'old-uuid-incline-bench',
        weight_used: 40,
        reps_completed: 8,
        rpe_score: 7,
        timestamp: '2026-06-20T18:00:00.000Z',
        payload: {
          iron: {
            exercise_id: 'old-uuid-incline-bench',
            exercise_slug: 'barbell_incline_bench_press',
            sets: [{ weight_kg: 40, reps: 8, reported_rir: 2, target_rir: 2 }],
          },
        },
      },
    ];

    const prescription = mapToIronPrescription(
      {
        slotId: 'incline_press',
        exerciseId: exercise.id,
        prescribedSets: 4,
        score: 1,
        diagnostic_reason: 'test',
        intensity_technique: 'standard',
      },
      exercise,
      null,
      logs21d,
      'Hypertrophy',
      null,
    );

    expect(prescription.target_weight_kg).not.toBeNull();
    expect(prescription.target_weight_kg!).toBeGreaterThanOrEqual(40);
    expect(prescription.progression_note).toMatch(/Last logged|Best working set|RPE/i);
  });

  it('never returns null when store has a 40kg log for t_bar_row by slug', () => {
    const catalog = buildExerciseCatalog([
      mockInclineBench({
        id: 'new-uuid-t-bar-row',
        slug: 't_bar_row',
        name: 'T-Bar Row',
        movement_pattern: 'pull',
        primary_muscle: 'lats',
        synergist_muscles: ['biceps', 'rear_delts'],
      }),
    ]);
    const exercise = catalog.bySlug.get('t_bar_row')!;

    const performanceLogs: PerformanceLogEntry[] = [
      {
        id: 'session-tbar',
        type: 'session',
        pillar: 'iron',
        block_id: 'block-d2-iron',
        timestamp: '2026-06-21T18:00:00.000Z',
        data: {
          sessionId: 'session-tbar',
          blockId: 'block-d2-iron',
          completedAt: '2026-06-21T18:00:00.000Z',
          exercises: [
            {
              exerciseId: 'legacy-uuid-t-bar-row',
              exerciseSlug: 't_bar_row',
              exerciseName: 'T-Bar Row',
              completedAt: '2026-06-21T18:00:00.000Z',
              sets: [
                {
                  setIndex: 1,
                  weightKg: 45,
                  reps: 10,
                  rir: 2,
                  restSecondsUsed: 90,
                  loggedAt: '2026-06-21T18:00:00.000Z',
                  targetReps: 10,
                  targetRir: 2,
                },
              ],
            },
          ],
        },
      },
    ];

    const uiWeight = lastLoggedWeightFromPerformanceHistory(
      exercise.id,
      performanceLogs,
      null,
      'block-d2-iron',
      exercise.slug,
    );
    expect(uiWeight).toBe(45);

    const logs21d: EnginePerformanceRow[] = [
      {
        pillar: 'iron',
        exercise_id: 'legacy-uuid-t-bar-row',
        weight_used: 45,
        reps_completed: 10,
        rpe_score: 8,
        timestamp: '2026-06-21T18:00:00.000Z',
        payload: {
          iron: {
            exercise_id: 'legacy-uuid-t-bar-row',
            exercise_slug: 't_bar_row',
            sets: [{ weight_kg: 45, reps: 10, reported_rir: 2, target_rir: 2 }],
          },
        },
      },
    ];

    const prescription = mapToIronPrescription(
      {
        slotId: 'row_main',
        exerciseId: exercise.id,
        prescribedSets: 4,
        score: 1,
        diagnostic_reason: 'test',
        intensity_technique: 'standard',
      },
      exercise,
      null,
      logs21d,
      'Hypertrophy',
      null,
    );

    expect(prescription.target_weight_kg).not.toBeNull();
    expect(prescription.target_weight_kg!).toBeGreaterThanOrEqual(45);
  });
});
