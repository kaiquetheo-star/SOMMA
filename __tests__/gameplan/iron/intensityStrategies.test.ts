import { describe, expect, it } from 'vitest';

import { applyIntensityStrategies } from '@/lib/gameplan/engine/iron/IntensityStrategyEngine';
import { initialBiologicalProfile, type BiologicalProfile } from '@/types/biological';
import type { IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';

function biological(overrides: Partial<BiologicalProfile> = {}): BiologicalProfile {
  return {
    ...initialBiologicalProfile,
    date_of_birth: '1996-01-01',
    weight_kg: 58,
    height_cm: 170,
    baseline_stress_level: 3,
    training_days_per_week: 6,
    frequency_iron: 6,
    available_time_iron: 90,
    goal_iron: 'Hypertrophy',
    nutrition_goal: 'Hypertrophy support',
    ...overrides,
  };
}

function exercise(
  slug: string,
  name: string,
  overrides: Partial<IronExercisePrescription> = {},
): IronExercisePrescription {
  return {
    exercise_id: `ex-${slug}`,
    slug,
    display_name: name,
    target_sets: 3,
    target_reps: 12,
    target_rep_range: '8-12 @ 2 RIR',
    target_rir: 2,
    target_weight_kg: null,
    rest_seconds: 75,
    progression_note: 'Calibre a primeira série @ RIR prescrito',
    execution_technique: 'Standard',
    ...overrides,
  };
}

function day(exercises: IronExercisePrescription[], focusLabel = 'Iron: Legs A (Quad Focus)'): MicrocycleDay {
  return {
    day_index: 3,
    is_rest_day: false,
    focus_label: focusLabel,
    blocks: [
      {
        id: 'block-d3-iron',
        pillar: 'iron',
        title: focusLabel,
        subtitle: '',
        duration_minutes: 90,
        order: 0,
        status: 'pending',
        iron: {
          routine_id: 'test',
          exercises,
        },
      },
    ],
  };
}

function ironExercises(result: MicrocycleDay[]): IronExercisePrescription[] {
  return result[0]?.blocks[0]?.iron?.exercises ?? [];
}

describe('IntensityStrategyEngine', () => {
  it('A: aplica DROP_SET ao Leg Extension para usuário ADVANCED', () => {
    const result = applyIntensityStrategies(
      [
        day([
          exercise('hack_squat', 'Hack Squat', { target_sets: 4 }),
          exercise('walking_lunge', 'Walking Lunge'),
          exercise('leg_extension', 'Leg Extension', { target_sets: 4 }),
        ]),
      ],
      biological({ experience_level: 'ADVANCED' }),
      [],
    );

    const legExtension = ironExercises(result).find((row) => row.slug === 'leg_extension');
    expect(legExtension?.execution_technique).toBe('Séries drop');
    expect(legExtension?.progression_note).toMatch(/Drop-set|Drop-Set|Séries drop/i);
    expect(legExtension?.target_sets).toBeLessThanOrEqual(4);
  });

  it('B: prescreve Chin-Up como WEIGHTED ou REST_PAUSE para atleta avançado leve', () => {
    const result = applyIntensityStrategies(
      [
        day(
          [
            exercise('chin_up', 'Chin-Up', { target_sets: 4, target_rep_range: '6-8 @ 2 RIR' }),
            exercise('barbell_bent_over_row', 'Barbell Bent-Over Row', { target_sets: 4 }),
            exercise('barbell_curl', 'Barbell Curl', { target_sets: 4 }),
          ],
          'Iron: Pull A (Lat Width)',
        ),
      ],
      biological({ experience_level: 'ADVANCED', weight_kg: 58 }),
      [],
    );

    const chinUp = ironExercises(result).find((row) => row.slug === 'chin_up');
    expect(chinUp).toBeTruthy();
    expect(
      chinUp?.loading_protocol === 'weighted' ||
        chinUp?.execution_technique === 'REST_PAUSE' ||
        chinUp?.progression_note?.includes('WEIGHTED'),
    ).toBe(true);
  });

  it('C: não aplica DROP_SET nem REST_PAUSE para usuário BEGINNER', () => {
    const result = applyIntensityStrategies(
      [
        day([
          exercise('hack_squat', 'Hack Squat', { target_sets: 4 }),
          exercise('leg_extension', 'Leg Extension', { target_sets: 4 }),
        ]),
      ],
      biological({ experience_level: 'BEGINNER' }),
      [],
    );

    for (const item of ironExercises(result)) {
      expect(item.execution_technique).not.toBe('DROP_SET');
      expect(item.execution_technique).not.toBe('REST_PAUSE');
      expect(item.progression_note).not.toContain('Drop-Set');
      expect(item.progression_note).not.toContain('Rest-Pause');
    }
  });
});
