/**
 * Anti-Collapse Guards — regressão do bug "1-2 sets por exercício"
 * (backup somma-backup-2026-07-16: Day 4 Pull inteiro achatado para 2 sets
 * com minimum_viable_path_absolute_last_resort).
 *
 * Filosofia linear: fadiga/readiness NUNCA cortam volume; rescue paths mantêm
 * dose real (compostos ≥3 sets, isoladores ≥2).
 */
import { describe, expect, it } from 'vitest';

import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { resolveVolumeLimitsForSplit, VOLUME_MATRIX } from '@/lib/gameplan/engine/iron/volumeMatrix';
import { initialBiologicalProfile, type UserBiological } from '@/types/biological';
import type { DailyGameplan, IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';

/** Profile from the 2026-07-16 backup that reproduced the collapse. */
const backupBiological: UserBiological = {
  ...initialBiologicalProfile,
  date_of_birth: '1994-05-14',
  weight_kg: 59,
  height_cm: 159,
  baseline_stress_level: 3,
  goal_iron: 'Hypertrophy',
  nutrition_goal: 'Hypertrophy support',
  available_time_iron: 90,
  training_days_per_week: 5,
  frequency_iron: 5,
  experience_level: 'advanced',
  iron_mastery: 5,
  mesocycle_phase: 'maintenance',
  mesocycle_week: 1,
  mesocycle_goal: 'hypertrophy',
  preferred_split: 'abcde',
  hormonal_transition: false,
};

function ironExercisesOfDay(day: MicrocycleDay | undefined): IronExercisePrescription[] {
  return day?.blocks.flatMap((block) => block.iron?.exercises ?? []) ?? [];
}

function allIronExercises(microcycle: DailyGameplan['microcycle']): IronExercisePrescription[] {
  return microcycle.flatMap((day) => (day.is_rest_day ? [] : ironExercisesOfDay(day)));
}

async function generate(biological: UserBiological, readinessScan?: Parameters<typeof generateDeterministicGameplan>[0]['readinessScan']) {
  return generateDeterministicGameplan({
    focus: { iron: 100, nutrition: 100 },
    equipment: ['full_gym'],
    biological,
    userStats: { iron_sessions_completed: 0, nutrition_checkins_completed: 0 },
    performanceLogs: [],
    protocolDate: '2026-07-13',
    readinessScan,
  });
}

describe('Anti-Collapse Guards', () => {
  it('usuário com readiness baixa (≈3.6) + TRT NÃO tem sets cortados para 1', async () => {
    const gameplan = await generate(
      {
        ...backupBiological,
        hormonal_protocol: { type: 'trt', weekly_dose_mg: 200, recovery_multiplier: 1.5 },
      },
      {
        // deriveReadinessScore ≈ 3.6 (sono 4, dor 3→3, energia 4, stress 3→3, mobilidade 4)
        sleep_quality: 4,
        muscle_soreness: 3,
        energy_level: 4,
        stress_level: 3,
        mobility_feeling: 4,
        timestamp: '2026-07-13T07:00:00.000Z',
      },
    );

    const pullDay = gameplan.microcycle.find((day) => day.day_index === 4);
    expect(pullDay).toBeDefined();
    const pullExercises = ironExercisesOfDay(pullDay);
    expect(pullExercises.length).toBeGreaterThanOrEqual(4);

    for (const exercise of pullExercises) {
      expect(exercise.target_sets).toBeGreaterThanOrEqual(2);
    }

    // A jornada de rescue de UM slot não pode achatar o dia inteiro:
    // a maioria dos exercícios do Pull day chega com prescrição saudável (≥3 sets).
    const healthy = pullExercises.filter((exercise) => exercise.target_sets >= 3);
    expect(healthy.length).toBeGreaterThanOrEqual(Math.ceil(pullExercises.length / 2));

    const flattenedByMvp = pullExercises.filter(
      (exercise) =>
        (exercise.diagnostic_reason ?? '').includes('minimum_viable_path') &&
        exercise.target_sets < 3,
    );
    expect(flattenedByMvp).toHaveLength(0);

    // Volume total do dia de costas não pode regredir ao estado colapsado (13 sets).
    const totalPullSets = pullExercises.reduce((sum, exercise) => sum + exercise.target_sets, 0);
    expect(totalPullSets).toBeGreaterThanOrEqual(18);
  });

  it('usuário com cns_fatigue_score legado (26) persistido NÃO tem volume cortado', async () => {
    // Campo removido do schema — estados antigos ainda podem carregá-lo.
    const staleBiological = {
      ...backupBiological,
      cns_fatigue_score: 26,
    } as UserBiological;

    const gameplan = await generate(staleBiological);

    const exercises = allIronExercises(gameplan.microcycle);
    expect(exercises.length).toBeGreaterThan(0);
    for (const exercise of exercises) {
      expect(exercise.target_sets).toBeGreaterThanOrEqual(2);
    }

    // Nenhum dia inteiro achatado para o piso: cada dia de treino mantém
    // pelo menos um exercício com dose plena (≥4 sets).
    for (const day of gameplan.microcycle) {
      if (day.is_rest_day) continue;
      const dayExercises = ironExercisesOfDay(day);
      expect(Math.max(...dayExercises.map((exercise) => exercise.target_sets))).toBeGreaterThanOrEqual(4);
    }
  });

  it('TRT AUMENTA o MRV, nunca corta volume', () => {
    const base = VOLUME_MATRIX.once_per_week;
    expect(base.mrvSoft).toBe(22);
    expect(base.mrvHard).toBe(26);

    const limits = resolveVolumeLimitsForSplit('abcde', {
      hormonal_protocol: { type: 'trt', weekly_dose_mg: 200, recovery_multiplier: 1.5 },
      hormonal_transition: false,
    });

    expect(limits.mrvSoft).toBeGreaterThan(base.mrvSoft);
    expect(limits.mrvHard).toBeGreaterThan(base.mrvHard);
    expect(limits.mev).toBe(base.mev);
  });
});
