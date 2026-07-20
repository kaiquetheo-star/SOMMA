import { describe, expect, it } from 'vitest';

import { ELITE_EXERCISES } from '@/lib/catalog/eliteCatalog';
import { generateIronMicrocycle } from '@/lib/gameplan/engine/iron/generateIronMicrocycle';
import {
  DEFAULT_HORMONAL_PROTOCOL,
  initialBiologicalProfile,
  normalizeIronProfileForGeneration,
} from '@/types/biological';

const HAMSTRING_STRETCH_HINGES = new Set([
  'barbell_romanian_deadlift',
  'stiff_leg_deadlift',
  'dumbbell_romanian_deadlift',
  'barbell_hip_hinge_good_morning',
]);

describe('posterior chain Day 5 (ABCDE)', () => {
  const biological = normalizeIronProfileForGeneration({
    ...initialBiologicalProfile,
    preferred_split: 'abcde',
    frequency_iron: 5,
    available_time_iron: 90,
    iron_mastery: 5,
    experience_level: 'advanced',
    goal_iron: 'Hypertrophy',
    hormonal_protocol: { ...DEFAULT_HORMONAL_PROTOCOL },
  });

  function day5() {
    const days = generateIronMicrocycle({
      libraryExercises: [...ELITE_EXERCISES],
      biological,
      equipment: ['full_gym'],
      logs7d: [],
      logs21d: [],
      ironDayIndices: [1, 2, 4, 5, 6],
      weekStartDate: '2026-07-20',
      blockedJointProfiles: [],
      goalIron: biological.goal_iron,
      availableMinutes: 90,
      deferPrescriptionMapping: true,
    });
    const block = days.find((day) => day.dayIndex === 5);
    expect(block).toBeDefined();
    return block!;
  }

  it('Cenário A: Day 5 contains a hamstring stretch hinge (RDL or stiff-leg)', () => {
    const slugs = day5().picks.map((pick) => pick.exercise.slug);
    const hasHamstringHinge = slugs.some((slug) => HAMSTRING_STRETCH_HINGES.has(slug));
    expect(slugs.join(', ')).toMatch(/barbell_romanian_deadlift|stiff_leg_deadlift/);
    expect(hasHamstringHinge).toBe(true);
  });

  it('Cenário B: Day 5 contains hip_thrust_barbell alongside the hamstring hinge', () => {
    const slugs = day5().picks.map((pick) => pick.exercise.slug);
    expect(slugs).toContain('hip_thrust_barbell');
    expect(
      slugs.some((slug) => slug === 'barbell_romanian_deadlift' || slug === 'stiff_leg_deadlift'),
    ).toBe(true);
  });

  it('Cenário C: no Day 5 exercise has empty/undefined slot_category', () => {
    const picks = day5().picks;
    const empty = picks.filter(
      (pick) =>
        pick.prescription.slot_category == null ||
        pick.prescription.slot_category === '' ||
        pick.exercise.slot_category == null ||
        pick.exercise.slot_category === '',
    );
    expect(
      empty.map((pick) => `${pick.exercise.slug}:${pick.prescription.slot_category ?? '∅'}`),
    ).toEqual([]);
  });
});
