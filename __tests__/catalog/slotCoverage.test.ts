import { describe, expect, it } from 'vitest';

import { getBundledExercises } from '@/lib/catalog/bundledCatalog';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import {
  bodyweightExerciseAllowed,
  matchesSlotCategory,
} from '@/lib/gameplan/engine/iron/ConstraintSolver';
import type { CatalogExercise, ExerciseCatalog, SolverSlot } from '@/lib/gameplan/engine/iron/types';
import { resolveAbcdeDayTemplate } from '@/lib/gameplan/engine/iron/splits/abcdeSplit';
import { resolvePplDayTemplate } from '@/lib/gameplan/engine/iron/splits/pplSplit';
import { matchesMuscleSlotHint } from '@/lib/gameplan/engine/iron/taxonomy/muscleSlotHints';
import type { EquipmentTag } from '@/store/useSommaStore';

const MIN_CANDIDATES = 3;

const EQUIPMENT_PROFILES: { label: string; equipment: readonly EquipmentTag[] }[] = [
  { label: 'bodyweight', equipment: ['bodyweight'] },
  { label: 'dumbbells', equipment: ['dumbbells', 'bodyweight'] },
  { label: 'full_gym', equipment: ['full_gym', 'barbell', 'dumbbells', 'bodyweight', 'pull_up_bar'] },
];

function equipmentAllowed(
  exercise: CatalogExercise,
  available: readonly EquipmentTag[],
): boolean {
  if (available.length === 0) return false;
  if (exercise.equipment_required.length === 0) return true;
  return exercise.equipment_required.some((tag) => available.includes(tag as EquipmentTag));
}

/** Lightweight eligibility — pattern + hint + isolation + category + equipment (no CNS/MRV). */
export function countEligibleForSlot(
  catalog: ExerciseCatalog,
  slot: SolverSlot,
  equipment: readonly EquipmentTag[],
): number {
  let count = 0;
  for (const exercise of catalog.exercises) {
    if (!equipmentAllowed(exercise, equipment)) continue;
    if (!bodyweightExerciseAllowed(exercise, equipment)) continue;
    if (!slot.requiredPatterns.includes(exercise.movement_pattern)) continue;
    if (!matchesMuscleSlotHint(exercise, slot.primaryMuscleHint)) continue;
    if (slot.isolationOnly && exercise.movement_pattern !== 'isolation') continue;
    if (!matchesSlotCategory(exercise, slot.category)) continue;
    count += 1;
  }
  return count;
}

describe('CI Slot-Coverage Guard', () => {
  const catalog = buildExerciseCatalog(getBundledExercises(), {
    includeStarvationAliases: true,
  });

  it('every ABCDE + PPL slot has ≥3 eligible candidates per equipment profile', () => {
    const failures: string[] = [];

    for (let ironSlot = 0; ironSlot < 5; ironSlot += 1) {
      const template = resolveAbcdeDayTemplate(ironSlot);
      for (const profile of EQUIPMENT_PROFILES) {
        for (const slot of template.slots) {
          const n = countEligibleForSlot(catalog, slot, profile.equipment);
          if (n < MIN_CANDIDATES) {
            failures.push(
              `ABCDE[${ironSlot}] ${template.focusLabel} · ${profile.label} · ${slot.slotId} (${slot.category ?? 'n/a'}): ${n}`,
            );
          }
        }
      }
    }

    for (let ironSlot = 0; ironSlot < 6; ironSlot += 1) {
      const template = resolvePplDayTemplate(ironSlot);
      for (const profile of EQUIPMENT_PROFILES) {
        for (const slot of template.slots) {
          const daySlot: SolverSlot = { ...slot, day: template.splitDay };
          const n = countEligibleForSlot(catalog, daySlot, profile.equipment);
          if (n < MIN_CANDIDATES) {
            failures.push(
              `PPL[${ironSlot}] ${template.variant} · ${profile.label} · ${slot.slotId}: ${n}`,
            );
          }
        }
      }
    }

    if (failures.length > 0) {
      console.error('\n[slotCoverage] starvation failures:\n' + failures.join('\n'));
    }
    expect(failures).toEqual([]);
  });
});
