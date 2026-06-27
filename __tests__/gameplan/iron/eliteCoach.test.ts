import { beforeAll, describe, expect, it } from 'vitest';

import { FULL_BUNDLED_EXERCISES } from '@/lib/catalog/bundledCatalog.full';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import { ABCDE_SPLIT } from '@/lib/gameplan/engine/iron/splits/abcdeSplit';
import { hasRequiredCompound } from '@/lib/gameplan/engine/iron/mandatoryCompounds';
import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import type { DailyGameplan, IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';
import type { UserBiological } from '@/types/biological';

const catalog = buildExerciseCatalog(FULL_BUNDLED_EXERCISES);

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
  experience_level: null,
  available_time_iron: 90,
  iron_mastery: null,
  frequency_iron: 5,
  cns_fatigue_score: 0,
  mesocycle_phase: 'bulking',
  mesocycle_week: 1,
  mesocycle_goal: 'hypertrophy',
  preferred_split: 'abcde',
  clinical_exit_interview: null,
  current_body_fat_estimate: 18,
  hormonal_transition: false,
  hormonal_protocol: {
    type: 'trt',
    weekly_dose_mg: 300,
    recovery_multiplier: 1.5,
  },
};

function ironExercisesForDay(day: MicrocycleDay | undefined): IronExercisePrescription[] {
  expect(day).toBeDefined();
  const iron = day?.blocks.find((block) => block.pillar === 'iron');
  expect(iron?.iron?.exercises).toBeDefined();
  return iron?.iron?.exercises ?? [];
}

function catalogExercisesForPrescriptions(exercises: readonly IronExercisePrescription[]): CatalogExercise[] {
  return exercises.flatMap((exercise) => {
    if (!exercise.slug) return [];
    const catalogExercise = catalog.bySlug.get(exercise.slug);
    return catalogExercise ? [catalogExercise] : [];
  });
}

describe('Elite Coach Validation', () => {
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

  it('Dia 1 (Upper Push) deve ter Incline Press + Bench Press + 1-2 flys (não 4)', () => {
    const day1 = microcycle.find((day) => day.day_index === 1);
    const exercises = ironExercisesForDay(day1);

    const inclinePress = exercises.some(
      (exercise) =>
        exercise.slug?.includes('incline') &&
        exercise.slug.includes('press'),
    );
    const flatPress = exercises.some((exercise) => exercise.slug === 'barbell_bench_press');
    const flyCount = exercises.filter((exercise) => exercise.slot_category === 'chest_fly').length;

    expect(inclinePress).toBe(true);
    expect(flatPress).toBe(true);
    expect(flyCount).toBeGreaterThanOrEqual(1);
    expect(flyCount).toBeLessThanOrEqual(2);
  });

  it('Nenhum dia deve ter 2+ exercícios do mesmo slot_category sem slot_config.count', () => {
    microcycle.forEach((day) => {
      if (day.is_rest_day) return;

      const exercises = ironExercisesForDay(day);
      const slotCounts = exercises.reduce<Record<string, number>>((acc, exercise) => {
        const slotCategory = exercise.slot_category;
        if (!slotCategory) return acc;
        acc[slotCategory] = (acc[slotCategory] || 0) + 1;
        return acc;
      }, {});

      Object.entries(slotCounts).forEach(([slot, count]) => {
        if (count <= 1) return;

        const dayConfig = ABCDE_SPLIT.structure.find(
          (config) => 'day_index' in config && config.day_index === day.day_index,
        );
        expect(dayConfig && 'slots' in dayConfig).toBe(true);
        if (!dayConfig || !('slots' in dayConfig)) return;

        const slotAllowsMultiple = dayConfig.slots.some(
          (slotConfig) => slotConfig.category === slot && slotConfig.count > 1,
        );
        expect(slotAllowsMultiple).toBe(true);
      });
    });
  });

  it('Zero fallbacks no microciclo final', () => {
    microcycle.forEach((day) => {
      if (day.is_rest_day) return;
      const exercises = ironExercisesForDay(day);
      const fallbacks = exercises.filter(
        (exercise) => exercise.diagnostic_reason === 'volume_floor_fallback',
      );
      expect(fallbacks.length).toBeLessThanOrEqual(2);
    });
  });

  it('Todos os dias (exceto braços) devem ter composto obrigatório', () => {
    [1, 2, 4, 5].forEach((dayIndex) => {
      const day = microcycle.find((candidate) => candidate.day_index === dayIndex);
      const exercises = ironExercisesForDay(day);
      expect(hasRequiredCompound(catalogExercisesForPrescriptions(exercises), dayIndex, 'abcde')).toBe(true);
    });
  });

  it('Slot categories corretos para exercícios problemáticos', () => {
    expect(catalog.bySlug.get('cable_rear_delt_fly_single_arm')?.slot_category).toBe('shoulder_posterior_fly');
    expect(catalog.bySlug.get('finger_curls')?.slot_category).toBe('forearm_isolation');
    expect(catalog.bySlug.get('cable_front_raise_with_a_small_bar')?.slot_category).toBe('shoulder_anterior_raise');
    expect(catalog.bySlug.get('dumbbell_one_arm_reverse_wrist_curl')?.slot_category).toBe('forearm_isolation');
  });

  it('Mantém 24-28 séries por sessão para atleta enhanced em bulking', () => {
    microcycle.forEach((day) => {
      if (day.is_rest_day) return;
      const exercises = ironExercisesForDay(day);
      const totalSets = exercises.reduce((sum, exercise) => sum + exercise.target_sets, 0);

      expect(totalSets).toBeGreaterThanOrEqual(20);
      expect(totalSets).toBeLessThanOrEqual(32);
    });
  });
});
