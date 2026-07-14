import { describe, expect, it } from 'vitest';

import { ELITE_EXERCISES } from '@/lib/catalog/eliteCatalog';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import { calculateVolumeBudget } from '@/lib/gameplan/engine/iron/volumePeriodization';
import { initialBiologicalProfile, type UserBiological } from '@/types/biological';
import type { MicrocycleDay } from '@/types/gameplan';

const catalog = buildExerciseCatalog([...ELITE_EXERCISES]);

const mockBiological: UserBiological = {
  ...initialBiologicalProfile,
  weight_kg: 57,
  body_fat_percentage: 18,
  current_injuries: null,
  baseline_stress_level: 3,
  goal_iron: 'Hypertrophy',
  nutrition_goal: null,
  training_days_per_week: 5,
  available_time_iron: 90,
  frequency_iron: 5,
  cns_fatigue_score: 0,
  current_body_fat_estimate: 18,
  hormonal_transition: false,
  mesocycle_phase: 'bulking',
  mesocycle_week: 1,
  preferred_split: 'abcde',
};

function ironExerciseCount(day: MicrocycleDay | undefined): number {
  return day?.blocks[0]?.iron?.exercises.length ?? 0;
}

describe('Hormonal Profile Volume Budget', () => {
  it('TRT com bulking deve gerar 6-8 exercícios por dia', async () => {
    const biological: UserBiological = {
      ...mockBiological,
      mesocycle_phase: 'bulking',
      hormonal_protocol: {
        type: 'trt',
        weekly_dose_mg: 200,
        recovery_multiplier: 1.5,
      },
    };

    const gameplan = await generateDeterministicGameplan({
      focus: { iron: 100, nutrition: 100 },
      equipment: ['full_gym'],
      biological,
      userStats: {
        iron_sessions_completed: 0,
        nutrition_checkins_completed: 0,
      },
      performanceLogs: [],
      protocolDate: '2026-06-09',
    });

    const day1 = gameplan.microcycle.find((day) => day.day_index === 1);
    expect(ironExerciseCount(day1)).toBeGreaterThanOrEqual(6);
    expect(ironExerciseCount(day1)).toBeLessThanOrEqual(8);

    const day4 = gameplan.microcycle.find((day) => day.day_index === 4);
    expect(ironExerciseCount(day4)).toBeGreaterThanOrEqual(4);
    expect(ironExerciseCount(day4)).toBeLessThanOrEqual(8);
  });

  it('TRT deve permitir 6 séries em compostos', () => {
    const biological: UserBiological = {
      ...mockBiological,
      mesocycle_phase: 'bulking',
      hormonal_protocol: {
        type: 'trt',
        weekly_dose_mg: 200,
        recovery_multiplier: 1.5,
      },
    };
    const benchPress = catalog.bySlug.get('barbell_bench_press');

    expect(benchPress).toBeDefined();
    if (!benchPress) return;

    const budget = calculateVolumeBudget(benchPress, biological, true, 0);

    expect(budget.maxSets).toBe(6);
  });

  it('Natural deve limitar compostos a 4-5 séries', () => {
    const biological: UserBiological = {
      ...mockBiological,
      mesocycle_phase: 'bulking',
      hormonal_protocol: {
        type: 'natural',
        recovery_multiplier: 1.0,
      },
    };
    const benchPress = catalog.bySlug.get('barbell_bench_press');

    expect(benchPress).toBeDefined();
    if (!benchPress) return;

    const budget = calculateVolumeBudget(benchPress, biological, true, 0);

    expect(budget.maxSets).toBeLessThanOrEqual(5);
  });
});
