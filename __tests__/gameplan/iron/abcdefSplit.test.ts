import { beforeAll, describe, expect, it } from 'vitest';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { FULL_BUNDLED_EXERCISES } from '@/lib/catalog/bundledCatalog.full';
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

const bundledBySlug = new Map(FULL_BUNDLED_EXERCISES.map((exercise) => [exercise.slug, exercise]));

describe('ABCDEF Split - Validação de JSON Real', () => {
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

  it('Dia 4 (Shoulders) tem pelo menos 6 exercícios incluindo overhead + lateral + posterior', () => {
    const day4 = microcycle.find((day) => day.day_index === 4);
    expect(day4).toBeDefined();
    if (!day4) return;

    const exercises = ironExercisesForDay(day4);
    expect(exercises.length).toBeGreaterThanOrEqual(6);

    const hasOverhead = exercises.some((exercise) => exercise.slot_category === 'shoulder_overhead_press');
    const hasLateral = exercises.some((exercise) => exercise.slot_category === 'shoulder_lateral_raise');
    const hasPosterior = exercises.some((exercise) => exercise.slot_category === 'shoulder_posterior_fly');

    expect(hasOverhead).toBe(true);
    expect(hasLateral).toBe(true);
    expect(hasPosterior).toBe(true);
  });

  it('Nenhum dia de treino tem menos de 4 exercícios', () => {
    microcycle.forEach((day) => {
      if (day.is_rest_day) return;
      expect(ironExercisesForDay(day).length).toBeGreaterThanOrEqual(4);
    });
  });

  it('Não há duplicatas conceituais além das repetições planejadas no split Enhanced', () => {
    microcycle.forEach((day) => {
      if (day.is_rest_day) return;

      const categories = ironExercisesForDay(day).map((exercise) => exercise.slot_category);
      const uniqueCategories = new Set(categories);
      expect(categories.length).toBeLessThanOrEqual(uniqueCategories.size + 4);
    });
  });

  it('Bloqueia exercícios com peso corporal quando full_gym disponível', () => {
    const allExercises = microcycle.flatMap((day) =>
      day.blocks.flatMap((block) => block.iron?.exercises ?? []),
    );
    const blocked = ['pull_up', 'chin_up', 'dip', 'push_up'];

    blocked.forEach((slug) => {
      expect(allExercises.every((exercise) => exercise.slug !== slug)).toBe(true);
    });
  });

  it('Dia 7 é descanso e Dias 1-6 são todos de treino', () => {
    const restDays = microcycle.filter((day) => day.is_rest_day);

    expect(restDays).toHaveLength(1);
    expect(restDays[0]?.day_index).toBe(7);
    expect(microcycle.filter((day) => !day.is_rest_day).map((day) => day.day_index)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('Fallbacks ABCDEF respeitam constraints articulares do solver', async () => {
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
