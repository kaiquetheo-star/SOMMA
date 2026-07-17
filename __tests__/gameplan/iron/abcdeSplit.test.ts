import { beforeAll, describe, expect, it } from 'vitest';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import { ABCDE_IRON_DAY_INDICES, ABCDE_REST_DAY_INDICES } from '@/lib/gameplan/engine/iron/splits/abcdeSplit';
import { ABCDE_MEV } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import { ELITE_EXERCISES } from '@/lib/catalog/eliteCatalog';
import type { DailyGameplan, IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';
import type { UserBiological } from '@/types/biological';

const catalog = buildExerciseCatalog([...ELITE_EXERCISES]);

const userBiological: UserBiological = {
  date_of_birth: '1994-05-14',
  weight_kg: 57,
  height_cm: 158,
  body_fat_percentage: 18,
  current_injuries: null,
  baseline_stress_level: 3,
  goal_iron: 'Hypertrophy',
  nutrition_goal: null,
  training_days_per_week: 5,
  experience_level: 'advanced',
  available_time_iron: 90,
  iron_mastery: 5,
  frequency_iron: 5,
  preferred_split: 'abcde',
  clinical_exit_interview: null,
  current_body_fat_estimate: 18,
  hormonal_transition: false,
};

function ironExercisesForDay(day: MicrocycleDay | undefined): IronExercisePrescription[] {
  const iron = day?.blocks.find((block) => block.pillar === 'iron');
  return iron?.iron?.exercises ?? [];
}

function chestSetsForDay(day: MicrocycleDay | undefined): number {
  return ironExercisesForDay(day).reduce((sum, exercise) => {
    const meta = exercise.slug ? catalog.bySlug.get(exercise.slug) : undefined;
    const isChestSlot = exercise.slot_category?.startsWith('chest_') ?? false;
    const isChestPrimary =
      meta?.primary_muscle === 'chest' || meta?.primary_muscle === 'upper_chest';
    if (!isChestSlot && !isChestPrimary) return sum;
    return sum + exercise.target_sets;
  }, 0);
}

function weeklyChestSets(microcycle: DailyGameplan['microcycle']): number {
  return microcycle.reduce((weekTotal, day) => weekTotal + chestSetsForDay(day), 0);
}

describe('ABCDE Split — 5 Iron + 2 Rest', () => {
  let microcycle: DailyGameplan['microcycle'];

  beforeAll(async () => {
    const gameplan = await generateDeterministicGameplan({
      focus: { iron: 100, nutrition: 100 },
      equipment: ['full_gym'],
      biological: userBiological,
      userStats: {
        iron_sessions_completed: 0,
        nutrition_checkins_completed: 0,
      },
      performanceLogs: [],
      protocolDate: '2026-06-09',
    });

    microcycle = gameplan.microcycle;
  });

  it('Cenário A: gera 5 dias Iron + 2 Rest com blocos spirit/nutrition', () => {
    const ironDays = microcycle.filter((day) => !day.is_rest_day);
    const restDays = microcycle.filter((day) => day.is_rest_day);

    expect(ironDays).toHaveLength(5);
    expect(restDays).toHaveLength(2);
    expect(ironDays.map((day) => day.day_index)).toEqual([...ABCDE_IRON_DAY_INDICES]);
    expect(restDays.map((day) => day.day_index)).toEqual([...ABCDE_REST_DAY_INDICES]);

    restDays.forEach((day) => {
      expect(day.blocks.some((block) => block.pillar === 'spirit')).toBe(true);
      expect(day.blocks.some((block) => block.pillar === 'nutrition')).toBe(true);
    });
  });

  it('Cenário B: peito no Day 1 tem ≥14 sets totais', () => {
    const day1 = microcycle.find((day) => day.day_index === 1);
    expect(day1).toBeDefined();
    expect(chestSetsForDay(day1)).toBeGreaterThanOrEqual(14);
  });

  it('Cenário C: Day 3 e Day 7 são is_rest_day=true com bloco spirit', () => {
    for (const dayIndex of ABCDE_REST_DAY_INDICES) {
      const day = microcycle.find((entry) => entry.day_index === dayIndex);
      expect(day?.is_rest_day).toBe(true);
      expect(day?.blocks.some((block) => block.pillar === 'spirit')).toBe(true);
    }
  });

  it('Cenário D: volume semanal de peito ≥14 sets (MEV 1× respeitado)', () => {
    expect(weeklyChestSets(microcycle)).toBeGreaterThanOrEqual(ABCDE_MEV);
    expect(ABCDE_MEV).toBe(14);
  });

  it('migra preferred_split abcdef → abcde na geração', async () => {
    const gameplan = await generateDeterministicGameplan({
      focus: { iron: 100, nutrition: 100 },
      equipment: ['full_gym'],
      biological: {
        ...userBiological,
        preferred_split: 'abcdef',
        frequency_iron: 6,
        training_days_per_week: 6,
      },
      userStats: {
        iron_sessions_completed: 0,
        nutrition_checkins_completed: 0,
      },
      performanceLogs: [],
      protocolDate: '2026-06-09',
    });

    expect(gameplan.microcycle.filter((day) => !day.is_rest_day)).toHaveLength(5);
    expect(gameplan.microcycle.filter((day) => day.is_rest_day)).toHaveLength(2);
  });
});
