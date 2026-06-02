import { scoreExerciseCandidate } from '@/lib/gameplan/engine/iron/ConstraintSolver';
import { PPL_DAY_SLOTS } from '@/lib/gameplan/engine/iron/splits/pplSplit';
import { classifyShoulderRegion } from '@/lib/gameplan/engine/iron/taxonomy/shoulderRegions';
import {
  MRV_HARD,
  type WeeklyVolumeTracker,
} from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import type {
  CatalogExercise,
  CoherenceReport,
  CoherenceViolation,
  ExerciseCatalog,
  MicrocycleDayPlan,
  MicrocyclePick,
  SolverConstraints,
  SolverSlot,
  SplitDayKey,
} from '@/lib/gameplan/engine/iron/types';
import type { EquipmentTag } from '@/store/useSommaStore';

/** Gold rule — lateral + posterior shoulder volume vs anterior (weekly sets). */
export const SHOULDER_BALANCE_RATIO = 0.6;

export const PUSH_PULL_RATIO_MIN = 0.85;
export const PUSH_PULL_RATIO_MAX = 1.15;

const MAX_CORRECTION_ROUNDS = 3;

const FLEXIBLE_RATIO_SLOT_IDS = new Set(['chest_iso', 'chest_compound_b', 'triceps_b']);

const SHOULDER_FIX_PRIMARY_MUSCLES = new Set(['side_delts', 'rear_delts']);

const VIOLATION_FIX_ORDER: CoherenceViolation['code'][] = [
  'WEEKLY_MRV_EXCEEDED',
  'SHOULDER_IMBALANCE',
  'PUSH_PULL_RATIO',
  'MISSING_PATTERN',
];

export function cloneMicrocycle(microcycle: readonly MicrocycleDayPlan[]): MicrocycleDayPlan[] {
  return microcycle.map((day) => ({
    day: day.day,
    picks: day.picks.map((pick) => ({ ...pick })),
  }));
}

/** Credits every pick in the draft microcycle onto the tracker (idempotent for tests / post-solve). */
export function syncMicrocycleToTracker(
  tracker: WeeklyVolumeTracker,
  catalog: ExerciseCatalog,
  microcycle: readonly MicrocycleDayPlan[],
): void {
  for (const day of microcycle) {
    for (const pick of day.picks) {
      const exercise = catalog.byId.get(pick.exerciseId);
      if (!exercise) continue;
      tracker.creditVolume(exercise, pick.prescribedSets);
    }
  }
}

function findSlotDefinition(day: SplitDayKey, slotId: string): SolverSlot | undefined {
  return PPL_DAY_SLOTS[day].find((slot) => slot.slotId === slotId);
}

function equipmentSubsetAllowed(
  exercise: CatalogExercise,
  available: readonly EquipmentTag[],
): boolean {
  if (available.length === 0) return false;
  if (exercise.equipment_required.length === 0) return true;
  return exercise.equipment_required.some((tag) => available.includes(tag as EquipmentTag));
}

function jointProfileAllowed(
  exercise: CatalogExercise,
  blockedJointProfiles: readonly string[],
): boolean {
  if (!exercise.joint_stress_profile) return true;
  return !blockedJointProfiles.includes(exercise.joint_stress_profile);
}

import { matchesMuscleSlotHint } from '@/lib/gameplan/engine/iron/taxonomy/muscleSlotHints';

function matchesSlot(
  exercise: CatalogExercise,
  slot: SolverSlot,
): boolean {
  if (!slot.requiredPatterns.includes(exercise.movement_pattern)) return false;
  if (!matchesMuscleSlotHint(exercise, slot.primaryMuscleHint)) return false;
  if (slot.isolationOnly && exercise.movement_pattern !== 'isolation') return false;
  return true;
}

function isHorizontalPush(exercise: CatalogExercise): boolean {
  if (exercise.movement_pattern !== 'push') return false;
  return /bench|fly_flat|close_grip|dip|push_up|chest_press/i.test(exercise.slug);
}

function isVerticalPush(exercise: CatalogExercise): boolean {
  if (exercise.movement_pattern !== 'push') return false;
  return /overhead|incline|landmine|shoulder_press|military/i.test(exercise.slug);
}

function isVerticalPull(exercise: CatalogExercise): boolean {
  if (exercise.movement_pattern !== 'pull') return false;
  return /pulldown|pull_up|pull.up|chin/i.test(exercise.slug);
}

function isHorizontalPull(exercise: CatalogExercise): boolean {
  if (exercise.movement_pattern !== 'pull') return false;
  return /row|t_bar|pendlay/i.test(exercise.slug);
}

function sumShoulderRegions(
  microcycle: readonly MicrocycleDayPlan[],
  catalog: ExerciseCatalog,
): { anterior: number; lateral: number; posterior: number } {
  const totals = { anterior: 0, lateral: 0, posterior: 0 };

  for (const day of microcycle) {
    for (const pick of day.picks) {
      const exercise = catalog.byId.get(pick.exerciseId);
      if (!exercise) continue;
      const region = classifyShoulderRegion(exercise);
      if (!region) continue;
      totals[region] += pick.prescribedSets;
    }
  }

  return totals;
}

function countChestBackSets(
  microcycle: readonly MicrocycleDayPlan[],
  catalog: ExerciseCatalog,
): { chest: number; back: number } {
  let chest = 0;
  let back = 0;

  for (const day of microcycle) {
    for (const pick of day.picks) {
      const exercise = catalog.byId.get(pick.exerciseId);
      if (!exercise) continue;

      if (exercise.primary_muscle === 'chest' || exercise.primary_muscle === 'upper_chest') {
        chest += pick.prescribedSets;
      }
      if (
        exercise.primary_muscle === 'back' ||
        exercise.primary_muscle === 'lats' ||
        exercise.primary_muscle === 'mid_back'
      ) {
        back += pick.prescribedSets;
      }
    }
  }

  return { chest, back };
}

function countMovementPatternSets(
  microcycle: readonly MicrocycleDayPlan[],
  catalog: ExerciseCatalog,
  pattern: 'push' | 'pull',
): number {
  let total = 0;
  for (const day of microcycle) {
    for (const pick of day.picks) {
      const exercise = catalog.byId.get(pick.exerciseId);
      if (!exercise || exercise.movement_pattern !== pattern) continue;
      total += pick.prescribedSets;
    }
  }
  return total;
}

function checkMissingPatterns(
  microcycle: readonly MicrocycleDayPlan[],
  catalog: ExerciseCatalog,
): CoherenceViolation[] {
  const violations: CoherenceViolation[] = [];

  for (const dayPlan of microcycle) {
    const exercises = dayPlan.picks
      .map((pick) => catalog.byId.get(pick.exerciseId))
      .filter((row): row is CatalogExercise => row != null);

    if (dayPlan.day === 'push') {
      const hasHorizontal = exercises.some(isHorizontalPush);
      const hasVertical = exercises.some(isVerticalPush);
      if (!hasHorizontal || !hasVertical) {
        violations.push({
          code: 'MISSING_PATTERN',
          severity: 'error',
          detail: `Push day missing ${!hasHorizontal ? 'horizontal' : ''}${!hasHorizontal && !hasVertical ? ' and ' : ''}${!hasVertical ? 'vertical' : ''} press pattern`,
        });
      }
    }

    if (dayPlan.day === 'pull') {
      const hasVertical = exercises.some(isVerticalPull);
      const hasHorizontal = exercises.some(isHorizontalPull);
      if (!hasVertical || !hasHorizontal) {
        violations.push({
          code: 'MISSING_PATTERN',
          severity: 'error',
          detail: `Pull day missing ${!hasVertical ? 'vertical' : ''}${!hasVertical && !hasHorizontal ? ' and ' : ''}${!hasHorizontal ? 'horizontal' : ''} pull pattern`,
        });
      }
    }
  }

  return violations;
}

function checkShoulderBalance(
  microcycle: readonly MicrocycleDayPlan[],
  catalog: ExerciseCatalog,
): CoherenceViolation | null {
  const { anterior, lateral, posterior } = sumShoulderRegions(microcycle, catalog);
  if (anterior <= 0) return null;

  const rearSupport = lateral + posterior;
  if (rearSupport >= SHOULDER_BALANCE_RATIO * anterior) return null;

  return {
    code: 'SHOULDER_IMBALANCE',
    severity: 'error',
    detail: `Shoulder 3D: (lateral ${lateral} + posterior ${posterior}) = ${rearSupport} < ${SHOULDER_BALANCE_RATIO} × anterior ${anterior}`,
  };
}

function checkPushPullRatio(
  microcycle: readonly MicrocycleDayPlan[],
  catalog: ExerciseCatalog,
): CoherenceViolation | null {
  const { chest, back } = countChestBackSets(microcycle, catalog);
  if (chest === 0 && back === 0) return null;

  const hasPullDay = microcycle.some((day) => day.day === 'pull' && day.picks.length > 0);
  if (!hasPullDay) return null;

  if (back === 0) {
    return {
      code: 'PUSH_PULL_RATIO',
      severity: 'error',
      detail: `Push/Pull ratio undefined — chest ${chest} sets, back 0 sets`,
    };
  }

  const ratio = chest / back;
  if (ratio >= PUSH_PULL_RATIO_MIN && ratio <= PUSH_PULL_RATIO_MAX) return null;

  const pushSets = countMovementPatternSets(microcycle, catalog, 'push');
  const pullSets = countMovementPatternSets(microcycle, catalog, 'pull');

  return {
    code: 'PUSH_PULL_RATIO',
    severity: 'error',
    detail: `Push/Pull ratio ${ratio.toFixed(2)} outside [${PUSH_PULL_RATIO_MIN}, ${PUSH_PULL_RATIO_MAX}] (chest ${chest} / back ${back}, push ${pushSets} / pull ${pullSets})`,
  };
}

function checkWeeklyMrv(tracker: WeeklyVolumeTracker): CoherenceViolation[] {
  const violations: CoherenceViolation[] = [];

  for (const [muscle, volume] of tracker.snapshot.byMuscle) {
    if (volume > MRV_HARD) {
      violations.push({
        code: 'WEEKLY_MRV_EXCEEDED',
        severity: 'error',
        detail: `${muscle} at ${volume.toFixed(1)} effective weekly sets (MRV hard ${MRV_HARD})`,
      });
    }
  }

  return violations.sort((a, b) => a.detail.localeCompare(b.detail));
}

/**
 * Post-generation audit — gold laws for PPL microcycles.
 */
export function validateMicrocycleCoherence(
  microcycle: readonly MicrocycleDayPlan[],
  catalog: ExerciseCatalog,
  _constraints: SolverConstraints,
  tracker: WeeklyVolumeTracker,
): CoherenceReport {
  const violations: CoherenceViolation[] = [
    ...checkMissingPatterns(microcycle, catalog),
  ];

  const shoulderViolation = checkShoulderBalance(microcycle, catalog);
  if (shoulderViolation) violations.push(shoulderViolation);

  const ratioViolation = checkPushPullRatio(microcycle, catalog);
  if (ratioViolation) violations.push(ratioViolation);

  violations.push(...checkWeeklyMrv(tracker));

  return {
    ok: violations.length === 0,
    violations,
    swaps: [],
  };
}

function listSlotCandidates(
  catalog: ExerciseCatalog,
  slot: SolverSlot,
  constraints: SolverConstraints,
  excludeIds: ReadonlySet<string>,
  tracker: WeeklyVolumeTracker,
  sets: number,
): CatalogExercise[] {
  const candidates: CatalogExercise[] = [];

  for (const exercise of catalog.exercises) {
    if (excludeIds.has(exercise.id)) continue;
    if (!matchesSlot(exercise, slot)) continue;
    if (!equipmentSubsetAllowed(exercise, constraints.equipment)) continue;
    if (!jointProfileAllowed(exercise, constraints.blockedJointProfiles)) continue;
    if (!tracker.canAddSets(exercise, sets).allowed) continue;
    candidates.push(exercise);
  }

  return candidates.sort((a, b) => {
    const scoreA = scoreExerciseCandidate(a, tracker);
    const scoreB = scoreExerciseCandidate(b, tracker);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.slug.localeCompare(b.slug);
  });
}

function usedExerciseIds(microcycle: readonly MicrocycleDayPlan[]): Set<string> {
  const ids = new Set<string>();
  for (const day of microcycle) {
    for (const pick of day.picks) {
      ids.add(pick.exerciseId);
    }
  }
  return ids;
}

function matchesSlotOrFlexibleRatio(exercise: CatalogExercise, slot: SolverSlot): boolean {
  if (FLEXIBLE_RATIO_SLOT_IDS.has(slot.slotId)) {
    const pullBack =
      exercise.movement_pattern === 'pull' &&
      (exercise.primary_muscle === 'back' ||
        exercise.primary_muscle === 'lats' ||
        exercise.primary_muscle === 'mid_back');
    if (pullBack) return true;
  }
  return matchesSlot(exercise, slot);
}

function trySwapPick(
  microcycle: MicrocycleDayPlan[],
  day: SplitDayKey,
  pickIndex: number,
  replacement: CatalogExercise,
  sets: number,
  catalog: ExerciseCatalog,
  constraints: SolverConstraints,
  tracker: WeeklyVolumeTracker,
): boolean {
  const dayPlan = microcycle.find((row) => row.day === day);
  if (!dayPlan) return false;

  const pick = dayPlan.picks[pickIndex];
  if (!pick) return false;

  const slot = findSlotDefinition(day, pick.slotId);
  if (!slot || !matchesSlotOrFlexibleRatio(replacement, slot)) return false;

  const incumbent = catalog.byId.get(pick.exerciseId);
  if (!incumbent) return false;

  const originalSets = pick.prescribedSets;
  const before = validateMicrocycleCoherence(microcycle, catalog, constraints, tracker);

  tracker.debitVolume(incumbent, originalSets);
  if (!tracker.canAddSets(replacement, sets).allowed) {
    tracker.creditVolume(incumbent, originalSets);
    return false;
  }

  pick.exerciseId = replacement.id;
  pick.prescribedSets = sets;
  tracker.creditVolume(replacement, sets);

  const after = validateMicrocycleCoherence(microcycle, catalog, constraints, tracker);

  const introducedMrv =
    !before.violations.some((v) => v.code === 'WEEKLY_MRV_EXCEEDED') &&
    after.violations.some((v) => v.code === 'WEEKLY_MRV_EXCEEDED');

  const shoulderWorsened =
    before.violations.every((v) => v.code !== 'SHOULDER_IMBALANCE') &&
    after.violations.some((v) => v.code === 'SHOULDER_IMBALANCE');

  const improved = after.ok || after.violations.length < before.violations.length;

  if (introducedMrv || shoulderWorsened || !improved) {
    tracker.debitVolume(replacement, sets);
    pick.exerciseId = incumbent.id;
    pick.prescribedSets = originalSets;
    tracker.creditVolume(incumbent, originalSets);
    return false;
  }

  return true;
}

function fixShoulderImbalance(
  microcycle: MicrocycleDayPlan[],
  catalog: ExerciseCatalog,
  constraints: SolverConstraints,
  tracker: WeeklyVolumeTracker,
  swaps: { fromExerciseId: string; toExerciseId: string; reason: string }[],
): boolean {
  const pushDay = microcycle.find((row) => row.day === 'push');
  if (!pushDay) return false;

  const lateralSlot = PPL_DAY_SLOTS.push.find((slot) => slot.slotId === 'shoulder_lateral');
  if (!lateralSlot) return false;

  const shoulderTotals = sumShoulderRegions(microcycle, catalog);
  const lateralPosteriorDeficit =
    shoulderTotals.anterior > 0
      ? Math.ceil(SHOULDER_BALANCE_RATIO * shoulderTotals.anterior) -
        (shoulderTotals.lateral + shoulderTotals.posterior)
      : 0;

  const exclude = usedExerciseIds(microcycle);
  const targetSets = Math.max(lateralSlot.defaultSets, lateralPosteriorDeficit);

  if (lateralPosteriorDeficit > 0) {
    // If the slot already exists, prefer increasing volume (do not swap or delete compounds like OHP).
    const existingIndex = pushDay.picks.findIndex((pick) => pick.slotId === 'shoulder_lateral');
    if (existingIndex !== -1) {
      const existing = pushDay.picks[existingIndex]!;
      const existingExercise = catalog.byId.get(existing.exerciseId);
      if (existingExercise && SHOULDER_FIX_PRIMARY_MUSCLES.has(existingExercise.primary_muscle)) {
        // Deficit is expressed in additional lateral+posterior sets needed.
        const add = Math.max(0, lateralPosteriorDeficit);
        if (add <= 0) return true;
        if (!tracker.canAddSets(existingExercise, add).allowed) return false;
        tracker.creditVolume(existingExercise, add);
        existing.prescribedSets += add;
        swaps.push({
          fromExerciseId: existingExercise.id,
          toExerciseId: existingExercise.id,
          reason: 'SHOULDER_IMBALANCE',
        });
        return true;
      }
    }

    const candidates = listSlotCandidates(
      catalog,
      lateralSlot,
      constraints,
      exclude,
      tracker,
      targetSets,
    ).filter((exercise) => SHOULDER_FIX_PRIMARY_MUSCLES.has(exercise.primary_muscle));

    const replacement = candidates[0];
    if (!replacement) return false;

    const emptySlotIndex = pushDay.picks.findIndex((pick) => pick.slotId === 'shoulder_lateral');
    if (emptySlotIndex === -1) {
      if (!tracker.canAddSets(replacement, targetSets).allowed) return false;
      tracker.creditVolume(replacement, targetSets);
      pushDay.picks.push({
        slotId: 'shoulder_lateral',
        exerciseId: replacement.id,
        prescribedSets: targetSets,
      });
      swaps.push({
        fromExerciseId: '',
        toExerciseId: replacement.id,
        reason: 'SHOULDER_IMBALANCE',
      });
      return true;
    }

    const fromId = pushDay.picks[emptySlotIndex]!.exerciseId;
    if (trySwapPick(microcycle, 'push', emptySlotIndex, replacement, targetSets, catalog, constraints, tracker)) {
      swaps.push({ fromExerciseId: fromId, toExerciseId: replacement.id, reason: 'SHOULDER_IMBALANCE' });
      return true;
    }
    return false;
  }

  const pullDay = microcycle.find((row) => row.day === 'pull');
  const rearSlot = PPL_DAY_SLOTS.pull.find((slot) => slot.slotId === 'rear_delt');
  if (pullDay && rearSlot) {
    const hasRear = pullDay.picks.some((pick) => {
      const exercise = catalog.byId.get(pick.exerciseId);
      return exercise?.primary_muscle === 'rear_delts';
    });
    if (!hasRear) {
      const rearCandidates = listSlotCandidates(
        catalog,
        rearSlot,
        constraints,
        exclude,
        tracker,
        rearSlot.defaultSets,
      ).filter((exercise) => exercise.primary_muscle === 'rear_delts');

      const rearExercise = rearCandidates[0];
      if (rearExercise && tracker.canAddSets(rearExercise, rearSlot.defaultSets).allowed) {
        tracker.creditVolume(rearExercise, rearSlot.defaultSets);
        pullDay.picks.push({
          slotId: 'rear_delt',
          exerciseId: rearExercise.id,
          prescribedSets: rearSlot.defaultSets,
        });
        swaps.push({
          fromExerciseId: '',
          toExerciseId: rearExercise.id,
          reason: 'SHOULDER_IMBALANCE',
        });
        return true;
      }
    }
  }

  return false;
}

function fixPushPullRatio(
  microcycle: MicrocycleDayPlan[],
  catalog: ExerciseCatalog,
  constraints: SolverConstraints,
  tracker: WeeklyVolumeTracker,
  swaps: { fromExerciseId: string; toExerciseId: string; reason: string }[],
): boolean {
  const { chest, back } = countChestBackSets(microcycle, catalog);
  if (back === 0) return false;

  let ratio = chest / back;
  if (ratio >= PUSH_PULL_RATIO_MIN && ratio <= PUSH_PULL_RATIO_MAX) return false;

  const pushDay = microcycle.find((row) => row.day === 'push');
  if (!pushDay) return false;

  if (ratio > PUSH_PULL_RATIO_MAX) {
    const chestPicks = pushDay.picks
      .map((pick, index) => ({ pick, index, exercise: catalog.byId.get(pick.exerciseId) }))
      .filter(
        (row): row is { pick: MicrocyclePick; index: number; exercise: CatalogExercise } =>
          row.exercise != null &&
          (row.exercise.primary_muscle === 'chest' || row.exercise.primary_muscle === 'upper_chest'),
      )
      .sort((a, b) => {
        if (FLEXIBLE_RATIO_SLOT_IDS.has(a.pick.slotId) !== FLEXIBLE_RATIO_SLOT_IDS.has(b.pick.slotId)) {
          return FLEXIBLE_RATIO_SLOT_IDS.has(a.pick.slotId) ? -1 : 1;
        }
        return b.pick.prescribedSets - a.pick.prescribedSets;
      });

    let reducedAny = false;
    for (let pass = 0; pass < 12 && ratio > PUSH_PULL_RATIO_MAX; pass += 1) {
      let reducedThisPass = false;

      for (const { pick, exercise } of chestPicks) {
        if (ratio <= PUSH_PULL_RATIO_MAX) break;
        if (pick.prescribedSets <= 2) continue;

        const before = validateMicrocycleCoherence(microcycle, catalog, constraints, tracker);
        tracker.debitVolume(exercise, 1);
        pick.prescribedSets -= 1;
        reducedThisPass = true;
        reducedAny = true;

        const after = validateMicrocycleCoherence(microcycle, catalog, constraints, tracker);
        const next = countChestBackSets(microcycle, catalog);
        ratio = next.back > 0 ? next.chest / next.back : ratio;

        if (
          after.violations.some((v) => v.code === 'WEEKLY_MRV_EXCEEDED') &&
          !before.violations.some((v) => v.code === 'WEEKLY_MRV_EXCEEDED')
        ) {
          pick.prescribedSets += 1;
          tracker.creditVolume(exercise, 1);
          reducedThisPass = false;
          reducedAny = false;
          continue;
        }
      }

      if (!reducedThisPass) break;
    }

    if (reducedAny && ratio >= PUSH_PULL_RATIO_MIN && ratio <= PUSH_PULL_RATIO_MAX) {
      swaps.push({
        fromExerciseId: 'chest_volume_trim',
        toExerciseId: 'chest_volume_trim',
        reason: 'PUSH_PULL_RATIO',
      });
      return true;
    }

  }

  return false;
}

function fixMissingPattern(
  microcycle: MicrocycleDayPlan[],
  catalog: ExerciseCatalog,
  constraints: SolverConstraints,
  tracker: WeeklyVolumeTracker,
  swaps: { fromExerciseId: string; toExerciseId: string; reason: string }[],
  violation: CoherenceViolation,
): boolean {
  const targetDay: SplitDayKey = violation.detail.includes('Pull') ? 'pull' : 'push';
  const dayPlan = microcycle.find((row) => row.day === targetDay);
  if (!dayPlan) return false;

  const needHorizontal = violation.detail.includes('horizontal');
  const needVertical = violation.detail.includes('vertical');

  const replacement = catalog.exercises
    .filter((exercise) => {
      if (targetDay === 'push') {
        if (needHorizontal && !isHorizontalPush(exercise)) return false;
        if (needVertical && !isVerticalPush(exercise)) return false;
        return exercise.movement_pattern === 'push';
      }
      if (needHorizontal && !isHorizontalPull(exercise)) return false;
      if (needVertical && !isVerticalPull(exercise)) return false;
      return exercise.movement_pattern === 'pull';
    })
    .filter(
      (exercise) =>
        equipmentSubsetAllowed(exercise, constraints.equipment) &&
        jointProfileAllowed(exercise, constraints.blockedJointProfiles),
    )
    .sort((a, b) => a.slug.localeCompare(b.slug))[0];

  if (!replacement) return false;

  // Prefer to ADD a missing pattern as a supplement rather than swapping out foundational compounds.
  // This avoids deleting key movements like `overhead_press` and keeps the session "elite dense".
  const supplementSlotId =
    targetDay === 'push'
      ? `pattern_${needVertical ? 'vertical' : 'horizontal'}_press_supplement`
      : `pattern_${needVertical ? 'vertical' : 'horizontal'}_pull_supplement`;

  const alreadyPresent = dayPlan.picks.some((pick) => pick.exerciseId === replacement.id);

  if (alreadyPresent) return false;

  const sets = Math.max(3, replacement.default_sets);
  if (!tracker.canAddSets(replacement, sets).allowed) return false;
  tracker.creditVolume(replacement, sets);
  dayPlan.picks.push({
    slotId: supplementSlotId,
    exerciseId: replacement.id,
    prescribedSets: sets,
  });
  swaps.push({ fromExerciseId: '', toExerciseId: replacement.id, reason: 'MISSING_PATTERN' });
  return true;
}

function fixWeeklyMrv(
  microcycle: MicrocycleDayPlan[],
  catalog: ExerciseCatalog,
  constraints: SolverConstraints,
  tracker: WeeklyVolumeTracker,
  swaps: { fromExerciseId: string; toExerciseId: string; reason: string }[],
): boolean {
  for (const dayPlan of microcycle) {
    for (let index = dayPlan.picks.length - 1; index >= 0; index -= 1) {
      const pick = dayPlan.picks[index]!;
      const exercise = catalog.byId.get(pick.exerciseId);
      if (!exercise || pick.prescribedSets <= 2) continue;

      const overloaded = [...tracker.snapshot.byMuscle.entries()].some(
        ([muscle, volume]) =>
          volume > MRV_HARD &&
          (muscle === exercise.primary_muscle ||
            exercise.synergist_muscles.includes(muscle)),
      );

      if (!overloaded) continue;

      const before = validateMicrocycleCoherence(microcycle, catalog, constraints, tracker);
      tracker.debitVolume(exercise, 1);
      pick.prescribedSets -= 1;

      const after = validateMicrocycleCoherence(microcycle, catalog, constraints, tracker);
      if (
        after.violations.some((v) => v.code === 'WEEKLY_MRV_EXCEEDED') &&
        !before.violations.some((v) => v.code === 'WEEKLY_MRV_EXCEEDED')
      ) {
        pick.prescribedSets += 1;
        tracker.creditVolume(exercise, 1);
        continue;
      }

      swaps.push({
        fromExerciseId: exercise.id,
        toExerciseId: exercise.id,
        reason: 'WEEKLY_MRV_EXCEEDED',
      });
      return true;
    }
  }

  return false;
}

function fixViolation(
  microcycle: MicrocycleDayPlan[],
  violation: CoherenceViolation,
  catalog: ExerciseCatalog,
  constraints: SolverConstraints,
  tracker: WeeklyVolumeTracker,
  swaps: { fromExerciseId: string; toExerciseId: string; reason: string }[],
): boolean {
  switch (violation.code) {
    case 'SHOULDER_IMBALANCE':
      return fixShoulderImbalance(microcycle, catalog, constraints, tracker, swaps);
    case 'PUSH_PULL_RATIO':
      return fixPushPullRatio(microcycle, catalog, constraints, tracker, swaps);
    case 'MISSING_PATTERN':
      return fixMissingPattern(microcycle, catalog, constraints, tracker, swaps, violation);
    case 'WEEKLY_MRV_EXCEEDED':
      return fixWeeklyMrv(microcycle, catalog, constraints, tracker, swaps);
    default:
      return false;
  }
}

/**
 * Deterministic post-audit — up to 3 correction rounds, no RNG.
 * Mutates `microcycle` and `tracker` in place.
 */
export function autoCorrectMicrocycle(
  microcycle: MicrocycleDayPlan[],
  catalog: ExerciseCatalog,
  constraints: SolverConstraints,
  tracker: WeeklyVolumeTracker,
): CoherenceReport {
  const swaps: { fromExerciseId: string; toExerciseId: string; reason: string }[] = [];

  for (let round = 0; round < MAX_CORRECTION_ROUNDS; round += 1) {
    const report = validateMicrocycleCoherence(microcycle, catalog, constraints, tracker);
    if (report.ok) {
      return { ok: true, violations: [], swaps };
    }

    const ordered = [...report.violations].sort(
      (a, b) => VIOLATION_FIX_ORDER.indexOf(a.code) - VIOLATION_FIX_ORDER.indexOf(b.code),
    );

    let fixed = false;
    for (const violation of ordered) {
      if (fixViolation(microcycle, violation, catalog, constraints, tracker, swaps)) {
        fixed = true;
        break;
      }
    }

    if (!fixed) break;
  }

  const finalReport = validateMicrocycleCoherence(microcycle, catalog, constraints, tracker);
  return { ...finalReport, swaps };
}
