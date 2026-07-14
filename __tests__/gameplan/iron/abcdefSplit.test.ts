import { beforeAll, describe, expect, it } from 'vitest';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { ELITE_EXERCISES } from '@/lib/catalog/eliteCatalog';
import type { DailyGameplan, IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';
import type { UserBiological } from '@/types/biological';

const userBiological: UserBiological = {
  date_of_birth: '1994-05-14',
  weight_kg: 57,
  height_cm: 158,
  body_fat_percentage: 18,
  current_injuries: null,
  baseline_stress_level: 3,
  goal_iron: 'Hypertrophy',
  nutrition_goal: null,
  training_days_per_week: 6,
  experience_level: null,
  available_time_iron: 90,
  iron_mastery: null,
  frequency_iron: 6,
  cns_fatigue_score: 0,
  clinical_exit_interview: null,
  current_body_fat_estimate: 18,
  hormonal_transition: false,
  preferred_split: 'abcdef',
};

function ironExercisesForDay(day: MicrocycleDay): IronExercisePrescription[] {
  const iron = day.blocks.find((block) => block.pillar === 'iron');
  expect(iron?.iron?.exercises).toBeDefined();
  return iron?.iron?.exercises ?? [];
}

const fallbackReasons = new Set([
  'volume_floor_fallback',
  'minimum_viable_path_absolute_last_resort',
]);

const bundledBySlug = new Map(ELITE_EXERCISES.map((exercise) => [exercise.slug, exercise]));

describe('Legacy ABCDEF input — migrates to ABCDE on generation', () => {
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

  it('migra para 5 dias Iron + 2 Rest (Wed + Sun)', () => {
    const restDays = microcycle.filter((day) => day.is_rest_day);

    expect(restDays).toHaveLength(2);
    expect(restDays.map((day) => day.day_index)).toEqual([3, 7]);
    expect(microcycle.filter((day) => !day.is_rest_day).map((day) => day.day_index)).toEqual([
      1, 2, 4, 5, 6,
    ]);
  });

  it('Nenhum dia de treino tem menos de 4 exercícios', () => {
    microcycle.forEach((day) => {
      if (day.is_rest_day) return;
      expect(ironExercisesForDay(day).length).toBeGreaterThanOrEqual(4);
    });
  });

  it('Fallbacks respeitam constraints articulares do solver', async () => {
    const gameplan = await generateDeterministicGameplan({
      focus: { iron: 100, nutrition: 100 },
      equipment: ['full_gym'],
      biological: {
        ...userBiological,
        current_injuries: 'shoulder impingement and rotator cuff irritation',
      },
      userStats: {
        iron_sessions_completed: 0,
        nutrition_checkins_completed: 0,
      },
      performanceLogs: [],
      protocolDate: '2026-06-09',
    });

    const selectedExercises = gameplan.microcycle
      .flatMap((day) => day.blocks.flatMap((block) => block.iron?.exercises ?? []))
      .filter((exercise) => !exercise.diagnostic_reason || fallbackReasons.has(exercise.diagnostic_reason));

    expect(selectedExercises.length).toBeGreaterThan(0);

    selectedExercises.forEach((exercise) => {
      const catalogRow = exercise.slug ? bundledBySlug.get(exercise.slug) : undefined;
      expect(catalogRow?.joint_stress_profile).not.toBe('rotator_cuff_heavy');
      expect(catalogRow?.joint_stress_profile).not.toBe('shoulder_impingement_risk');
    });
  });
});
