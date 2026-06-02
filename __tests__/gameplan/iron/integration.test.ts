import { describe, expect, it } from 'vitest';
import { getBundledExercises } from '@/lib/catalog/bundledCatalog';
import {
  computeWeeklyShoulderBalance,
  generateIronMicrocycle,
  SHOULDER_BALANCE_RATIO,
} from '@/lib/gameplan/engine/iron/generateIronMicrocycle';
import { e1rmFromTopSet } from '@/lib/gameplan/engine/iron/loadPrescriptionMapper';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import { initialBiologicalProfile } from '@/types/biological';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';

function enrichBundledForHypertrophy(rows: LibraryExercise[]): LibraryExercise[] {
  return rows.map((row) => {
    if (row.slug === 'barbell_bench_press') {
      return {
        ...row,
        primary_muscle: 'chest',
        synergist_muscles: ['front_delts', 'triceps'],
        cns_fatigue_cost: 4,
      };
    }
    if (row.slug === 'barbell_incline_bench_press' || row.slug === 'dumbbell_incline_press') {
      return {
        ...row,
        primary_muscle: 'upper_chest',
        synergist_muscles: ['front_delts', 'triceps'],
      };
    }
    if (row.slug === 'overhead_press' || row.slug === 'barbell_overhead_press') {
      return {
        ...row,
        primary_muscle: 'front_delts',
        synergist_muscles: ['triceps', 'upper_chest'],
      };
    }
    if (row.slug === 'cable_lateral_raise' || row.slug === 'lateral_raise') {
      return {
        ...row,
        primary_muscle: 'side_delts',
        synergist_muscles: ['traps'],
        movement_pattern: 'isolation',
        cns_fatigue_cost: 1,
      };
    }
    if (row.slug === 'face_pull') {
      return {
        ...row,
        primary_muscle: 'rear_delts',
        synergist_muscles: ['traps'],
        movement_pattern: 'isolation',
      };
    }
    if (row.slug === 'reverse_pec_deck' || row.slug === 'pec_deck') {
      return {
        ...row,
        primary_muscle: 'rear_delts',
        synergist_muscles: ['mid_back'],
        movement_pattern: 'isolation',
      };
    }
    return row;
  });
}

function benchPressLog(exerciseId: string): EnginePerformanceRow {
  return {
    pillar: 'iron',
    exercise_id: exerciseId,
    weight_used: 100,
    reps_completed: 8,
    rpe_score: 8,
    timestamp: new Date().toISOString(),
    payload: {
      iron: {
        exercise_id: exerciseId,
        sets: [
          {
            weight_kg: 100,
            reps: 8,
            reported_rir: 2,
            target_rir: 2,
          },
        ],
      },
    },
  };
}

describe('generateIronMicrocycle integration', () => {
  it('builds 6-day PPL microcycle with E1RM loads and shoulder coherence', () => {
    const catalog = enrichBundledForHypertrophy(getBundledExercises());
    const bench = catalog.find((row) => row.slug === 'barbell_bench_press');
    expect(bench).toBeDefined();

    const logs21d: EnginePerformanceRow[] = [benchPressLog(bench!.id)];
    const biological = {
      ...initialBiologicalProfile,
      frequency_iron: 6,
      goal_iron: 'Hypertrophy',
    };

    const equipment: EquipmentTag[] = ['full_gym', 'barbell', 'dumbbells'];
    const ironDayIndices = [1, 2, 3, 4, 5, 6];

    const microcycle = generateIronMicrocycle({
      libraryExercises: catalog,
      biological,
      equipment,
      logs7d: [],
      logs21d,
      ironDayIndices,
      weekStartDate: '2026-05-26',
      blockedJointProfiles: [],
      goalIron: biological.goal_iron,
      availableMinutes: 60,
    });

    expect(microcycle).toHaveLength(6);

    const emptyDays = microcycle.filter((day) => day.picks.length === 0);
    expect(
      emptyDays,
      JSON.stringify(microcycle.map((day) => ({ split: day.splitDay, picks: day.picks.length }))),
    ).toHaveLength(0);

    for (const day of microcycle) {
      for (const pick of day.picks) {
        expect(pick.prescription.exercise_id).toBe(pick.exerciseId);
        expect(pick.prescription.target_sets).toBeGreaterThan(0);
        expect(pick.prescription.target_reps).toBeGreaterThan(0);
        expect(typeof pick.prescription.target_rep_range).toBe('string');
      }
    }

    const pushDay = microcycle.find((day) => day.splitDay === 'push');
    expect(pushDay).toBeDefined();

    const benchPick = pushDay!.picks.find((pick) => pick.exercise.slug === 'barbell_bench_press');
    expect(benchPick).toBeDefined();

    const expectedE1rm = e1rmFromTopSet(100, 8);
    expect(expectedE1rm).toBeCloseTo(126.7, 0);

    const benchWeight = benchPick!.prescription.target_weight_kg;
    expect(benchWeight).not.toBeNull();
    expect(benchWeight!).toBeGreaterThanOrEqual(90);
    expect(benchWeight!).toBeLessThanOrEqual(102);
    expect(benchPick!.prescription.progression_note).toMatch(/E1RM/i);

    const shoulder = computeWeeklyShoulderBalance(microcycle);
    expect(shoulder.anterior).toBeGreaterThan(0);
    expect(shoulder.lateral + shoulder.posterior).toBeGreaterThanOrEqual(
      SHOULDER_BALANCE_RATIO * shoulder.anterior,
    );
  });
});
