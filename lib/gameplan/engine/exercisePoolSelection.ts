// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import {
  archetypeSlugScore,
  buildDeterministicSeed,
  classifyPullOrientation,
  createSeededRng,
  exerciseAllowedOnIronDay,
  filterPoolForPullCollision,
  reorderBlueprintSlotsForArchetype,
  type DeterministicGenerationContext,
  type PullOrientation,
} from '@/lib/gameplan/engine/generation';
import type { IronDayBlueprintKey } from '@/lib/gameplan/engine/goldStandardBlueprint';
import type { LibraryExercise, MovementPattern } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';

export interface PatternPoolSlot {
  slotId: string;
  /** Primary movement-pattern filter */
  patterns: MovementPattern[];
  /** Optional muscle / name regex — broadens matching */
  musclePattern?: RegExp;
  /** Prefer rows tagged isolation vs compound patterns */
  isolation?: boolean;
}

export const PATTERN_POOL_BLUEPRINT: Record<IronDayBlueprintKey, readonly PatternPoolSlot[]> = {
  push: [
    { slotId: 'chest_compound_a', patterns: ['push'], musclePattern: /chest|pec/i },
    { slotId: 'chest_compound_b', patterns: ['push'], musclePattern: /chest|pec|incline/i },
    { slotId: 'chest_iso', patterns: ['isolation', 'push'], musclePattern: /chest|pec|fly/i, isolation: true },
    { slotId: 'shoulder_compound', patterns: ['push'], musclePattern: /delt|shoulder/i },
    { slotId: 'triceps_iso_a', patterns: ['isolation'], musclePattern: /tricep/i, isolation: true },
    { slotId: 'triceps_iso_b', patterns: ['isolation'], musclePattern: /tricep|pushdown/i, isolation: true },
    { slotId: 'core', patterns: ['isolation', 'squat'], musclePattern: /core|ab|abs|oblique/i, isolation: true },
  ],
  pull: [
    { slotId: 'back_vertical', patterns: ['pull'], musclePattern: /lat|back|pulldown|pull.up/i },
    { slotId: 'back_horizontal', patterns: ['pull'], musclePattern: /back|row|lat/i },
    { slotId: 'rear_delt', patterns: ['isolation', 'pull'], musclePattern: /rear|face.pull|reverse.*fly|dumbbell.reverse/i, isolation: true },
    { slotId: 'biceps_iso_a', patterns: ['isolation'], musclePattern: /bicep|curl/i, isolation: true },
    { slotId: 'biceps_iso_b', patterns: ['isolation'], musclePattern: /bicep|curl|brachialis/i, isolation: true },
    { slotId: 'core', patterns: ['isolation'], musclePattern: /core|ab|abs/i, isolation: true },
  ],
  legs: [
    { slotId: 'quad_a', patterns: ['squat', 'lunge'], musclePattern: /quad|leg|squat/i },
    { slotId: 'quad_b', patterns: ['squat', 'lunge'], musclePattern: /quad|leg|press|lunge/i },
    { slotId: 'hinge_a', patterns: ['hinge'], musclePattern: /ham|glute|hinge|deadlift|rdl/i },
    { slotId: 'hinge_b', patterns: ['hinge', 'isolation'], musclePattern: /ham|leg curl|hinge/i },
    { slotId: 'calves', patterns: ['isolation'], musclePattern: /calf|calves/i, isolation: true },
    { slotId: 'core', patterns: ['isolation'], musclePattern: /core|ab/i, isolation: true },
  ],
  upper: [
    { slotId: 'chest_compound', patterns: ['push'], musclePattern: /chest|pec/i },
    { slotId: 'back_compound', patterns: ['pull'], musclePattern: /back|lat|row/i },
    { slotId: 'shoulder', patterns: ['push'], musclePattern: /delt|shoulder/i },
    { slotId: 'biceps_iso', patterns: ['isolation'], musclePattern: /bicep|curl/i, isolation: true },
    { slotId: 'triceps_iso', patterns: ['isolation'], musclePattern: /tricep/i, isolation: true },
    { slotId: 'core', patterns: ['isolation'], musclePattern: /core|ab/i, isolation: true },
  ],
  lower: [
    { slotId: 'quad_a', patterns: ['squat', 'lunge'] },
    { slotId: 'quad_b', patterns: ['squat', 'lunge'], musclePattern: /quad|press/i },
    { slotId: 'hinge_a', patterns: ['hinge'] },
    { slotId: 'hinge_b', patterns: ['hinge', 'isolation'], musclePattern: /ham|curl/i },
    { slotId: 'calves', patterns: ['isolation'], musclePattern: /calf/i, isolation: true },
    { slotId: 'core', patterns: ['isolation'], musclePattern: /core|ab/i, isolation: true },
  ],
  full: [
    { slotId: 'push_compound', patterns: ['push'], musclePattern: /chest|pec/i },
    { slotId: 'pull_compound', patterns: ['pull'], musclePattern: /back|lat|row/i },
    { slotId: 'leg_compound', patterns: ['squat', 'hinge', 'lunge'] },
    { slotId: 'hinge', patterns: ['hinge'] },
    { slotId: 'carry_finisher', patterns: ['carry', 'isolation'] },
    { slotId: 'core', patterns: ['isolation'], musclePattern: /core|ab/i, isolation: true },
  ],
};

function appliesPullCollisionGuard(dayKey: IronDayBlueprintKey): boolean {
  return dayKey === 'pull' || dayKey === 'upper' || dayKey === 'full';
}

function normalizePattern(value: string | null | undefined): MovementPattern {
  if (!value) return 'isolation';
  const v = value.toLowerCase() as MovementPattern;
  return v;
}

function equipmentMatches(exercise: LibraryExercise, availableEquipment: EquipmentTag[]): boolean {
  if (availableEquipment.length === 0) return false;
  if (exercise.equipment_required.length === 0) return true;
  return exercise.equipment_required.some((tag) => availableEquipment.includes(tag as EquipmentTag));
}

function isEligible(
  row: LibraryExercise,
  equipment: EquipmentTag[],
  blockedJointProfiles: string[],
): boolean {
  return (
    equipmentMatches(row, equipment) &&
    (!row.joint_stress_profile || !blockedJointProfiles.includes(row.joint_stress_profile))
  );
}

function rowMatchesPattern(row: LibraryExercise, patterns: MovementPattern[]): boolean {
  if (patterns.length === 0) return true;
  const pattern = normalizePattern(row.movement_pattern);
  return patterns.includes(pattern);
}

function rowMatchesMuscle(row: LibraryExercise, musclePattern?: RegExp): boolean {
  if (!musclePattern) return true;
  const blob = `${row.primary_muscle ?? ''} ${row.name} ${row.slug}`.toLowerCase();
  return musclePattern.test(blob);
}

function rowMatchesIsolationKind(row: LibraryExercise, isolation?: boolean): boolean {
  if (isolation == null) return true;
  const pattern = normalizePattern(row.movement_pattern);
  const isIso = pattern === 'isolation' || /curl|fly|pushdown|raise|extension|crunch|calf/i.test(row.slug);
  return isolation ? isIso : !isIso || pattern !== 'isolation';
}

function filterPool(
  catalog: LibraryExercise[],
  slot: PatternPoolSlot,
  equipment: EquipmentTag[],
  blocked: string[],
  usedIds: Set<string>,
  dayKey: IronDayBlueprintKey,
  selectedPullOrientations: readonly PullOrientation[],
): LibraryExercise[] {
  const base = catalog.filter((row) => {
    if (usedIds.has(row.id)) return false;
    if (!isEligible(row, equipment, blocked)) return false;
    if (!exerciseAllowedOnIronDay(row, dayKey)) return false;
    if (!rowMatchesPattern(row, slot.patterns)) return false;
    if (!rowMatchesMuscle(row, slot.musclePattern)) return false;
    if (!rowMatchesIsolationKind(row, slot.isolation)) return false;
    return true;
  });

  if (!appliesPullCollisionGuard(dayKey)) return base;
  return filterPoolForPullCollision(base, slot.slotId, selectedPullOrientations);
}

export function pickSeededFromPool(
  pool: LibraryExercise[],
  generation: DeterministicGenerationContext,
  slotIndex: number,
): LibraryExercise | undefined {
  if (pool.length === 0) return undefined;

  const slotSeed = (buildDeterministicSeed(generation) + slotIndex * 9973) >>> 0;
  const rng = createSeededRng(slotSeed);

  const ranked = [...pool].sort((a, b) => {
    const scoreA = archetypeSlugScore(a.slug) + rng() * 0.01;
    const scoreB = archetypeSlugScore(b.slug) + rng() * 0.01;
    return scoreB - scoreA;
  });

  return ranked[0];
}

export function selectExercisesFromPatternPools(
  dayKey: IronDayBlueprintKey,
  catalog: LibraryExercise[],
  equipment: EquipmentTag[],
  targetCount: number,
  blockedJointProfiles: string[],
  generation: DeterministicGenerationContext,
): string[] {
  const blueprint = PATTERN_POOL_BLUEPRINT[dayKey] ?? PATTERN_POOL_BLUEPRINT.full;
  const biasedSlots = reorderBlueprintSlotsForArchetype([...blueprint], null);
  const slots = biasedSlots.slice(0, Math.max(1, targetCount));

  const usedIds = new Set<string>();
  const selected: string[] = [];
  const selectedPullOrientations: PullOrientation[] = [];

  slots.forEach((slot, slotIndex) => {
    const pool = filterPool(
      catalog,
      slot,
      equipment,
      blockedJointProfiles,
      usedIds,
      dayKey,
      selectedPullOrientations,
    );
    const pick = pickSeededFromPool(pool, generation, slotIndex);
    if (!pick) return;

    selected.push(pick.id);
    usedIds.add(pick.id);

    if (appliesPullCollisionGuard(dayKey)) {
      const orientation = classifyPullOrientation(pick);
      if (orientation && !selectedPullOrientations.includes(orientation)) {
        selectedPullOrientations.push(orientation);
      }
    }
  });

  return selected;
}
