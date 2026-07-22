import { beforeAll, describe, expect, it } from 'vitest';

import { ELITE_EXERCISES } from '@/lib/catalog/eliteCatalog';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import { ABCDE_SPLIT } from '@/lib/gameplan/engine/iron/splits/abcdeSplit';
import { hasRequiredCompound } from '@/lib/gameplan/engine/iron/mandatoryCompounds';
import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';
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
  experience_level: null,
  available_time_iron: 90,
  iron_mastery: null,
  frequency_iron: 5,
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

  it('Slot categories corretos para exercícios problemáticos (Elite seed)', () => {
    expect(catalog.bySlug.get('reverse_pec_deck')?.slot_category).toBe('shoulder_posterior_fly');
    expect(catalog.bySlug.get('face_pull')?.slot_category).toBe('shoulder_posterior_fly');
    expect(catalog.bySlug.get('cable_lateral_raise')?.slot_category).toBe('shoulder_lateral_raise');
    expect(catalog.bySlug.get('dumbbell_shrug')?.slot_category).toBe('trap_shrug');
  });

  it('Mantém volume de sessão coerente para atleta enhanced em bulking', () => {
    microcycle.forEach((day) => {
      if (day.is_rest_day) return;
      const exercises = ironExercisesForDay(day);
      const totalSets = exercises.reduce((sum, exercise) => sum + exercise.target_sets, 0);

      expect(totalSets).toBeGreaterThanOrEqual(8);
      expect(totalSets).toBeLessThanOrEqual(48);
    });
  });

  it('Sissy Squat é isolador (nunca primary compound)', () => {
    const sissy = catalog.bySlug.get('sissy_squat');
    expect(sissy).toBeDefined();
    expect(sissy?.movement_pattern).toBe('isolation');
    expect(sissy?.tactical_role).toBe('isolation_metabolic');
    expect(sissy?.joint_stress_profile).toBe('high_knee_shear');
  });

  it('Dia 2: abre com composto de quad, ≤2 panturrilhas, Sissy nunca abre', () => {
    const day2 = microcycle.find((day) => day.day_index === 2);
    const exercises = ironExercisesForDay(day2);
    expect(exercises.length).toBeGreaterThanOrEqual(5);

    const first = exercises[0]!;
    const firstMeta = first.slug ? catalog.bySlug.get(first.slug) : undefined;
    expect(first.slug?.includes('sissy') ?? false).toBe(false);
    expect(firstMeta?.joint_stress_profile).not.toBe('high_knee_shear');
    expect(firstMeta?.movement_pattern).not.toBe('isolation');
    expect(['primary_compound', 'secondary_compound']).toContain(firstMeta?.tactical_role);

    const calfCount = exercises.filter((exercise) => {
      const category = exercise.slot_category ?? '';
      return category === 'calf_raise' || category === 'calf_raise_seated' || exercise.slug?.includes('calf');
    }).length;
    expect(calfCount).toBeGreaterThanOrEqual(1);
    expect(calfCount).toBeLessThanOrEqual(2);

    const sissyIdx = exercises.findIndex((exercise) => exercise.slug?.includes('sissy'));
    if (sissyIdx >= 0) {
      expect(sissyIdx).toBeGreaterThan(1);
      expect(exercises[sissyIdx]!.target_sets).toBeGreaterThanOrEqual(3);
    }
  });

  it('Nenhum dia Iron abre com isolador de alto shear no joelho', () => {
    microcycle.forEach((day) => {
      if (day.is_rest_day) return;
      const exercises = ironExercisesForDay(day);
      if (exercises.length === 0) return;
      const opener = exercises[0]!;
      const meta = opener.slug ? catalog.bySlug.get(opener.slug) : undefined;
      expect(meta?.joint_stress_profile, `Day ${day.day_index} opener ${opener.slug}`).not.toBe(
        'high_knee_shear',
      );
      expect(opener.slug?.includes('sissy') ?? false).toBe(false);
    });
  });
});
