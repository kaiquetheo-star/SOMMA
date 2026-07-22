import { describe, expect, it } from 'vitest';

import { ELITE_EXERCISES } from '@/lib/catalog/eliteCatalog';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { applyReadinessAutoregulationToMicrocycle } from '@/lib/gameplan/engine/clinicalLaws';
import {
  applyIronInjuryConstraints,
  detectIronInjuryConstraints,
} from '@/lib/gameplan/engine/iron/injuryConstraints';
import { initialBiologicalProfile, type UserBiological } from '@/types/biological';
import type { MicrocycleDay } from '@/types/gameplan';

const baseBiological: UserBiological = {
  ...initialBiologicalProfile,
  weight_kg: 80,
  body_fat_percentage: 15,
  goal_iron: 'Hypertrophy',
  training_days_per_week: 5,
  frequency_iron: 5,
  preferred_split: 'abcde',
  mesocycle_phase: 'bulking',
  mesocycle_week: 2,
};

function ironExercisesOfDay(day: MicrocycleDay | undefined) {
  return day?.blocks.flatMap((block) => block.iron?.exercises ?? []) ?? [];
}

describe('linear motor barriers', () => {
  it('Barrier 1b: frequency_iron=4 + abcde still uses the Iron engine and builds a full week', async () => {
    const gameplan = await generateDeterministicGameplan({
      focus: { iron: 100, nutrition: 100 },
      equipment: ['full_gym'],
      biological: {
        ...baseBiological,
        frequency_iron: 4,
        training_days_per_week: 4,
        baseline_stress_level: 9,
      },
      userStats: { iron_sessions_completed: 0, nutrition_checkins_completed: 0 },
      performanceLogs: [],
      protocolDate: '2026-07-13',
    });

    const ironDays = gameplan.microcycle.filter((day) =>
      day.blocks.some((block) => block.pillar === 'iron'),
    );
    expect(ironDays).toHaveLength(4);

    for (const day of ironDays) {
      const exercises = ironExercisesOfDay(day);
      expect(exercises.length).toBeGreaterThanOrEqual(2);
      // Constitution: compounds ≥2, isolations ≥1.
      expect(exercises.every((exercise) => exercise.target_sets >= 1)).toBe(true);
      expect(
        exercises.every(
          (exercise) => !(exercise.progression_note ?? '').includes('Autoregulation'),
        ),
      ).toBe(true);
    }
  });

  it('Barrier 2: low readiness score never changes target_weight_kg', () => {
    const microcycle: MicrocycleDay[] = [
      {
        day_index: 1,
        is_rest_day: false,
        focus_label: 'Iron: Push',
        date: '2026-07-13',
        blocks: [
          {
            id: 'block-d1-iron',
            pillar: 'iron',
            title: 'Iron: Push',
            subtitle: 'Push',
            duration_minutes: 90,
            order: 0,
            status: 'pending',
            iron: {
              routine_id: 'iron_d1',
              exercises: [
                {
                  exercise_id: 'ex-bench',
                  slug: 'barbell_bench_press',
                  display_name: 'Barbell Bench Press',
                  target_sets: 4,
                  target_reps: 8,
                  target_rep_range: '6-8 @ 2 RIR',
                  target_rir: 2,
                  target_weight_kg: 100,
                  rest_seconds: 150,
                  progression_note: 'fixture',
                  execution_technique: 'Standard',
                },
              ],
            },
          },
        ],
      },
    ];

    const result = applyReadinessAutoregulationToMicrocycle(microcycle, 1, 1);

    expect(result).toBe(microcycle);
    const exercise = result[0]?.blocks[0]?.iron?.exercises?.[0];
    expect(exercise?.target_weight_kg).toBe(100);
    expect(exercise?.progression_note).toBe('fixture');
  });

  it('Barrier 3: injury joint blocks still swap exercises (safety preserved)', () => {
    const catalog = [...ELITE_EXERCISES];
    const squat = catalog.find((row) => row.slug === 'barbell_back_squat');
    expect(squat).toBeDefined();
    if (!squat) return;

    const injured = detectIronInjuryConstraints({
      ...baseBiological,
      current_injuries: 'lower back disc herniation',
    });
    expect(injured.blocked_joint_profiles.length).toBeGreaterThan(0);

    const routine = applyIronInjuryConstraints(
      [squat.id],
      catalog,
      ['full_gym'],
      injured,
    );

    if (squat.joint_stress_profile && injured.blocked_joint_profiles.includes(squat.joint_stress_profile)) {
      expect(routine[0]).not.toBe(squat.id);
    }
  });
});
