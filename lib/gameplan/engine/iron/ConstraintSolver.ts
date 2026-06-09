import {
  MEV,
  MRV_HARD,
  MRV_SOFT,
  type WeeklyVolumeTracker,
} from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import { supportsAdvancedMetabolicTechnique } from '@/lib/catalog/tacticalEnrichment';
import { classifyShoulderRegion } from '@/lib/gameplan/engine/iron/taxonomy/shoulderRegions';
import { matchesMuscleSlotHint } from '@/lib/gameplan/engine/iron/taxonomy/muscleSlotHints';
import { isXFrameBlacklisted } from '@/lib/gameplan/engine/iron/xFrameBias';
import {
  calculateVolumeBudget,
  isCompoundExercise,
  resolveEffectiveMesocyclePhase,
  type VolumeBudget,
  type VolumeExecutionTechnique,
} from '@/lib/gameplan/engine/iron/volumePeriodization';
import type { IronMovementPattern } from '@/lib/gameplan/engine/iron/taxonomy/movementPatterns';
import type {
  CatalogExercise,
  ExerciseCatalog,
  IntensityTechnique,
  ShoulderVolumeLedger,
  SolverConstraints,
  SolverResult,
  SolverSlot,
  SolverState,
  SplitDayKey,
  SynergistLoadMatrix,
  TechniqueParams,
  WeeklyVolumeSnapshot,
} from '@/lib/gameplan/engine/iron/types';
import { computeRestSecondsFromCns } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';

/** Head-coach session CNS budget defaults when passport omits a cap. */
export const DEFAULT_MAX_SESSION_CNS = 15;

const SCORE_MEV_BOOST = 1000;
const SCORE_X_FRAME_WEIGHT = 1000;
const SCORE_RULE_1_MEV_BOOST = 2000;
const SCORE_MRV_SOFT_PENALTY = 800;
const SCORE_SYNERGIST_OVERLAP_PENALTY = 500;
const SCORE_CNS_PENALTY = 100;
const SCORE_MASTERY_COMPLEXITY_BONUS = 60;
const SCORE_REPEAT_COMPOUND_PENALTY = 350;
const SCORE_CONSECUTIVE_AXIAL_PENALTY = 1000;
const SCORE_DUP_MATCH_BONUS = 650;
const SCORE_RECOVERY_LOW_STABILITY_BOOST = 12000;
const SCORE_RECOVERY_MEDIUM_STABILITY_BOOST = 1500;
const SCORE_RECOVERY_HIGH_STABILITY_PENALTY = 2500;
const HIGH_CNS_FATIGUE_SCORE = 70;
const MAX_DAILY_AXIAL_LOAD = 6;
const FINISHER_MIN_REMAINING_SECONDS = 5 * 60;
const MINIMUM_VIABLE_WORKOUT_EXERCISE_COUNT = 2;
const MINIMUM_VIABLE_WORKOUT_SETS = 2;
const MINIMUM_FULL_WORKOUT_EXERCISE_COUNT = 4;

function minimumViableDiagnosticReason(constraints: SolverConstraints): string {
  return constraints.blockedJointProfiles.length > 0
    ? 'injury_constraint'
    : 'minimum_viable_path_absolute_last_resort';
}

const TOO_BASIC_FOR_ADVANCED = new Set([
  'goblet_squat',
  'push_up',
  'lat_pulldown',
]);

function solverDebugEnabled(): boolean {
  return typeof process !== 'undefined' && process.env.SOMMA_SOLVER_DEBUG === '1';
}

function logCandidateRejection(slot: SolverSlot, exercise: CatalogExercise, reason: string): void {
  if (!solverDebugEnabled()) return;
  console.log(
    `[SOMMA][ConstraintSolver] Rejeitado: ${exercise.name} (${exercise.slug}) | Slot: ${slot.slotId} | Motivo: ${reason}`,
  );
}

const AXIAL_LOAD_SLUGS = new Set([
  'barbell_back_squat',
  'conventional_deadlift',
  'rack_pull',
  'barbell_romanian_deadlift',
]);

function resolveFinisherHints(day: SplitDayKey, slots: readonly SolverSlot[]): readonly string[] {
  if (day === 'push') {
    const isShoulderFocus = slots.some((slot) => slot.slotId === 'overhead_press' && slot.defaultSets >= 4);
    return isShoulderFocus
      ? ['rear_delts', 'side_delts', 'triceps', 'upper_chest', 'chest']
      : ['upper_chest', 'chest', 'triceps', 'side_delts'];
  }

  if (day === 'pull') {
    // Traps are reserved for the explicit Pull B thickness slot; do not consume dumbbell_shrug early as filler.
    return ['rear_delts', 'back', 'biceps'];
  }

  const isPosteriorFocus = slots.some((slot) => slot.slotId === 'hinge_primary');
  return isPosteriorFocus ? ['hamstrings', 'glutes', 'calves'] : ['quads', 'calves'];
}

const FINISHER_TECHNIQUE: {
  intensity_technique: IntensityTechnique;
  technique_params: TechniqueParams;
} = {
  intensity_technique: 'myo_reps',
  technique_params: {
    activationReps: 15,
    miniSets: 3,
    miniSetReps: 5,
    intraSetRestSeconds: 20,
    note: 'Low-CNS finisher to spend remaining time budget without axial fatigue.',
  },
};

export function createInitialSolverState(tracker: WeeklyVolumeTracker): SolverState {
  const synergistLoad: SynergistLoadMatrix = {
    byMuscle: new Map(tracker.snapshot.byMuscle),
  };

  return {
    usedExerciseIds: new Set<string>(),
    weeklyVolume: tracker.snapshot,
    synergistLoad,
    isRecoveryMode: tracker.isRecoveryMode,
    sessionCnsAccum: 0,
    sessionAxialLoad: 0,
    shoulderSets: { anterior: 0, lateral: 0, posterior: 0 },
    previousDayIndex: null,
    previousDayHadAxialLoad: false,
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

export function isAxialLoadExercise(exercise: CatalogExercise): boolean {
  return (exercise.axial_loading ?? 0) >= 3 || exercise.joint_stress_profile === 'spinal_axial_load' || AXIAL_LOAD_SLUGS.has(exercise.slug);
}

function isLumbarShearExercise(exercise: CatalogExercise): boolean {
  return exercise.joint_stress_profile === 'lumbar_shear';
}

function isLoadedObliqueExercise(exercise: CatalogExercise): boolean {
  const primary = exercise.primary_muscle.toLowerCase();
  const slug = exercise.slug.toLowerCase();
  return (
    primary === 'obliques' &&
    (exercise.equipment_required.length > 0 ||
      slug.includes('weighted') ||
      slug.includes('cable') ||
      slug.includes('dumbbell'))
  );
}

function isHiitLegConflictExercise(day: SplitDayKey, exercise: CatalogExercise, constraints: SolverConstraints): boolean {
  return (
    day === 'legs' &&
    constraints.previousDayWasHiit === true &&
    (exercise.movement_pattern === 'squat' ||
      exercise.movement_pattern === 'hinge' ||
      exercise.movement_pattern === 'lunge')
  );
}

function isConsecutiveAfterPreviousTrainingDay(state: SolverState, currentDayIndex: number | undefined): boolean {
  if (currentDayIndex == null || state.previousDayIndex == null) return false;
  return currentDayIndex - state.previousDayIndex === 1;
}

function createsConsecutiveAxialLoad(
  exercise: CatalogExercise,
  state: SolverState,
  currentDayIndex: number | undefined,
): boolean {
  return (
    isAxialLoadExercise(exercise) &&
    state.previousDayHadAxialLoad &&
    isConsecutiveAfterPreviousTrainingDay(state, currentDayIndex)
  );
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

function dupFocusBonus(exercise: CatalogExercise, constraints?: Pick<SolverConstraints, 'dailyIronFocus'>): number {
  const focus = constraints?.dailyIronFocus?.focus;
  if (!focus) return 0;

  // Regra 5.1: Legs A favors high-threshold compounds for pure mechanical tension.
  if (focus === 'pure_mechanical_tension') {
    const isHeavyCompound =
      (exercise.movement_pattern === 'squat' || exercise.movement_pattern === 'hinge') &&
      exercise.cns_fatigue_cost >= 3;
    return isHeavyCompound ? SCORE_DUP_MATCH_BONUS : 0;
  }

  // Regra 5.1: Legs B shifts to unilateral/stability and lower systemic cost.
  if (focus === 'unilateral_stability') {
    const slug = exercise.slug.toLowerCase();
    const isUnilateral =
      exercise.movement_pattern === 'lunge' ||
      slug.includes('single_leg') ||
      slug.includes('bulgarian') ||
      slug.includes('split_squat');
    const lowCns = exercise.cns_fatigue_cost <= 3;
    return isUnilateral || lowCns ? SCORE_DUP_MATCH_BONUS : 0;
  }

  // Regra 5.1: Stretch days bias exercises already marked for stretch-mediated hypertrophy.
  if (focus === 'stretch_mediated') {
    return exercise.stretch_mediated_hypertrophy ? SCORE_DUP_MATCH_BONUS : 0;
  }

  return 0;
}

function isHighFatigueContext(
  tracker: WeeklyVolumeTracker,
  state: Pick<SolverState, 'isRecoveryMode'> | undefined,
  constraints?: Pick<SolverConstraints, 'cns_fatigue_score'>,
): boolean {
  return (
    tracker.isRecoveryMode ||
    state?.isRecoveryMode === true ||
    (constraints?.cns_fatigue_score ?? 0) >= HIGH_CNS_FATIGUE_SCORE
  );
}

function recoveryStabilityScore(exercise: CatalogExercise): number {
  if (exercise.stability_demand === 'low') return SCORE_RECOVERY_LOW_STABILITY_BOOST;
  if (exercise.stability_demand === 'medium') return SCORE_RECOVERY_MEDIUM_STABILITY_BOOST;
  if (exercise.stability_demand === 'high') return -SCORE_RECOVERY_HIGH_STABILITY_PENALTY;
  return 0;
}

function advancedTechniqueAllowed(
  technique: IntensityTechnique | undefined,
  exercise: CatalogExercise,
): boolean {
  if (technique !== 'myo_reps' && technique !== 'drop_set') return true;
  return supportsAdvancedMetabolicTechnique(exercise);
}

function projectedAxialLoadAllowed(exercise: CatalogExercise, state: Pick<SolverState, 'sessionAxialLoad'>): boolean {
  const axialLoading = exercise.axial_loading ?? (isAxialLoadExercise(exercise) ? 3 : 0);
  if (axialLoading < 3) return true;
  return state.sessionAxialLoad + axialLoading <= MAX_DAILY_AXIAL_LOAD;
}

function tacticalOrderRank(exercise: CatalogExercise): number {
  switch (exercise.tactical_role) {
    case 'primary_compound':
      return 0;
    case 'secondary_compound':
      return 1;
    case 'pre_exhaust':
      return 2;
    case 'isolation_metabolic':
      return 3;
    case 'corrective':
      return 4;
    default:
      return exercise.movement_pattern === 'isolation' ? 3 : 1;
  }
}

/**
 * Heuristic score — higher is better. Auditable coach rules:
 * - Regra 1.1: X-Frame priority dominates selection (+selection_score × 1000).
 * - Regra 1.1/2: muscles below MEV get a deterministic rescue boost (+2000).
 * - Regra 2.2: redundant synergist fatigue is penalized (−500 × accumulated effective sets).
 * - Regra 2.2: high CNS cost is penalized (−100 × cost).
 */
export function scoreExerciseCandidate(
  exercise: CatalogExercise,
  tracker: WeeklyVolumeTracker,
  constraints?: Pick<SolverConstraints, 'iron_mastery' | 'dailyIronFocus' | 'cns_fatigue_score'>,
  state?: Pick<SolverState, 'usedExerciseIds' | 'previousDayHadAxialLoad' | 'previousDayIndex' | 'isRecoveryMode'>,
  currentDayIndex?: number,
): number {
  let score = exercise.selection_score * SCORE_X_FRAME_WEIGHT;

  const primaryVolume = tracker.completedSetsForMuscle(exercise.primary_muscle);
  if (primaryVolume < MEV) {
    score += SCORE_RULE_1_MEV_BOOST;
  } else if (primaryVolume > MRV_SOFT && primaryVolume <= MRV_HARD) {
    score -= SCORE_MRV_SOFT_PENALTY;
  }

  const overlap = synergistOverlapLoad(exercise, tracker);
  score -= SCORE_SYNERGIST_OVERLAP_PENALTY * overlap;

  score -= SCORE_CNS_PENALTY * exercise.cns_fatigue_cost;
  score += dupFocusBonus(exercise, constraints);

  if (isHighFatigueContext(tracker, state, constraints)) {
    score += recoveryStabilityScore(exercise);
  }

  if (state?.usedExerciseIds.has(exercise.id)) {
    score -= SCORE_REPEAT_COMPOUND_PENALTY;
  }

  if (state && createsConsecutiveAxialLoad(exercise, state as SolverState, currentDayIndex)) {
    score -= SCORE_CONSECUTIVE_AXIAL_PENALTY;
  }

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

function solverTechniqueFromBudget(technique: VolumeExecutionTechnique | undefined): IntensityTechnique | undefined {
  if (!technique || technique === 'Standard') return undefined;
  if (technique === 'Myo-Reps') return 'myo_reps';
  if (technique === 'Drop-Set') return 'drop_set';
  return 'rest_pause';
}

function volumeBudgetForExercise(
  exercise: CatalogExercise,
  constraints: Pick<SolverConstraints, 'mesocycle_phase' | 'mesocycle_week' | 'cns_fatigue_score'>,
): { budget: VolumeBudget; phase: ReturnType<typeof resolveEffectiveMesocyclePhase> } {
  const phase = resolveEffectiveMesocyclePhase(constraints.mesocycle_phase, constraints.mesocycle_week);
  return {
    phase,
    budget: calculateVolumeBudget(
      exercise,
      phase,
      isCompoundExercise(exercise),
      constraints.cns_fatigue_score ?? 0,
    ),
  };
}

function prescribedSetsForSlot(
  slot: SolverSlot,
  exercise: CatalogExercise,
  constraints: Pick<SolverConstraints, 'mesocycle_phase' | 'mesocycle_week' | 'cns_fatigue_score'>,
): { prescribedSets: number; budget: VolumeBudget; phase: ReturnType<typeof resolveEffectiveMesocyclePhase> } {
  const requestedSets = Math.max(0, slot.defaultSets);
  const { budget, phase } = volumeBudgetForExercise(exercise, constraints);
  const prescribedSets = Math.min(Math.max(budget.minSets, requestedSets), budget.maxSets);
  return { prescribedSets, budget, phase };
}

function diagnosticReasonForPrescribedSets(
  slot: SolverSlot,
  exercise: CatalogExercise,
  prescribedSets: number,
  phase: ReturnType<typeof resolveEffectiveMesocyclePhase>,
  budget: VolumeBudget,
  explicitReason?: string,
): string | undefined {
  if (explicitReason) return explicitReason;
  if (prescribedSets >= slot.defaultSets) return undefined;
  if (prescribedSets === budget.maxSets) return `volume_budget_max_${phase}`;
  return 'solver_volume_reduction';
}

function collectCandidates(
  day: SplitDayKey,
  catalog: ExerciseCatalog,
  slot: SolverSlot,
  constraints: SolverConstraints,
  state: SolverState,
  tracker: WeeklyVolumeTracker,
  currentDayIndex: number | undefined,
  options: {
    ignoreCnsBudget?: boolean;
    ignoreMastery?: boolean;
    ignoreMrv?: boolean;
    ignoreRecoveryMode?: boolean;
  } = {},
): CatalogExercise[] {
  const candidates: CatalogExercise[] = [];

  for (const exercise of catalog.exercises) {
    const usedExerciseIds = new Set([
      ...state.usedExerciseIds,
      ...(constraints.usedExerciseIds ?? []),
    ]);

    // Regra 4 / anti-duplicata: exact repeats are blocked deterministically.
    if (usedExerciseIds.has(exercise.id)) {
      logCandidateRejection(slot, exercise, 'exercício já usado no microciclo');
      continue;
    }
    if (!matchesMovementPattern(exercise, slot.requiredPatterns)) {
      logCandidateRejection(slot, exercise, `padrão ${exercise.movement_pattern} não atende ${slot.requiredPatterns.join('/')}`);
      continue;
    }
    if (!matchesPrimaryMuscleHint(exercise, slot.primaryMuscleHint)) {
      logCandidateRejection(slot, exercise, `músculo ${exercise.primary_muscle} não atende hint ${slot.primaryMuscleHint ?? 'n/a'}`);
      continue;
    }
    if (!matchesIsolationSlot(exercise, slot.isolationOnly)) {
      logCandidateRejection(slot, exercise, 'slot exige isolamento');
      continue;
    }
    if (!options.ignoreMastery && constraints.iron_mastery >= 4) {
      if (TOO_BASIC_FOR_ADVANCED.has(exercise.slug)) {
        logCandidateRejection(slot, exercise, 'exercício básico demais para atleta avançado');
        continue;
      }
      // Elite athletes still use "basic" isolations as finishers; filter only for non-isolation compounds/patterns.
      if (exercise.movement_pattern !== 'isolation' && exercise.complexity_level <= 2) {
        logCandidateRejection(slot, exercise, `complexidade ${exercise.complexity_level} baixa para mastery ${constraints.iron_mastery}`);
        continue;
      }
    }
    // Regra 4 hard filter: required equipment must be fully available.
    if (!equipmentSubsetAllowed(exercise, constraints.available_equipment ?? constraints.equipment)) {
      logCandidateRejection(
        slot,
        exercise,
        `equipamento incompatível; requer um de [${exercise.equipment_required.join(', ')}]`,
      );
      continue;
    }
    if (!jointProfileAllowed(exercise, constraints.blockedJointProfiles)) {
      logCandidateRejection(slot, exercise, `perfil articular bloqueado: ${exercise.joint_stress_profile}`);
      continue;
    }

    if (!advancedTechniqueAllowed(slot.intensity_technique, exercise)) {
      logCandidateRejection(slot, exercise, `técnica ${slot.intensity_technique} exige baixa estabilidade ou resistência constante`);
      continue;
    }

    if (!projectedAxialLoadAllowed(exercise, state)) {
      logCandidateRejection(
        slot,
        exercise,
        `proteção lombar bloqueia carga axial diária ${state.sessionAxialLoad} + ${exercise.axial_loading ?? 3}`,
      );
      continue;
    }

    if (createsConsecutiveAxialLoad(exercise, state, currentDayIndex)) {
      logCandidateRejection(slot, exercise, 'carga axial em dias consecutivos');
      continue;
    }

    // Regra 1.3: deterministic waist-protection blacklist.
    if (isXFrameBlacklisted(exercise) || isLoadedObliqueExercise(exercise)) {
      logCandidateRejection(slot, exercise, 'blacklist X-Frame/oblíquo carregado');
      continue;
    }

    // Regra 2.4: HIIT before legs blocks high-fatigue lower-body patterns.
    if (isHiitLegConflictExercise(day, exercise, constraints)) {
      logCandidateRejection(slot, exercise, 'conflito de pernas após HIIT');
      continue;
    }

    // Regra 2.2/2.3: recovery mode blocks spinal stress, while scoring strongly favors stable machines/cables.
    if (
      !options.ignoreRecoveryMode &&
      isHighFatigueContext(tracker, state, constraints) &&
      ((exercise.axial_loading ?? 0) >= 3 || isLumbarShearExercise(exercise))
    ) {
      logCandidateRejection(slot, exercise, 'recovery/high fatigue bloqueia axial alto/lumbar shear');
      continue;
    }

    const { prescribedSets: setsToAdd } = prescribedSetsForSlot(slot, exercise, constraints);
    const volumeCheck = tracker.canAddSets(exercise, setsToAdd);
    if (!options.ignoreMrv && !volumeCheck.allowed) {
      logCandidateRejection(slot, exercise, volumeCheck.reason ?? 'MRV_HARD atingido');
      continue;
    }

    if (!options.ignoreCnsBudget && state.sessionCnsAccum + exercise.cns_fatigue_cost > constraints.maxSessionCns) {
      logCandidateRejection(
        slot,
        exercise,
        `CNS Fatigue Cost muito alto (${state.sessionCnsAccum} + ${exercise.cns_fatigue_cost} > ${constraints.maxSessionCns})`,
      );
      continue;
    }

    candidates.push(exercise);
  }

  return candidates;
}

function pickBestCandidate(
  candidates: CatalogExercise[],
  tracker: WeeklyVolumeTracker,
  constraints: SolverConstraints,
  state: SolverState,
  currentDayIndex: number | undefined,
  slot?: SolverSlot,
): { exercise: CatalogExercise; score: number } | null {
  if (candidates.length === 0) return null;

  if (slot?.slotId === 'overhead_press') {
    const overheadPress = candidates.find((candidate) => candidate.slug === 'overhead_press');
    if (overheadPress) {
      return {
        exercise: overheadPress,
        score: scoreExerciseCandidate(overheadPress, tracker, constraints, state, currentDayIndex),
      };
    }
  }

  if (slot?.slotId === 'chest_compound_a') {
    const benchPress = candidates.find((candidate) => candidate.slug === 'barbell_bench_press');
    if (benchPress) {
      return {
        exercise: benchPress,
        score: scoreExerciseCandidate(benchPress, tracker, constraints, state, currentDayIndex),
      };
    }
  }

  let best = candidates[0]!;
  let bestScore = scoreExerciseCandidate(best, tracker, constraints, state, currentDayIndex);

  for (let i = 1; i < candidates.length; i += 1) {
    const candidate = candidates[i]!;
    const candidateScore = scoreExerciseCandidate(candidate, tracker, constraints, state, currentDayIndex);
    if (compareCandidates(candidate, best, candidateScore, bestScore) < 0) {
      best = candidate;
      bestScore = candidateScore;
    }
  }

  return { exercise: best, score: bestScore };
}

export function estimateSessionSeconds(
  picks: readonly Pick<SolverResult, 'exerciseId' | 'prescribedSets'>[],
  catalog: ExerciseCatalog,
): number {
  let seconds = 0;
  for (const pick of picks) {
    const exercise = catalog.byId.get(pick.exerciseId);
    if (!exercise) continue;
    seconds += pick.prescribedSets * (Math.max(1, exercise.default_reps) * 3 + computeRestSecondsFromCns(exercise.cns_fatigue_cost));
  }
  return seconds;
}

function createFinisherSlot(day: SplitDayKey, hint: string, index: number): SolverSlot {
  return {
    slotId: `${hint}_finisher_extra_${index}`,
    day,
    requiredPatterns: ['isolation'],
    primaryMuscleHint: hint,
    isolationOnly: true,
    defaultSets: 3,
    ...FINISHER_TECHNIQUE,
  };
}

function pickLowCnsFinisher(
  day: SplitDayKey,
  hints: readonly string[],
  catalog: ExerciseCatalog,
  constraints: SolverConstraints,
  state: SolverState,
  tracker: WeeklyVolumeTracker,
  currentDayIndex: number | undefined,
  finisherIndex: number,
): { slot: SolverSlot; exercise: CatalogExercise; score: number } | null {
  for (const hint of hints) {
    const slot = createFinisherSlot(day, hint, finisherIndex);
    const candidates = collectCandidates(day, catalog, slot, constraints, state, tracker, currentDayIndex, {
      ignoreMrv: true,
    }).filter((exercise) => exercise.cns_fatigue_cost <= 2);

    const selection = pickBestCandidate(candidates, tracker, constraints, state, currentDayIndex);
    if (selection) {
      return { slot, exercise: selection.exercise, score: selection.score };
    }
  }
  return null;
}

function maybeIncreaseExistingLowCnsIsolation(
  picks: SolverResult[],
  catalog: ExerciseCatalog,
  tracker: WeeklyVolumeTracker,
  constraints: Pick<SolverConstraints, 'mesocycle_phase' | 'mesocycle_week' | 'cns_fatigue_score'>,
): boolean {
  let selectedExercise: CatalogExercise | null = null;
  const candidate = picks.find((pick) => {
    const exercise = catalog.byId.get(pick.exerciseId);
    selectedExercise = exercise ?? null;
    const budget = exercise ? volumeBudgetForExercise(exercise, constraints).budget : null;
    return (
      exercise?.movement_pattern === 'isolation' &&
      exercise.cns_fatigue_cost <= 2 &&
      budget != null &&
      pick.prescribedSets < budget.maxSets
    );
  });

  if (!candidate) return false;
  const budget = selectedExercise ? volumeBudgetForExercise(selectedExercise, constraints).budget : null;
  candidate.prescribedSets = Math.min(candidate.prescribedSets + 1, budget?.maxSets ?? candidate.prescribedSets + 1);
  if (selectedExercise) {
    tracker.creditVolume(selectedExercise, 1);
  }
  candidate.intensity_technique = candidate.intensity_technique ?? FINISHER_TECHNIQUE.intensity_technique;
  candidate.technique_params = candidate.technique_params ?? FINISHER_TECHNIQUE.technique_params;
  return true;
}

function pushSolverPick(
  picks: SolverResult[],
  exercise: CatalogExercise,
  slot: SolverSlot,
  prescribedSets: number,
  score: number,
  state: {
    usedExerciseIds: Set<string>;
    sessionCnsAccum: number;
    shoulderSets: ShoulderVolumeLedger;
    dayHadAxialLoad: boolean;
    sessionAxialLoad: number;
  },
  tracker: WeeklyVolumeTracker,
  diagnosticReason?: string,
  budget?: VolumeBudget,
  phase?: ReturnType<typeof resolveEffectiveMesocyclePhase>,
): void {
  tracker.creditVolume(exercise, prescribedSets);
  state.usedExerciseIds.add(exercise.id);
  state.sessionCnsAccum += exercise.cns_fatigue_cost;
  state.sessionAxialLoad += exercise.axial_loading ?? (isAxialLoadExercise(exercise) ? 3 : 0);
  state.shoulderSets = applyShoulderLedger(state.shoulderSets, exercise, prescribedSets);
  state.dayHadAxialLoad ||= isAxialLoadExercise(exercise);

  const slotTechnique = advancedTechniqueAllowed(slot.intensity_technique, exercise)
    ? slot.intensity_technique
    : undefined;
  const budgetTechnique = advancedTechniqueAllowed(solverTechniqueFromBudget(budget?.executionTechnique), exercise)
    ? solverTechniqueFromBudget(budget?.executionTechnique)
    : undefined;

  picks.push({
    slotId: slot.slotId,
    exerciseId: exercise.id,
    prescribedSets,
    score,
    diagnostic_reason: diagnosticReasonForPrescribedSets(
      slot,
      exercise,
      prescribedSets,
      phase ?? 'maintenance',
      budget ?? {
        minSets: prescribedSets,
        maxSets: prescribedSets,
        targetRepRange: `${exercise.default_reps}-${exercise.default_reps}`,
        targetRIR: 2,
        executionTechnique: 'Standard',
      },
      diagnosticReason,
    ),
    intensity_technique: slotTechnique ?? budgetTechnique,
    technique_params: slotTechnique ? slot.technique_params : undefined,
    targetRepRange: budget?.targetRepRange,
    targetRIR: budget?.targetRIR,
  });
}

function sortPicksTactically(picks: readonly SolverResult[], catalog: ExerciseCatalog): readonly SolverResult[] {
  return [...picks].sort((a, b) => {
    const exerciseA = catalog.byId.get(a.exerciseId);
    const exerciseB = catalog.byId.get(b.exerciseId);
    const rankA = exerciseA ? tacticalOrderRank(exerciseA) : 99;
    const rankB = exerciseB ? tacticalOrderRank(exerciseB) : 99;
    if (rankA !== rankB) return rankA - rankB;
    return picks.indexOf(a) - picks.indexOf(b);
  });
}

/**
 * Deterministic slot filler — no RNG. Mutates `tracker` and returns an updated `SolverState`.
 */
export function solveDaySlots(
  day: SplitDayKey,
  slots: readonly SolverSlot[],
  catalog: ExerciseCatalog,
  constraints: SolverConstraints,
  initialState: SolverState,
  tracker: WeeklyVolumeTracker,
  currentDayIndex?: number,
): { picks: readonly SolverResult[]; state: SolverState } {
  const usedExerciseIds = new Set(initialState.usedExerciseIds);
  let sessionCnsAccum = initialState.sessionCnsAccum;
  let sessionAxialLoad = initialState.sessionAxialLoad;
  let shoulderSets = { ...initialState.shoulderSets };
  const picks: SolverResult[] = [];
  let dayHadAxialLoad = false;
  const mutableState = {
    usedExerciseIds,
    sessionCnsAccum,
    sessionAxialLoad,
    shoulderSets,
    dayHadAxialLoad,
  };

  for (const slot of slots) {
    const stateForSlot: SolverState = {
      ...initialState,
      usedExerciseIds: mutableState.usedExerciseIds,
      sessionCnsAccum: mutableState.sessionCnsAccum,
      sessionAxialLoad: mutableState.sessionAxialLoad,
    };
    const candidates = collectCandidates(day, catalog, slot, constraints, stateForSlot, tracker, currentDayIndex);

    const selection = pickBestCandidate(candidates, tracker, constraints, stateForSlot, currentDayIndex, slot);
    if (!selection) continue;

    const { exercise, score } = selection;
    const { prescribedSets, budget, phase } = prescribedSetsForSlot(slot, exercise, constraints);
    pushSolverPick(picks, exercise, slot, prescribedSets, score, mutableState, tracker, undefined, budget, phase);
  }

  if (picks.length > 0 && picks.length < MINIMUM_FULL_WORKOUT_EXERCISE_COUNT) {
    const filledSlotIds = new Set(picks.map((pick) => pick.slotId));
    for (const slot of slots) {
      if (picks.length >= MINIMUM_FULL_WORKOUT_EXERCISE_COUNT) break;
      if (filledSlotIds.has(slot.slotId)) continue;

      const deloadSlot: SolverSlot = {
        ...slot,
        defaultSets: Math.min(3, Math.max(MINIMUM_VIABLE_WORKOUT_SETS, slot.defaultSets)),
      };
      const stateForSlot: SolverState = {
        ...initialState,
        usedExerciseIds: mutableState.usedExerciseIds,
        sessionCnsAccum: mutableState.sessionCnsAccum,
        sessionAxialLoad: mutableState.sessionAxialLoad,
        isRecoveryMode: false,
      };
      const candidates = collectCandidates(
        day,
        catalog,
        deloadSlot,
        constraints,
        stateForSlot,
        tracker,
        currentDayIndex,
        {
          ignoreCnsBudget: true,
          ignoreMrv: true,
          ignoreRecoveryMode: true,
        },
      );
      const selection = pickBestCandidate(candidates, tracker, constraints, stateForSlot, currentDayIndex, deloadSlot);
      if (!selection) continue;

      pushSolverPick(
        picks,
        selection.exercise,
        { ...deloadSlot, slotId: `${deloadSlot.slotId}_partial_rescue` },
        Math.min(
          prescribedSetsForSlot(deloadSlot, selection.exercise, constraints).prescribedSets,
          MINIMUM_VIABLE_WORKOUT_SETS,
        ),
        selection.score,
        mutableState,
        tracker,
        'partial_rescue_constraints',
        prescribedSetsForSlot(deloadSlot, selection.exercise, constraints).budget,
        prescribedSetsForSlot(deloadSlot, selection.exercise, constraints).phase,
      );
    }
  }

  if (slots.length > 1 && picks.length < MINIMUM_VIABLE_WORKOUT_EXERCISE_COUNT) {
    for (const slot of slots) {
      if (picks.length >= MINIMUM_VIABLE_WORKOUT_EXERCISE_COUNT) break;
      const fallbackSlot: SolverSlot = {
        ...slot,
        defaultSets: MINIMUM_VIABLE_WORKOUT_SETS,
      };
      const stateForSlot: SolverState = {
        ...initialState,
        usedExerciseIds: mutableState.usedExerciseIds,
        sessionCnsAccum: mutableState.sessionCnsAccum,
        sessionAxialLoad: mutableState.sessionAxialLoad,
      };
      const candidates = collectCandidates(day, catalog, fallbackSlot, constraints, stateForSlot, tracker, currentDayIndex, {
        ignoreCnsBudget: true,
        ignoreMastery: true,
        ignoreMrv: true,
        ignoreRecoveryMode: true,
      });
      const selection = pickBestCandidate(candidates, tracker, constraints, stateForSlot, currentDayIndex, fallbackSlot);
      if (!selection) continue;

      const { exercise, score } = selection;
      const { prescribedSets: fallbackSets, budget, phase } = prescribedSetsForSlot(fallbackSlot, exercise, constraints);
      const prescribedSets = Math.min(fallbackSets, MINIMUM_VIABLE_WORKOUT_SETS);
      pushSolverPick(
        picks,
        exercise,
        { ...fallbackSlot, slotId: `${fallbackSlot.slotId}_minimum_viable` },
        prescribedSets,
        score,
        mutableState,
        tracker,
        minimumViableDiagnosticReason(constraints),
        budget,
        phase,
      );

      if (picks.length >= MINIMUM_VIABLE_WORKOUT_EXERCISE_COUNT) break;
    }
  }

  let estimatedSeconds = estimateSessionSeconds(picks, catalog);
  const targetSeconds = Math.max(0, constraints.available_time_minutes) * 60;
  let finisherIndex = 0;
  const finisherHints = resolveFinisherHints(day, slots);

  while (targetSeconds - estimatedSeconds > FINISHER_MIN_REMAINING_SECONDS && finisherIndex < 48) {
    if (picks.length >= 7 && maybeIncreaseExistingLowCnsIsolation(picks, catalog, tracker, constraints)) {
      estimatedSeconds = estimateSessionSeconds(picks, catalog);
      finisherIndex += 1;
      continue;
    }

    const stateForFinisher: SolverState = {
      ...initialState,
      usedExerciseIds: mutableState.usedExerciseIds,
      sessionCnsAccum: mutableState.sessionCnsAccum,
      sessionAxialLoad: mutableState.sessionAxialLoad,
    };
    const finisher = pickLowCnsFinisher(
      day,
      finisherHints,
      catalog,
      constraints,
      stateForFinisher,
      tracker,
      currentDayIndex,
      finisherIndex,
    );

    if (finisher) {
      const { exercise, slot, score } = finisher;
      const { prescribedSets, budget, phase } = prescribedSetsForSlot(slot, exercise, constraints);
      pushSolverPick(picks, exercise, slot, prescribedSets, score, mutableState, tracker, undefined, budget, phase);
      finisherIndex += 1;
      estimatedSeconds = estimateSessionSeconds(picks, catalog);
      continue;
    }

    if (!maybeIncreaseExistingLowCnsIsolation(picks, catalog, tracker, constraints)) break;
    estimatedSeconds = estimateSessionSeconds(picks, catalog);
    finisherIndex += 1;
  }

  const weeklyVolume = cloneWeeklySnapshot(tracker);
  const synergistLoad: SynergistLoadMatrix = {
    byMuscle: new Map(weeklyVolume.byMuscle),
  };

  return {
    picks: sortPicksTactically(picks, catalog),
    state: {
      usedExerciseIds,
      weeklyVolume,
      synergistLoad,
      sessionCnsAccum: mutableState.sessionCnsAccum,
      sessionAxialLoad: mutableState.sessionAxialLoad,
      shoulderSets: mutableState.shoulderSets,
      previousDayIndex: currentDayIndex ?? initialState.previousDayIndex,
      previousDayHadAxialLoad: mutableState.dayHadAxialLoad,
      isRecoveryMode: tracker.isRecoveryMode || initialState.isRecoveryMode,
    },
  };
}
