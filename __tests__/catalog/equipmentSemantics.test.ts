import { describe, expect, it } from 'vitest';

import { ELITE_EXERCISES } from '@/lib/catalog/eliteCatalog';
import { equipmentMatches } from '@/lib/gameplan/engine/periodization';
import type { LibraryExercise } from '@/types/catalog';

function bySlug(slug: string): LibraryExercise {
  const row = ELITE_EXERCISES.find((exercise) => exercise.slug === slug);
  if (!row) throw new Error(`Missing elite exercise: ${slug}`);
  return row;
}

describe('equipment semantics', () => {
  it('Cenário A: full_gym → push_up (bodyweight-only) is eligible', () => {
    const pushUp = bySlug('push_up');
    expect(pushUp.equipment_required).toEqual(['bodyweight']);
    expect(equipmentMatches(pushUp, ['full_gym'])).toBe(true);
  });

  it('Cenário B: dumbbells-only → full_gym-only exercise is NOT eligible', () => {
    const machine = bySlug('hack_squat_machine');
    expect(machine.equipment_required).toEqual(['full_gym']);
    expect(equipmentMatches(machine, ['dumbbells'])).toBe(false);
  });

  it('Cenário C: bodyweight → push_up eligible; machine NOT', () => {
    expect(equipmentMatches(bySlug('push_up'), ['bodyweight'])).toBe(true);
    expect(equipmentMatches(bySlug('hack_squat_machine'), ['bodyweight'])).toBe(false);
  });
});
