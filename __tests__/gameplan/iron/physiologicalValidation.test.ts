import { beforeAll, describe, expect, it } from 'vitest';

import { FULL_BUNDLED_EXERCISES } from '@/lib/catalog/bundledCatalog.full';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import { mapToIronPrescription } from '@/lib/gameplan/engine/iron/loadPrescriptionMapper';
import {
  applyRecoveryVolumeMultiplier,
  resolveVolumeMatrix,
  VOLUME_MATRIX,
} from '@/lib/gameplan/engine/iron/volumeMatrix';
import { ABCDE_MEV } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import { generateIronMicrocycle } from '@/lib/gameplan/engine/iron/generateIronMicrocycle';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import { initialBiologicalProfile, type UserBiological } from '@/types/biological';
import type { DailyGameplan, IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';
import type { LibraryExercise } from '@/types/catalog';

const catalog = buildExerciseCatalog(FULL_BUNDLED_EXERCISES);

const abcdeBiological: UserBiological = {
  ...initialBiologicalProfile,
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
  cns_fatigue_score: 0,
  mesocycle_phase: 'bulking',
  mesocycle_week: 1,
  preferred_split: 'abcde',
  current_body_fat_estimate: 18,
  hormonal_transition: false,
};

function ironExercisesForDay(day: MicrocycleDay | undefined): IronExercisePrescription[] {
  const iron = day?.blocks.find((block) => block.pillar === 'iron');
  return iron?.iron?.exercises ?? [];
}

function chestWeeklySets(microcycle: DailyGameplan['microcycle']): number {
  return microcycle.reduce((weekTotal, day) => {
    return (
      weekTotal +
      ironExercisesForDay(day).reduce((sum, exercise) => {
        const meta = exercise.slug ? catalog.bySlug.get(exercise.slug) : undefined;
        const isChestSlot = exercise.slot_category?.startsWith('chest_') ?? false;
        const isChestPrimary =
          meta?.primary_muscle === 'chest' || meta?.primary_muscle === 'upper_chest';
        if (!isChestSlot && !isChestPrimary) return sum;
        return sum + exercise.target_sets;
      }, 0)
    );
  }, 0);
}

function armsWeeklyDirectSets(microcycle: DailyGameplan['microcycle']): number {
  const day6 = microcycle.find((day) => day.day_index === 6);
  return ironExercisesForDay(day6).reduce((sum, exercise) => {
    const meta = exercise.slug ? catalog.bySlug.get(exercise.slug) : undefined;
    if (!meta) return sum;
    if (meta.primary_muscle !== 'biceps' && meta.primary_muscle !== 'triceps') return sum;
    return sum + exercise.target_sets;
  }, 0);
}

function pushWeeklyChestSets(microcycle: DailyGameplan['microcycle']): number {
  return microcycle.reduce((weekTotal, day) => {
    if (day.is_rest_day) return weekTotal;
    const focus = day.focus_label.toLowerCase();
    if (!focus.includes('push')) return weekTotal;

    return (
      weekTotal +
      ironExercisesForDay(day).reduce((sum, exercise) => {
        const meta = exercise.slug ? catalog.bySlug.get(exercise.slug) : undefined;
        if (meta?.primary_muscle !== 'chest' && meta?.primary_muscle !== 'upper_chest') return sum;
        return sum + exercise.target_sets;
      }, 0)
    );
  }, 0);
}

function minimumViableFallbacks(microcycle: DailyGameplan['microcycle']): IronExercisePrescription[] {
  return microcycle.flatMap((day) => {
    if (day.is_rest_day) return [];
    return ironExercisesForDay(day).filter(
      (exercise) => exercise.diagnostic_reason === 'minimum_viable_path_absolute_last_resort',
    );
  });
}

describe('Physiological validation — Iron engine', () => {
  describe('ABCDE split (1× frequency)', () => {
    let microcycle: DailyGameplan['microcycle'];

    beforeAll(async () => {
      const gameplan = await generateDeterministicGameplan({
        focus: { iron: 100, nutrition: 100 },
        equipment: ['full_gym'],
        biological: abcdeBiological,
        userStats: { iron_sessions_completed: 0, nutrition_checkins_completed: 0 },
        performanceLogs: [],
        protocolDate: '2026-06-09',
      });
      microcycle = gameplan.microcycle;
    });

    it('gera 5 dias Iron + 2 Rest', () => {
      expect(microcycle.filter((day) => !day.is_rest_day)).toHaveLength(5);
    });

    it('Peito ≥ 14 sets semanais (MEV 1× — RP hypertrophy)', () => {
      expect(chestWeeklySets(microcycle)).toBeGreaterThanOrEqual(ABCDE_MEV);
      expect(ABCDE_MEV).toBe(14);
    });

    it('Braços (bíceps + tríceps) ≥ 12 sets diretos no Day 6', () => {
      expect(armsWeeklyDirectSets(microcycle)).toBeGreaterThanOrEqual(12);
    });

    it('Nenhum dia primário com minimum_viable_path', () => {
      expect(minimumViableFallbacks(microcycle)).toHaveLength(0);
    });
  });

  describe('PPL×2 split (2× frequency)', () => {
    it('Push semanal de peito dentro de 10–18 sets (MEV–MRV soft 2×)', async () => {
      const gameplan = await generateDeterministicGameplan({
        focus: { iron: 100, nutrition: 100 },
        equipment: ['full_gym'],
        biological: {
          ...abcdeBiological,
          frequency_iron: 6,
          training_days_per_week: 6,
          preferred_split: 'ppl_x2',
        },
        userStats: { iron_sessions_completed: 0, nutrition_checkins_completed: 0 },
        performanceLogs: [],
        protocolDate: '2026-06-09',
      });

      const pushChestSets = pushWeeklyChestSets(gameplan.microcycle);
      expect(pushChestSets).toBeGreaterThanOrEqual(VOLUME_MATRIX.twice_per_week.mev);
      expect(pushChestSets).toBeLessThanOrEqual(VOLUME_MATRIX.twice_per_week.mrvSoft);
    });
  });

  describe('Recovery volume multiplier (Phase 4 matrix)', () => {
    it('reduz volume em 30% independente do split', () => {
      expect(resolveVolumeMatrix('abcde').recoveryVolumeMultiplier).toBe(0.7);
      expect(resolveVolumeMatrix('ppl_x2').recoveryVolumeMultiplier).toBe(0.7);
      expect(applyRecoveryVolumeMultiplier(10, true, 'abcde')).toBe(7);
      expect(applyRecoveryVolumeMultiplier(10, true, 'ppl_x2')).toBe(7);
      expect(applyRecoveryVolumeMultiplier(10, false, 'abcde')).toBe(10);
    });
  });

  describe('Log recovery via slug when UUID fails', () => {
    it('mapToIronPrescription recupera carga histórica por slug', () => {
      const exercise = catalog.bySlug.get('barbell_bench_press');
      expect(exercise).toBeDefined();

      const logs21d: EnginePerformanceRow[] = [
        {
          pillar: 'iron',
          exercise_id: 'stale-uuid-bench',
          weight_used: 60,
          reps_completed: 8,
          rpe_score: 7,
          timestamp: '2026-06-20T18:00:00.000Z',
          payload: {
            iron: {
              exercise_id: 'stale-uuid-bench',
              exercise_slug: 'barbell_bench_press',
              sets: [{ weight_kg: 60, reps: 8, reported_rir: 2, target_rir: 2 }],
            },
          },
        },
      ];

      const prescription = mapToIronPrescription(
        {
          slotId: 'chest_compound_a',
          exerciseId: exercise!.id,
          prescribedSets: 4,
          score: 1,
        },
        exercise!,
        null,
        logs21d,
        'Hypertrophy',
        null,
      );

      expect(prescription.target_weight_kg).not.toBeNull();
      expect(prescription.target_weight_kg!).toBeGreaterThanOrEqual(60);
    });
  });
});

describe('Physiological validation — direct microcycle (PPL seed)', () => {
  function mockLibraryExercise(
    partial: Partial<LibraryExercise> & Pick<LibraryExercise, 'id' | 'slug' | 'name'>,
  ): LibraryExercise {
    return {
      biomechanical_instructions: { setup: 'fixture' },
      equipment_required: ['full_gym'],
      default_sets: 4,
      default_reps: 10,
      movement_pattern: 'push',
      primary_muscle: 'chest',
      synergist_muscles: [],
      cns_fatigue_cost: 3,
      joint_stress_profile: 'low_impact',
      stretch_mediated_hypertrophy: false,
      ...partial,
    };
  }

  it('microcycle PPL compacto mantém peito acima do MEV 2×', () => {
    const library: LibraryExercise[] = [
      mockLibraryExercise({
        id: 'bench',
        slug: 'barbell_bench_press',
        name: 'Barbell Bench Press',
        movement_pattern: 'push',
        primary_muscle: 'chest',
        synergist_muscles: ['front_delts', 'triceps'],
        cns_fatigue_cost: 4,
      }),
      mockLibraryExercise({
        id: 'incline',
        slug: 'incline_dumbbell_press_30',
        name: 'Incline Dumbbell Press 30',
        movement_pattern: 'push',
        primary_muscle: 'upper_chest',
        synergist_muscles: ['front_delts', 'triceps'],
        cns_fatigue_cost: 3,
      }),
      mockLibraryExercise({
        id: 'fly',
        slug: 'cable_fly',
        name: 'Cable Fly',
        movement_pattern: 'isolation',
        primary_muscle: 'chest',
        default_sets: 3,
        cns_fatigue_cost: 1,
      }),
    ];

    const microcycle = generateIronMicrocycle({
      libraryExercises: library,
      biological: {
        ...initialBiologicalProfile,
        frequency_iron: 6,
        preferred_split: 'ppl_x2',
        available_time_iron: 45,
        goal_iron: 'Hypertrophy',
      },
      equipment: ['full_gym'],
      logs7d: [],
      logs21d: [],
      ironDayIndices: [1, 4],
      weekStartDate: '2026-06-09',
      blockedJointProfiles: [],
      goalIron: 'Hypertrophy',
      availableMinutes: 45,
    });

    const pushChestSets = microcycle
      .filter((day) => day.splitDay === 'push')
      .flatMap((day) => day.picks)
      .filter((pick) => {
        const muscle = pick.exercise.primary_muscle;
        return muscle === 'chest' || muscle === 'upper_chest';
      })
      .reduce((sum, pick) => sum + pick.prescribedSets, 0);

    expect(pushChestSets).toBeGreaterThanOrEqual(VOLUME_MATRIX.twice_per_week.mev);
  });
});
