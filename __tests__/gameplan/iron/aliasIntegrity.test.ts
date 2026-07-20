import { describe, expect, it, vi } from 'vitest';

import { ELITE_EXERCISES } from '@/lib/catalog/eliteCatalog';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import {
  DEFAULT_HORMONAL_PROTOCOL,
  initialBiologicalProfile,
} from '@/types/biological';
import type { LibraryExercise } from '@/types/catalog';

vi.mock('@/lib/catalog/library', () => ({
  fetchLibraryExercises: vi.fn(async () => [...ELITE_EXERCISES]),
}));

describe('alias integrity', () => {
  const catalog = buildExerciseCatalog([...ELITE_EXERCISES], { includeStarvationAliases: true });
  const aliases = catalog.exercises.filter((exercise) => exercise.id.startsWith('alias:'));

  it('Cenário A: no alias shares cue_card.setup with a different-slug exercise', () => {
    expect(aliases.length).toBeGreaterThan(0);
    const setupBySlug = new Map(
      catalog.exercises.map((exercise) => [exercise.slug, exercise.cue_card?.setup ?? '']),
    );

    for (const alias of aliases) {
      const setup = alias.cue_card?.setup ?? '';
      expect(setup.length).toBeGreaterThan(0);
      for (const [slug, otherSetup] of setupBySlug) {
        if (slug === alias.slug) continue;
        expect(setup).not.toBe(otherSetup);
      }
    }
  });

  it('Cenário B: every alias has a non-empty slot_category', () => {
    const empty = aliases.filter(
      (exercise) => exercise.slot_category == null || exercise.slot_category === '',
    );
    expect(empty.map((exercise) => exercise.slug)).toEqual([]);
  });

  it('Cenário C: final ABCDE microcycle has no empty slot_category', async () => {
    const plan = await generateDeterministicGameplan({
      focus: { iron: 100, nutrition: 100 },
      equipment: ['full_gym'],
      biological: {
        ...initialBiologicalProfile,
        preferred_split: 'abcde',
        frequency_iron: 5,
        available_time_iron: 90,
        iron_mastery: 5,
        experience_level: 'advanced',
        goal_iron: 'Hypertrophy',
        hormonal_protocol: { ...DEFAULT_HORMONAL_PROTOCOL },
      },
      userStats: { iron_sessions_completed: 0, nutrition_checkins_completed: 0 },
      performanceLogs: [],
      protocolDate: '2026-07-20',
    });

    const empty: string[] = [];
    for (const day of plan.microcycle) {
      for (const block of day.blocks) {
        for (const exercise of block.iron?.exercises ?? []) {
          if (exercise.slot_category == null || exercise.slot_category === '') {
            empty.push(`D${day.day_index}:${exercise.slug}`);
          }
        }
      }
    }
    expect(empty).toEqual([]);
  });
});
