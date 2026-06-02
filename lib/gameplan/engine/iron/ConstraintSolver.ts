import {
  MEV,
  MRV_HARD,
  MRV_SOFT,
  type WeeklyVolumeTracker,
} from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import { classifyShoulderRegion } from '@/lib/gameplan/engine/iron/taxonomy/shoulderRegions';
import { matchesMuscleSlotHint } from '@/lib/gameplan/engine/iron/taxonomy/muscleSlotHints';
import type { IronMovementPattern } from '@/lib/gameplan/engine/iron/taxonomy/movementPatterns';
import type {
  CatalogExercise,
  ExerciseCatalog,
  ShoulderVolumeLedger,
  SolverConstraints,
  SolverResult,
  SolverSlot,
  SolverState,
  SplitDayKey,
  SynergistLoadMatrix,
  WeeklyVolumeSnapshot,
} from '@/lib/gameplan/engine/iron/types';
import type { EquipmentTag } from '@/store/useSommaStore';

/** Head-coach session CNS budget defaults when passport omits a cap. */
export const DEFAULT_MAX_SESSION_CNS = 15;

const SCORE_MEV_BOOST = 1000;
const SCORE_MRV_SOFT_PENALTY = 800;
const SCORE_SYNERGIST_OVERLAP_PENALTY = 400;
const SCORE_CNS_PENALTY = 50;
const SCORE_MASTERY_COMPLEXITY_BONUS = 60;

const TOO_BASIC_FOR_ADVANCED = new Set([
  'goblet_squat',
  'push_up',
  'lat_pulldown',
]);

export function createInitialSolverState(tracker: WeeklyVolumeTracker): SolverState {
  const synergistLoad: SynergistLoadMatrix = {
    byMuscle: new Map(tracker.snapshot.byMuscle),
  };

  return {
    usedExerciseIds: new Set<string>(),
    weeklyVolume: tracker.snapshot,
    synergistLoad,
    sessionCnsAccum: 0,
    shoulderSets: { anterior: 0, lateral: 0, posterior: 0 },
  };
}

function cloneWeeklySnapshot(tracker: WeeklyVolumeTracker): WeeklyVolumeSnapshot {
  return {
    byMuscle: new Map(tracker.snapshot.byMuscle),
    mev: tracker.snapshot.mev,
    mrvSoft: tracker.snapshot.mrvSoft,
    mrvHard: tracker.snapshot.mrvHard,
  };
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

function matchesMovementPattern(
  exercise: CatalogExercise,
  requiredPatterns: readonly IronMovementPattern[],
): boolean {
  return requiredPatterns.includes(exercise.movement_pattern);
}

function matchesPrimaryMuscleHint(exercise: CatalogExercise, hint: string | undefined): boolean {
  return matchesMuscleSlotHint(exercise, hint);
}

function matchesIsolationSlot(exercise: CatalogExercise, isolationOnly: boolean | undefined): boolean {
  if (!isolationOnly) return true;
  return exercise.movement_pattern === 'isolation';
}

function synergistOverlapLoad(
  exercise: CatalogExercise,
  tracker: WeeklyVolumeTracker,
): number {
  let overlap = 0;
  for (const synergist of exercise.synergist_muscles) {
    overlap += tracker.completedSetsForMuscle(synergist);
  }
  return overlap;
}

/**
 * Heuristic score — higher is better. Auditable coach rules:
 * - Prioritize muscles still below MEV (+1000).
 * - Deprioritize primary muscles in the MRV soft zone (+18–20) (−800).
 * - Penalize redundant synergist fatigue (−400 × accumulated synergist effective sets).
 * - Penalize high CNS cost (−50 × cost).
 */
export function scoreExerciseCandidate(
  exercise: CatalogExercise,
  tracker: WeeklyVolumeTracker,
  constraints?: Pick<SolverConstraints, 'iron_mastery'>,
): number {
  let score = 0;

  const primaryVolume = tracker.completedSetsForMuscle(exercise.primary_muscle);
  if (primaryVolume < MEV) {
    score += SCORE_MEV_BOOST;
  } else if (primaryVolume > MRV_SOFT && primaryVolume <= MRV_HARD) {
    score += SCORE_MRV_SOFT_PENALTY;
  }

  const overlap = synergistOverlapLoad(exercise, tracker);
  score -= SCORE_SYNERGIST_OVERLAP_PENALTY * overlap;

  score -= SCORE_CNS_PENALTY * exercise.cns_fatigue_cost;

  const mastery = constraints?.iron_mastery ?? 3;
  const diff = Math.abs(mastery - exercise.complexity_level);
  score += SCORE_MASTERY_COMPLEXITY_BONUS * Math.max(0, 3 - diff);

  return score;
}

function compareCandidates(a: CatalogExercise, b: CatalogExercise, scoreA: number, scoreB: number): number {
  if (scoreB !== scoreA) return scoreB - scoreA;
  return a.slug.localeCompare(b.slug);
}

function applyShoulderLedger(
  ledger: ShoulderVolumeLedger,
  exercise: CatalogExercise,
  sets: number,
): ShoulderVolumeLedger {
  const region = classifyShoulderRegion(exercise);
  if (!region) return ledger;

  return {
    ...ledger,
    [region]: ledger[region] + sets,
  };
}

function collectCandidates(
  catalog: ExerciseCatalog,
  slot: SolverSlot,
  constraints: SolverConstraints,
  state: SolverState,
  tracker: WeeklyVolumeTracker,
  allowUsedReuse: boolean,
): CatalogExercise[] {
  const candidates: CatalogExercise[] = [];

  for (const exercise of catalog.exercises) {
    if (state.usedExerciseIds.has(exercise.id) && !allowUsedReuse) continue;
    if (!matchesMovementPattern(exercise, slot.requiredPatterns)) continue;
    if (!matchesPrimaryMuscleHint(exercise, slot.primaryMuscleHint)) continue;
    if (!matchesIsolationSlot(exercise, slot.isolationOnly)) continue;
    if (constraints.iron_mastery >= 4) {
      if (TOO_BASIC_FOR_ADVANCED.has(exercise.slug)) continue;
      // Elite athletes still use "basic" isolations as finishers; filter only for non-isolation compounds/patterns.
      if (exercise.movement_pattern !== 'isolation' && exercise.complexity_level <= 2) continue;
    }
    if (!equipmentSubsetAllowed(exercise, constraints.equipment)) continue;
    if (!jointProfileAllowed(exercise, constraints.blockedJointProfiles)) continue;

    const setsToAdd = slot.defaultSets;
    // Traps are often under-counted as a "synergist" across many movements; Pull B needs an explicit traps slot.
    // Allow the slot even near MRV; coherence can trim later if needed.
    if (slot.slotId !== 'traps' && !tracker.canAddSets(exercise, setsToAdd).allowed) continue;

    if (state.sessionCnsAccum + exercise.cns_fatigue_cost > constraints.maxSessionCns) continue;

    candidates.push(exercise);
  }

  return candidates;
}

function pickBestCandidate(
  candidates: CatalogExercise[],
  tracker: WeeklyVolumeTracker,
  constraints: SolverConstraints,
): { exercise: CatalogExercise; score: number } | null {
  if (candidates.length === 0) return null;

  let best = candidates[0]!;
  let bestScore = scoreExerciseCandidate(best, tracker, constraints);

  for (let i = 1; i < candidates.length; i += 1) {
    const candidate = candidates[i]!;
    const candidateScore = scoreExerciseCandidate(candidate, tracker, constraints);
    if (compareCandidates(candidate, best, candidateScore, bestScore) < 0) {
      best = candidate;
      bestScore = candidateScore;
    }
  }

  return { exercise: best, score: bestScore };
}

/**
 * Deterministic slot filler — no RNG. Mutates `tracker` and returns an updated `SolverState`.
 */
export function solveDaySlots(
  _day: SplitDayKey,
  slots: readonly SolverSlot[],
  catalog: ExerciseCatalog,
  constraints: SolverConstraints,
  initialState: SolverState,
  tracker: WeeklyVolumeTracker,
): { picks: readonly SolverResult[]; state: SolverState } {
  const usedExerciseIds = new Set(initialState.usedExerciseIds);
  let sessionCnsAccum = initialState.sessionCnsAccum;
  let shoulderSets = { ...initialState.shoulderSets };
  const picks: SolverResult[] = [];

  for (const slot of slots) {
    let candidates = collectCandidates(catalog, slot, constraints, {
      ...initialState,
      usedExerciseIds,
      sessionCnsAccum,
    }, tracker, false);

    if (candidates.length === 0) {
      candidates = collectCandidates(catalog, slot, constraints, {
        ...initialState,
        usedExerciseIds,
        sessionCnsAccum,
      }, tracker, true);
    }

    const selection = pickBestCandidate(candidates, tracker, constraints);
    if (!selection) continue;

    const { exercise, score } = selection;
    const prescribedSets = slot.defaultSets;

    tracker.creditVolume(exercise, prescribedSets);
    usedExerciseIds.add(exercise.id);
    sessionCnsAccum += exercise.cns_fatigue_cost;
    shoulderSets = applyShoulderLedger(shoulderSets, exercise, prescribedSets);

    picks.push({
      slotId: slot.slotId,
      exerciseId: exercise.id,
      prescribedSets,
      score,
    });
  }

  const weeklyVolume = cloneWeeklySnapshot(tracker);
  const synergistLoad: SynergistLoadMatrix = {
    byMuscle: new Map(weeklyVolume.byMuscle),
  };

  return {
    picks,
    state: {
      usedExerciseIds,
      weeklyVolume,
      synergistLoad,
      sessionCnsAccum,
      shoulderSets,
    },
  };
}
