// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import { spreadTrainingDayIndices } from '@/lib/gameplan/microcycleWeek';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import type { BiologicalProfile, PreferredSplit } from '@/types/biological';
import {
  clampPillarFrequency,
  clampTrainingDaysPerWeek,
  deriveTrainingDaysFromFrequencies,
  normalizePreferredSplit,
} from '@/types/biological';
import { ABCDE_IRON_DAY_INDICES } from '@/lib/gameplan/engine/iron/splits/abcdeSplit';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';

import { MICROCYCLE_FOCUS_ROTATIONS } from '@/lib/gameplan/engine/constants';
import type { DeterministicGenerationContext } from '@/lib/gameplan/engine/generation';
import { selectExercisesByIronBlueprint } from '@/lib/gameplan/engine/ironBlueprints';
import { maxIronExercisesForMinutes } from '@/lib/gameplan/engine/volumePruning';
import {
  BIOMECH_SLUG_CHEST_OPENER,
  BIOMECH_SLUG_MALASANA,
} from '@/lib/gameplan/engine/clinicalLaws';

export interface PillarFrequency {
  frequency_iron: number;
}

/** Law III — Effective Hypertrophy Zone upper bound (weekly working sets per muscle) */
export const HYPERTROPHY_WEEKLY_SERIES_MAX = 20;

export function resolvePillarFrequencies(biological: BiologicalProfile): PillarFrequency {
  const legacy = clampTrainingDaysPerWeek(biological.training_days_per_week ?? 4);
  return {
    frequency_iron: clampPillarFrequency(biological.frequency_iron, legacy),
  };
}

export function spreadPillarDayIndices(
  count: number,
  preferredSplit?: PreferredSplit | null,
): number[] {
  const split = normalizePreferredSplit(preferredSplit);
  if (split === 'abcde' && count === 5) return [...ABCDE_IRON_DAY_INDICES];
  if (count === 6) return [1, 2, 3, 4, 5, 6];
  return spreadTrainingDayIndices(count);
}

export function focusLabelForIronSlot(trainingDaysPerWeek: number, slot: number): string {
  const rotation =
    MICROCYCLE_FOCUS_ROTATIONS[clampTrainingDaysPerWeek(trainingDaysPerWeek)] ??
    MICROCYCLE_FOCUS_ROTATIONS[4]!;
  const ironLabels = rotation.filter((label) => label.startsWith('Iron:'));
  if (ironLabels.length > 0) {
    return ironLabels[slot % ironLabels.length]!;
  }
  return rotation[slot % rotation.length] ?? 'Iron: Full Body';
}

export function deriveActiveTrainingDays(pillarFreq: PillarFrequency): number {
  return deriveTrainingDaysFromFrequencies({
    frequency_iron: pillarFreq.frequency_iron,
  });
}

export function isHypertrophyGoal(goalIron: string | null): boolean {
  const normalized = (goalIron ?? '').trim().toLowerCase();
  return (
    normalized.includes('hypertrophy') ||
    normalized.includes('powerbuilding') ||
    normalized.includes('volume')
  );
}

export function targetIronExerciseCount(minutes: number, goalIron: string | null = null): number {
  const { cap } = maxIronExercisesForMinutes(minutes);

  let target: number;
  if (isHypertrophyGoal(goalIron)) {
    if (minutes <= 30) target = 3;
    else if (minutes <= 45) target = 4;
    else target = 6;
  } else if (minutes <= 30) {
    target = 3;
  } else if (minutes <= 45) {
    target = 4;
  } else {
    target = 6;
  }

  return Math.min(cap, target);
}

export function equipmentMatches(exercise: LibraryExercise, availableEquipment: EquipmentTag[]): boolean {
  if (availableEquipment.length === 0) return false;
  if (exercise.equipment_required.length === 0) return true;
  return exercise.equipment_required.some((tag) => availableEquipment.includes(tag as EquipmentTag));
}

function setsFromLog(log: EnginePerformanceRow): number {
  const fromPayload = log.payload?.iron?.sets?.length;
  if (fromPayload != null && fromPayload > 0) return fromPayload;
  return 1;
}

/** Law III — rolling 7-day working set count for a muscle group */
export function calculateWeeklyVolume(
  muscleGroup: string,
  ironLogs7d: EnginePerformanceRow[],
  catalog: LibraryExercise[],
  pendingSessionSets = 0,
): number {
  const normalized = muscleGroup.toLowerCase();
  let total = pendingSessionSets;

  for (const log of ironLogs7d) {
    const exerciseId = log.payload?.iron?.exercise_id ?? log.exercise_id;
    if (!exerciseId) continue;
    const meta = catalog.find((row) => row.id === exerciseId);
    const primary = (meta?.primary_muscle ?? '').toLowerCase();
    if (primary !== normalized) continue;
    total += setsFromLog(log);
  }

  return total;
}

export function buildWeeklyVolumeMap(
  ironLogs7d: EnginePerformanceRow[],
  catalog: LibraryExercise[],
): Map<string, number> {
  const muscles = new Set(
    catalog.map((row) => row.primary_muscle).filter(Boolean) as string[],
  );

  const map = new Map<string, number>();
  for (const muscle of muscles) {
    map.set(muscle, calculateWeeklyVolume(muscle, ironLogs7d, catalog));
  }
  return map;
}

/** When weekly series exceed the hypertrophy zone, drop 1 set per exercise in-session */
export function applyHypertrophyVolumeGuardrail(
  sets: number,
  primaryMuscle: string | null,
  weeklyVolumeMap: Map<string, number>,
  exerciseSetsInSession: number,
): { sets: number; volumeNote: string } {
  if (!primaryMuscle) return { sets, volumeNote: '' };

  const weeklySeries = (weeklyVolumeMap.get(primaryMuscle) ?? 0) + exerciseSetsInSession;
  if (weeklySeries <= HYPERTROPHY_WEEKLY_SERIES_MAX) {
    return { sets, volumeNote: '' };
  }

  const reduced = Math.max(2, sets - 1);
  return {
    sets: reduced,
    volumeNote: `Hypertrophy guard — ${primaryMuscle} ${weeklySeries} sets/7d (> ${HYPERTROPHY_WEEKLY_SERIES_MAX})`,
  };
}

/** Inject Phase-1 iron exercises ONLY for biomechanical prerequisites (never generic warmups) */
export function injectPrerequisiteIronExercises(
  exerciseIds: string[],
  catalog: LibraryExercise[],
  prerequisiteSlugs: string[],
  equipment: EquipmentTag[],
  blockedJointProfiles: string[],
): string[] {
  if (prerequisiteSlugs.length === 0) return exerciseIds;

  const allowed = new Set([BIOMECH_SLUG_MALASANA, BIOMECH_SLUG_CHEST_OPENER]);
  const prepended: string[] = [];
  const used = new Set(exerciseIds);

  for (const slug of prerequisiteSlugs) {
    if (!allowed.has(slug)) continue;
    const row = catalog.find(
      (entry) =>
        entry.slug === slug &&
        equipmentMatches(entry, equipment) &&
        (!entry.joint_stress_profile || !blockedJointProfiles.includes(entry.joint_stress_profile)),
    );
    if (!row || used.has(row.id)) continue;
    prepended.push(row.id);
    used.add(row.id);
  }

  return [...prepended, ...exerciseIds.filter((id) => !prepended.includes(id))];
}

/** Precision Blueprint only — no greedy fallback */
export function selectExercisesForSplit(
  focusLabel: string,
  catalog: LibraryExercise[],
  equipment: EquipmentTag[],
  targetCount: number,
  blockedJointProfiles: string[],
  generation: DeterministicGenerationContext,
): string[] {
  return selectExercisesByIronBlueprint(
    focusLabel,
    catalog,
    equipment,
    targetCount,
    blockedJointProfiles,
    generation,
  );
}

export function expandRoutineIdsForTime(
  routineIds: string[],
  catalog: LibraryExercise[],
  targetCount: number,
): string[] {
  return routineIds.slice(0, targetCount);
}

export function archetypeVolumeCapAdjustment(
  _archetype: null,
  primaryMuscle: string | null,
): number {
  if (!primaryMuscle) return 0;

  const muscle = primaryMuscle.toLowerCase();
  if (muscle === 'deltoids' || muscle === 'shoulders' || muscle === 'side_delts') return 4;
  if (muscle === 'lats' || muscle === 'latissimus dorsi' || muscle === 'back') return 4;
  if (muscle === 'rear deltoid' || muscle === 'rear_delts') return 3;
  return 0;
}

export function archetypeExerciseCountDelta(_archetype: null): number {
  return 1;
}

export function archetypeRirDelta(_archetype: null): number {
  return 0;
}
