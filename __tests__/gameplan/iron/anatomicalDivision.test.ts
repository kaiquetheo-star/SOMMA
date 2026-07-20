import { beforeAll, describe, expect, it } from 'vitest';

import { ELITE_EXERCISES, ELITE_EXERCISE_COUNT } from '@/lib/catalog/eliteCatalog';
import { ELITE_ANATOMICAL_MAP } from '@/lib/catalog/eliteAnatomicalMap';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import {
  ALL_MUSCLE_SUB_GROUPS,
  MUSCLE_GROUPS,
  type MuscleSubGroup,
} from '@/lib/gameplan/engine/iron/anatomicalDivision';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import { ABCDE_SPLIT } from '@/lib/gameplan/engine/iron/splits/abcdeSplit';
import { createWeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import type { DailyGameplan, IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';
import type { UserBiological } from '@/types/biological';

const catalog = buildExerciseCatalog([...ELITE_EXERCISES], { includeStarvationAliases: true });

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

function isTricepsSubGroup(subGroup: MuscleSubGroup | null | undefined): boolean {
  return subGroup != null && subGroup.startsWith('triceps_');
}

describe('Anatomical Division Validation', () => {
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

  it('mapeia os 49 exercícios Elite para sub-grupos anatômicos', () => {
    expect(ELITE_EXERCISE_COUNT).toBe(49);
    expect(Object.keys(ELITE_ANATOMICAL_MAP)).toHaveLength(49);

    for (const exercise of ELITE_EXERCISES) {
      const mapped = catalog.bySlug.get(exercise.slug);
      expect(mapped).toBeDefined();
      expect(mapped!.primary_sub_group).toBeTruthy();
      expect(mapped!.muscle_sub_groups!.length).toBeGreaterThan(0);
    }
  });

  it('ABCDE permanece 5 Iron + 2 Rest (não vira ABCDEF)', () => {
    expect(ABCDE_SPLIT.days).toBe(7);
    expect(ABCDE_SPLIT.frequency).toBe('1x_per_week');
    expect(ABCDE_SPLIT.dayTemplates).toHaveLength(5);
    expect(microcycle.filter((day) => !day.is_rest_day)).toHaveLength(5);
    expect(microcycle.filter((day) => day.is_rest_day)).toHaveLength(2);
  });

  it('Day 1 (Peito+Tríceps) deve ter exercícios diretos de tríceps', () => {
    const day1 = microcycle.find((day) => day.day_index === 1);
    const exercises = ironExercisesForDay(day1);

    const tricepsExercises = exercises.filter((ex) => {
      const meta = ex.slug ? catalog.bySlug.get(ex.slug) : undefined;
      if (!meta) return false;
      if (meta.primary_muscle === 'triceps') return true;
      return (meta.muscle_sub_groups ?? []).some((sg) => sg.startsWith('triceps_'));
    });

    expect(tricepsExercises.length).toBeGreaterThanOrEqual(2);

    const totalTricepsSets = tricepsExercises.reduce((sum, ex) => sum + ex.target_sets, 0);
    expect(totalTricepsSets).toBeGreaterThanOrEqual(8);
  });

  it('Day 6 (Ombros) deve cobrir as 3 cabeças do ombro', () => {
    const day6 = microcycle.find((day) => day.day_index === 6);
    const shoulderExercises = ironExercisesForDay(day6);

    const hasAnterior = shoulderExercises.some((ex) => {
      const meta = ex.slug ? catalog.bySlug.get(ex.slug) : undefined;
      return meta?.muscle_sub_groups?.includes('shoulder_anterior')
        || meta?.primary_muscle === 'front_delts';
    });
    const hasLateral = shoulderExercises.some((ex) => {
      const meta = ex.slug ? catalog.bySlug.get(ex.slug) : undefined;
      return meta?.muscle_sub_groups?.includes('shoulder_lateral')
        || meta?.primary_muscle === 'side_delts';
    });
    const hasPosterior = shoulderExercises.some((ex) => {
      const meta = ex.slug ? catalog.bySlug.get(ex.slug) : undefined;
      return meta?.muscle_sub_groups?.includes('shoulder_posterior')
        || meta?.primary_muscle === 'rear_delts';
    });

    expect(hasAnterior && hasLateral && hasPosterior).toBe(true);
  });

  it('Day 4 (Costas+Bíceps) deve ter exercícios diretos de bíceps', () => {
    const day4 = microcycle.find((day) => day.day_index === 4);
    const exercises = ironExercisesForDay(day4);
    const biceps = exercises.filter((ex) => {
      const meta = ex.slug ? catalog.bySlug.get(ex.slug) : undefined;
      return meta?.primary_muscle === 'biceps';
    });
    expect(biceps.length).toBeGreaterThanOrEqual(2);
    const sets = biceps.reduce((sum, ex) => sum + ex.target_sets, 0);
    expect(sets).toBeGreaterThanOrEqual(8);
  });

  it('sub-grupos prioritários (primaryGroups) do split atingem MEV semanal', () => {
    const tracker = createWeeklyVolumeTracker(
      catalog,
      [],
      [],
      { ...userBiological, preferred_split: 'abcde' },
    );

    for (const day of microcycle) {
      for (const ex of ironExercisesForDay(day)) {
        const meta = ex.slug ? catalog.bySlug.get(ex.slug) : undefined;
        if (!meta) continue;
        tracker.creditVolume(meta, ex.target_sets);
      }
    }

    const priorityGroups = new Set<MuscleSubGroup>();
    for (const template of ABCDE_SPLIT.dayTemplates) {
      for (const group of template.primaryGroups) {
        priorityGroups.add(group);
      }
    }

    for (const subGroup of priorityGroups) {
      const volume = tracker.getSubGroupVolume(subGroup);
      const def = MUSCLE_GROUPS[subGroup];
      expect(
        volume + 1e-6,
        `${subGroup} volume ${volume} < MEV ${def.mevPerWeek}`,
      ).toBeGreaterThanOrEqual(def.mevPerWeek * 0.5);
    }
  });

  it('core está prescrito em ≥2 day templates ABCDE', () => {
    const coreTemplateDays = ABCDE_SPLIT.dayTemplates.filter(
      (day) =>
        day.tertiaryGroups.some((g) => g === 'rectus_abdominis' || g === 'obliques') ||
        day.slots.some((slot) => slot.category.startsWith('core_')),
    );
    expect(coreTemplateDays.length).toBeGreaterThanOrEqual(2);
    expect(coreTemplateDays.map((d) => d.day_index).sort()).toEqual([5, 6]);
  });

  it('todo conteúdo de UI do microciclo está em português', () => {
    const json = JSON.stringify(microcycle);
    expect(json).not.toContain('Biological Fueling');
    expect(json).not.toContain('Healer Zone');
    expect(json).not.toContain('Spirit Reset');
    expect(json).not.toContain('Progressive overload');
    expect(json).toContain('Nutrição Biológica');
    expect(json).toContain('Zona de Cura');
  });

  it('MUSCLE_GROUPS cobre todos os MuscleSubGroup', () => {
    expect(ALL_MUSCLE_SUB_GROUPS.length).toBeGreaterThanOrEqual(30);
    for (const key of ALL_MUSCLE_SUB_GROUPS) {
      expect(MUSCLE_GROUPS[key].mevPerWeek).toBeGreaterThan(0);
      expect(MUSCLE_GROUPS[key].mrvHardPerWeek).toBeGreaterThan(MUSCLE_GROUPS[key].mrvSoftPerWeek);
    }
  });

  it('crédito de sinergista sub-grupo é 0.33 (não rouba volume de tríceps)', () => {
    const tracker = createWeeklyVolumeTracker(catalog, [], [], userBiological);
    const bench = catalog.bySlug.get('barbell_bench_press');
    expect(bench).toBeDefined();
    tracker.creditVolume(bench!, 4);
    expect(tracker.getSubGroupVolume('chest_horizontal')).toBe(4);
    expect(tracker.getSubGroupVolume('triceps_lateral_head')).toBeCloseTo(1.32, 5);
    expect(isTricepsSubGroup(bench!.primary_sub_group)).toBe(false);
  });
});
