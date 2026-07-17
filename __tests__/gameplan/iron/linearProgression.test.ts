import { describe, expect, it } from 'vitest';

import { ELITE_EXERCISES } from '@/lib/catalog/eliteCatalog';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import {
  applyDoubleProgression,
  mapToIronPrescription,
} from '@/lib/gameplan/engine/iron/loadPrescriptionMapper';
import { resolveVolumeLimitsForSplit } from '@/lib/gameplan/engine/iron/volumeMatrix';
import { createWeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import { initialBiologicalProfile, type UserBiological } from '@/types/biological';

const catalog = buildExerciseCatalog([...ELITE_EXERCISES]);

const baseBiological: UserBiological = {
  ...initialBiologicalProfile,
  weight_kg: 80,
  body_fat_percentage: 15,
  goal_iron: 'Hypertrophy',
  training_days_per_week: 5,
  frequency_iron: 5,
  preferred_split: 'abcde',
  mesocycle_phase: 'bulking',
  mesocycle_week: 2,
};

function ironLogWithSets(
  slug: string,
  sets: { weight_kg: number; reps: number }[],
  timestamp: string,
): EnginePerformanceRow {
  const exercise = catalog.bySlug.get(slug);
  if (!exercise) throw new Error(`missing slug ${slug}`);
  return {
    pillar: 'iron',
    exercise_id: exercise.id,
    weight_used: sets[0]?.weight_kg ?? 0,
    reps_completed: sets[0]?.reps ?? 0,
    rpe_score: 8,
    timestamp,
    payload: {
      iron: {
        exercise_id: exercise.id,
        exercise_slug: slug,
        sets: sets.map((set) => ({
          weight_kg: set.weight_kg,
          reps: set.reps,
          reported_rir: 2,
        })),
      },
    },
  };
}

describe('linear progression motor (post-lobotomy)', () => {
  it('Scenario A: TRT raises MRV_SOFT and MRV_HARD vs natural', () => {
    const natural = resolveVolumeLimitsForSplit('abcde');
    const trt = resolveVolumeLimitsForSplit('abcde', {
      hormonal_protocol: { type: 'trt', weekly_dose_mg: 200, recovery_multiplier: 1.5 },
    });

    expect(trt.mrvSoft).toBe(26);
    expect(trt.mrvHard).toBe(30);
    expect(trt.mrvSoft).toBeGreaterThan(natural.mrvSoft);
    expect(trt.mrvHard).toBeGreaterThan(natural.mrvHard);
  });

  it('Scenario B: 20 effective sets yesterday do not enter recovery mode', () => {
    const bench = catalog.bySlug.get('barbell_bench_press');
    expect(bench).toBeDefined();

    const logs = Array.from({ length: 20 }, (_, index) =>
      ironLogWithSets(
        'barbell_bench_press',
        [{ weight_kg: 80, reps: 8 }],
        `2026-06-15T${String(8 + (index % 10)).padStart(2, '0')}:00:00.000Z`,
      ),
    );

    const tracker = createWeeklyVolumeTracker(catalog, logs, logs, baseBiological);
    expect(tracker.completedSetsForMuscle('chest')).toBeGreaterThan(0);
    expect(tracker.snapshot.mrvSoft).toBe(22);
  });

  it('Scenario C: double progression adds 2.5% after 4×8 @ 80kg', () => {
    const exercise = catalog.bySlug.get('barbell_bench_press');
    expect(exercise).toBeDefined();
    if (!exercise) return;

    const logs: EnginePerformanceRow[] = [
      ironLogWithSets(
        'barbell_bench_press',
        [
          { weight_kg: 80, reps: 8 },
          { weight_kg: 80, reps: 8 },
          { weight_kg: 80, reps: 8 },
          { weight_kg: 80, reps: 8 },
        ],
        '2026-06-14T18:00:00.000Z',
      ),
    ];

    const prescription = mapToIronPrescription(
      {
        slotId: 'chest_compound_a',
        exerciseId: exercise.id,
        prescribedSets: 4,
        score: 1,
        targetRepRange: '6-8',
        targetRIR: 2,
      },
      exercise,
      null,
      logs,
      'Hypertrophy',
      null,
    );

    expect(prescription.target_weight_kg).toBe(82);
    expect(prescription.target_sets).toBe(4);

    const holdReps = applyDoubleProgression({
      weightKg: 80,
      bestSetReps: 7,
      targetRepsTop: 8,
    });
    expect(holdReps.weight).toBe(80);
    expect(holdReps.note).toMatch(/add reps/i);
  });

  it('Scenario D: generates full gameplan without readiness scan', async () => {
    const gameplan = await generateDeterministicGameplan({
      focus: { iron: 100, nutrition: 100 },
      equipment: ['full_gym'],
      biological: baseBiological,
      userStats: { iron_sessions_completed: 0, nutrition_checkins_completed: 0 },
      performanceLogs: [],
      protocolDate: '2026-06-16',
    });

    const trainingDays = gameplan.microcycle.filter((day) => !day.is_rest_day);
    expect(trainingDays.length).toBeGreaterThan(0);
    for (const day of trainingDays) {
      const iron = day.blocks.find((block) => block.pillar === 'iron')?.iron?.exercises ?? [];
      expect(iron.length).toBeGreaterThanOrEqual(2);
      expect(iron.every((ex) => ex.target_sets >= 2)).toBe(true);
    }
  });
});
