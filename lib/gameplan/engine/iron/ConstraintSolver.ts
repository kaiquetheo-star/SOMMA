import type { WeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import { ABCDE_ARMS_CALENDAR_DAY } from '@/lib/gameplan/engine/iron/dupLogic';
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
import {
  getMandatoryCompoundCandidates,
  hasRequiredCompound,
  mandatoryCompoundGroupsForDay,
} from '@/lib/gameplan/engine/iron/mandatoryCompounds';
import type { IronMovementPattern } from '@/lib/gameplan/engine/iron/taxonomy/movementPatterns';
import { MUSCLE_GROUPS } from '@/lib/gameplan/engine/iron/anatomicalDivision';
import { getAbcdeTrainingDayByCalendarIndex } from '@/lib/gameplan/engine/iron/splits/abcdeSplit';
import { setFloorForExercise } from '@/lib/gameplan/engine/iron/setFloors';
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
import { initialBiologicalProfile, normalizePreferredSplit } from '@/types/biological';
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
const SCORE_SUB_GROUP_MEV_BOOST = 1500;
const SCORE_DAY_MIN_SETS_BOOST = 1200;
const MAX_DAILY_AXIAL_LOAD = 6;
const FINISHER_MIN_REMAINING_SECONDS = 5 * 60;
const MINIMUM_VIABLE_WORKOUT_EXERCISE_COUNT = 2;
const MINIMUM_VIABLE_WORKOUT_SETS = 3;
const MINIMUM_FULL_WORKOUT_EXERCISE_COUNT = 4;
/** @deprecated Constitution floors live in setFloors.ts (compound 2 / isolation 1). */
export const MIN_RESCUE_SETS_COMPOUND = 2;
export const MIN_RESCUE_SETS_ISOLATION = 1;
const BODYWEIGHT_BLACKLIST = new Set([
  'pull_up',
  'chin_up',
  'dip',
  'push_up',
  'bodyweight_squat',
  'bodyweight_lunge',
  'plank',
  'muscle_up',
  'pistol_squat',
  'handstand_push_up',
]);

export type RedundancyExercise = CatalogExercise & { slot_category?: string };
export type SolverStateWithSelection = SolverState & { selectedExercises?: readonly RedundancyExercise[] };
export type DaySlotConfig = {
  slots: readonly ({ category?: string; count?: number } | SolverSlot)[];
};

const SCORE_ARM_DAY_ISOLATION_BONUS = 900;

const ARM_ISOLATION_SLOT_CATEGORIES = new Set([
  'biceps_curl',
  'biceps_curl_long_head',
  'biceps_curl_short_head',
  'biceps_hammer',
  'triceps_overhead',
  'triceps_pushdown',
  'triceps_extension',
  'forearm_isolation',
]);

function isArmPrimaryMuscle(muscle: string): boolean {
  return muscle === 'biceps' || muscle === 'triceps' || muscle === 'forearms' || muscle === 'brachialis';
}

function isAbcdeArmsCalendarDay(
  constraints: Pick<SolverConstraints, 'calendarDayIndex' | 'biological'> | undefined,
): boolean {
  if (!constraints) return false;
  const split = normalizePreferredSplit(constraints.biological?.preferred_split);
  return (split === 'abcde' || split === 'abcdef') && constraints.calendarDayIndex === ABCDE_ARMS_CALENDAR_DAY;
}

function isArmsDedicatedIsolationSlot(
  slot: SolverSlot,
  constraints: Pick<SolverConstraints, 'calendarDayIndex' | 'biological'>,
): boolean {
  return isAbcdeArmsCalendarDay(constraints) && slot.category != null && ARM_ISOLATION_SLOT_CATEGORIES.has(slot.category);
}

export function isArmsDedicatedSolverSlot(
  slot: SolverSlot,
  constraints: Pick<SolverConstraints, 'calendarDayIndex' | 'biological'>,
): boolean {
  return isArmsDedicatedIsolationSlot(slot, constraints);
}

function isLowCnsArmIsolation(exercise: CatalogExercise): boolean {
  return (
    exercise.movement_pattern === 'isolation' &&
    isArmPrimaryMuscle(exercise.primary_muscle) &&
    exercise.cns_fatigue_cost <= 3
  );
}

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
  // RDL is hip-hinge / lumbar_shear — not max spinal axial like conventional DL.
  // Keeping it out of this set avoids double-counting with tactical enrichment.
]);

const HAMSTRING_STRETCH_HINGE_PRIORITY = [
  'barbell_romanian_deadlift',
  'stiff_leg_deadlift',
  'dumbbell_romanian_deadlift',
  'barbell_hip_hinge_good_morning',
] as const;

const GLUTE_HINGE_PRIORITY = ['hip_thrust_barbell'] as const;

/** Elite-real hinge order: hamstring stretch first, glute hinge complementary. */
const POSTERIOR_HINGE_PRIORITY = [
  ...HAMSTRING_STRETCH_HINGE_PRIORITY,
  ...GLUTE_HINGE_PRIORITY,
] as const;

const SCORE_POSTERIOR_HAMSTRING_STRETCH_BOOST = 1800;

function isHamstringStretchHinge(exercise: CatalogExercise): boolean {
  if ((HAMSTRING_STRETCH_HINGE_PRIORITY as readonly string[]).includes(exercise.slug)) return true;
  return (
    exercise.movement_pattern === 'hinge' &&
    exercise.primary_muscle === 'hamstrings' &&
    exercise.stretch_mediated_hypertrophy === true
  );
}

function isGluteHinge(exercise: CatalogExercise): boolean {
  return (GLUTE_HINGE_PRIORITY as readonly string[]).includes(exercise.slug);
}

function dayAlreadyHasHamstringStretchHinge(state: SolverState): boolean {
  const selected = (state as SolverStateWithSelection).selectedExercises;
  if (selected?.some((exercise) => isHamstringStretchHinge(exercise))) return true;
  return false;
}

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
    note: 'Finalizador de baixo CNS para consumir o tempo restante sem fadiga axial.',
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
    maxSetsSession: tracker.snapshot.maxSetsSession,
  };
}

function equipmentSubsetAllowed(
  exercise: CatalogExercise,
  available: readonly EquipmentTag[],
): boolean {
  if (available.length === 0) return false;
  if (exercise.equipment_required.length === 0) return true;
  // Mirror periodization.equipmentMatches: full_gym implies bodyweight eligibility.
  const effectiveAvailable = available.includes('full_gym')
    ? Array.from(new Set<EquipmentTag>([...available, 'bodyweight']))
    : available;
  return exercise.equipment_required.some((tag) => effectiveAvailable.includes(tag as EquipmentTag));
}

export function bodyweightExerciseAllowed(exercise: CatalogExercise, available: readonly EquipmentTag[]): boolean {
  if (!available.includes('full_gym')) return true;
  if (BODYWEIGHT_BLACKLIST.has(exercise.slug)) return false;

  const text = exerciseSearchText(exercise);
  return !/pull_?up|chin_?up|(^|_)dip(s)?(_|$)|push_?up|muscle_?up|pistol_?squat|handstand_?push/.test(text);
}

function exerciseWithSlotCategory(exercise: CatalogExercise, slot: SolverSlot): RedundancyExercise {
  return slot.category ? { ...exercise, slot_category: slot.category } : exercise;
}

function slotCategoryAllowsMultiple(category: string, daySlotConfig: DaySlotConfig): boolean {
  let categoryInstances = 0;

  for (const slot of daySlotConfig.slots) {
    if (slot.category !== category) continue;
    if ('count' in slot && typeof slot.count === 'number' && slot.count > 1) return true;
    categoryInstances += 1;
  }

  return categoryInstances > 1;
}

export function isRedundant(
  candidate: RedundancyExercise,
  alreadySelected: readonly RedundancyExercise[],
  daySlotConfig: DaySlotConfig = { slots: [] },
): boolean {
  return alreadySelected.some((selected) => {
    if (candidate.slug === selected.slug) return true;

    if (candidate.slot_category && candidate.slot_category === selected.slot_category) {
      if (!slotCategoryAllowsMultiple(candidate.slot_category, daySlotConfig)) return true;
    }

    // Distinct ABCDE arm/shoulder specialization slots may share primary muscle + pattern.
    if (
      candidate.slot_category &&
      selected.slot_category &&
      candidate.slot_category !== selected.slot_category &&
      (ARM_ISOLATION_SLOT_CATEGORIES.has(candidate.slot_category) ||
        candidate.slot_category.startsWith('shoulder_') ||
        candidate.slot_category.startsWith('triceps_') ||
        candidate.slot_category.startsWith('biceps_') ||
        candidate.slot_category.startsWith('chest_') ||
        candidate.slot_category.startsWith('core_'))
    ) {
      return false;
    }

    if (
      candidate.primary_muscle === selected.primary_muscle &&
      candidate.movement_pattern === selected.movement_pattern &&
      JSON.stringify(candidate.equipment_required) === JSON.stringify(selected.equipment_required)
    ) {
      if (candidate.slot_category && slotCategoryAllowsMultiple(candidate.slot_category, daySlotConfig)) {
        return false;
      }
      return true;
    }

    return false;
  });
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

function exerciseSearchText(exercise: CatalogExercise): string {
  return `${exercise.slug} ${exercise.name}`.toLowerCase().replace(/[-\s]+/g, '_');
}

export function matchesSlotCategory(exercise: CatalogExercise, category: string | undefined): boolean {
  if (!category) return true;
  const text = exerciseSearchText(exercise);

  switch (category) {
    case 'chest_horizontal_press':
      return exercise.movement_pattern === 'push' && /bench|chest_press|push_up|dip/.test(text) && !/incline|shoulder|overhead|military|landmine/.test(text);
    case 'chest_incline_press':
      return exercise.movement_pattern === 'push' && /incline|upper_chest/.test(text);
    case 'chest_decline_press':
      return exercise.movement_pattern === 'push' && /decline|dip/.test(text);
    case 'chest_fly':
      // Flat / mid-pec fly only — incline flies belong to chest_incline press day volume.
      return (
        exercise.movement_pattern === 'isolation' &&
        /fly|pec_deck|crossover/.test(text) &&
        !/incline/.test(text)
      );
    case 'triceps_compound':
      return (exercise.movement_pattern === 'push' || exercise.movement_pattern === 'isolation') && /dip|close_grip|closegrip|diamond|bench/.test(text);
    case 'triceps_overhead':
      return exercise.primary_muscle === 'triceps' && /overhead|skull|lying|french|extension/.test(text) && !/pushdown|pressdown/.test(text);
    case 'triceps_pushdown':
      return exercise.primary_muscle === 'triceps' && /pushdown|pressdown|dip|close_grip/.test(text);
    case 'triceps_extension':
      return exercise.primary_muscle === 'triceps' && /tricep|triceps|extension|pushdown|pressdown|skull|dip/.test(text);
    case 'back_vertical_pull':
      return exercise.movement_pattern === 'pull' && /pull_?down|pull_up|pullup|chin/.test(text);
    case 'back_horizontal_row':
      return exercise.movement_pattern === 'pull' && /row|(^|_)t_bar|pendlay|gorilla/.test(text);
    case 'biceps_curl_long_head':
      return (
        exercise.primary_muscle === 'biceps' &&
        (/bayesian|drag/.test(text) || (/incline/.test(text) && /curl/.test(text) && !/hammer|preacher|spider/.test(text)))
      );
    case 'biceps_curl_short_head':
      return exercise.primary_muscle === 'biceps' && /preacher|spider|concentration/.test(text);
    case 'biceps_hammer':
      return (
        (exercise.primary_muscle === 'biceps' || exercise.primary_muscle === 'brachialis') &&
        /hammer/.test(text)
      );
    case 'biceps_curl':
      return exercise.primary_muscle === 'biceps' && /curl/.test(text);
    case 'quad_compound':
      return (exercise.movement_pattern === 'squat' || exercise.movement_pattern === 'lunge') && /squat|lunge|leg_press|hack|pendulum|bulgarian|split/.test(text);
    case 'quad_isolation':
      return (
        exercise.primary_muscle === 'quads' &&
        (exercise.movement_pattern === 'isolation' || /extension|sissy/.test(text)) &&
        /extension|sissy|terminal_knee|quad_pulse/.test(text)
      );
    case 'adductor':
      return (
        exercise.primary_muscle === 'adductors' ||
        /adductor|inner_thigh|copenhagen/.test(text) ||
        (exercise.synergist_muscles.includes('adductors') &&
          (exercise.movement_pattern === 'lunge' || /split_squat|bulgarian/.test(text)))
      );
    case 'calf_raise':
      // Standing / gastroc — exclude seated soleus variants.
      return (
        exercise.primary_muscle === 'calves' &&
        /calf|raise/.test(text) &&
        !/seated|hackenschmitt/.test(text)
      );
    case 'calf_raise_seated':
      return exercise.primary_muscle === 'calves' && /seated|hackenschmitt|hack_squat/.test(text);
    case 'shoulder_overhead_press':
      return exercise.movement_pattern === 'push' && /shoulder_press|overhead|military|arnold|landmine/.test(text);
    case 'shoulder_lateral_raise':
      return /lateral|side/.test(text) && /raise/.test(text);
    case 'shoulder_posterior_fly':
      return /rear|reverse|face_pull|pec_deck|delt_fly|posterior/.test(text);
    case 'shoulder_anterior_raise':
      return /front|anterior/.test(text) && /raise/.test(text);
    case 'trap_shrug':
      return exercise.primary_muscle === 'traps' || /shrug|trap/.test(text);
    case 'forearm_isolation':
      return exercise.primary_muscle === 'forearms' || /forearm|wrist|reverse_curl/.test(text);
    case 'core_anti_extension':
      return (
        exercise.primary_muscle === 'core' &&
        /crunch|plank|rollout|stabilization|hanging_knee|hollow|ab_crunch/.test(text)
      );
    case 'core_rotation':
      return exercise.primary_muscle === 'core' && /rotation|twist|russian|woodchop|pallof/.test(text);
    case 'hinge_compound':
      return exercise.movement_pattern === 'hinge' && /deadlift|rdl|romanian|hinge|hip_thrust|good_morning/.test(text);
    case 'hamstring_curl':
      return exercise.primary_muscle === 'hamstrings' && /leg_curl|hamstring.*curl|curl/.test(text);
    case 'glute_isolation':
      return (exercise.primary_muscle === 'glutes' || /glute|kickback|pull_through|abduction/.test(text)) && (exercise.movement_pattern === 'isolation' || exercise.movement_pattern === 'hinge');
    default:
      return true;
  }
}

function conceptKeyForSlot(exercise: CatalogExercise, slot: SolverSlot): string | null {
  if (!slot.category) return null;
  const text = exerciseSearchText(exercise);

  if (slot.category === 'back_vertical_pull') {
    if (/pull_?down/.test(text)) return `${slot.category}:pulldown`;
    if (/pull_up|pullup|chin/.test(text)) return `${slot.category}:pullup`;
  }

  if (slot.category === 'hamstring_curl') return `${slot.category}:leg_curl`;

  if (slot.category === 'triceps_extension') {
    if (/pushdown|pressdown/.test(text)) return `${slot.category}:pushdown`;
    if (/overhead|skull|lying|french/.test(text)) return `${slot.category}:overhead_extension`;
  }

  if (slot.category === 'biceps_curl') {
    if (/hammer/.test(text)) return `${slot.category}:hammer`;
    if (/preacher|spider|concentration/.test(text)) return `${slot.category}:short_head`;
    if (/incline|bayesian/.test(text)) return `${slot.category}:long_head`;
  }

  return null;
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

function isRepeatedSlotInstance(slot: SolverSlot): boolean {
  return /_[2-9]\d*$/.test(slot.slotId);
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

function dupFocusBonus(
  exercise: CatalogExercise,
  constraints?: Pick<SolverConstraints, 'dailyIronFocus' | 'calendarDayIndex' | 'biological'>,
): number {
  const focus = constraints?.dailyIronFocus?.focus;
  if (!focus) return 0;

  if (
    focus === 'metabolic_hypertrophy' &&
    isAbcdeArmsCalendarDay(constraints) &&
    isLowCnsArmIsolation(exercise)
  ) {
    return SCORE_DUP_MATCH_BONUS;
  }

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
 * - Anatomical: sub-group below MEV / day minSets gets rescue boost.
 */
export function scoreExerciseCandidate(
  exercise: CatalogExercise,
  tracker: WeeklyVolumeTracker,
  constraints?: Pick<
    SolverConstraints,
    'iron_mastery' | 'dailyIronFocus' | 'calendarDayIndex' | 'biological'
  >,
  state?: Pick<SolverState, 'usedExerciseIds' | 'previousDayHadAxialLoad' | 'previousDayIndex'>,
  currentDayIndex?: number,
): number {
  let score = exercise.selection_score * SCORE_X_FRAME_WEIGHT;

  const primaryVolume = tracker.completedSetsForMuscle(exercise.primary_muscle);
  const { mev, mrvSoft, mrvHard } = tracker.snapshot;
  if (primaryVolume < mev) {
    score += SCORE_RULE_1_MEV_BOOST;
    if (isAbcdeArmsCalendarDay(constraints) && isArmPrimaryMuscle(exercise.primary_muscle)) {
      score += SCORE_ARM_DAY_ISOLATION_BONUS;
    }
  } else if (primaryVolume > mrvSoft && primaryVolume <= mrvHard) {
    score -= SCORE_MRV_SOFT_PENALTY;
  }

  const primarySub = exercise.primary_sub_group;
  if (primarySub && constraints?.calendarDayIndex != null) {
    const subVolume = tracker.getSubGroupVolume(primarySub);
    const definition = MUSCLE_GROUPS[primarySub];
    if (subVolume < definition.mevPerWeek) {
      score += SCORE_SUB_GROUP_MEV_BOOST + SCORE_MEV_BOOST * (definition.priority === 'high' ? 1 : 0.5);
    } else if (subVolume > definition.mrvSoftPerWeek) {
      score -= SCORE_MRV_SOFT_PENALTY;
    }

    const dayTemplate = getAbcdeTrainingDayByCalendarIndex(constraints.calendarDayIndex);
    const dayMin = dayTemplate?.minSets[primarySub] ?? 0;
    if (dayMin > 0 && subVolume < dayMin) {
      score += SCORE_DAY_MIN_SETS_BOOST;
    }
  }

  const overlap = synergistOverlapLoad(exercise, tracker);
  const armDayIsolation = isAbcdeArmsCalendarDay(constraints) && isLowCnsArmIsolation(exercise);
  if (!(armDayIsolation && primaryVolume < mev)) {
    score -= SCORE_SYNERGIST_OVERLAP_PENALTY * overlap;
  }

  score -= armDayIsolation
    ? SCORE_CNS_PENALTY * Math.min(exercise.cns_fatigue_cost, 1)
    : SCORE_CNS_PENALTY * exercise.cns_fatigue_cost;
  score += dupFocusBonus(exercise, constraints);

  if (state?.usedExerciseIds.has(exercise.id)) {
    score -= SCORE_REPEAT_COMPOUND_PENALTY;
  }

  if (state && createsConsecutiveAxialLoad(exercise, state as SolverState, currentDayIndex)) {
    score -= SCORE_CONSECUTIVE_AXIAL_PENALTY;
  }

  // Day 5 (posterior): prefer stretch-mediated hamstring hinges over glute-primary hip thrust
  // for the first hinge_compound so RDL does not lose on CNS alone.
  if (
    constraints?.calendarDayIndex === 5 &&
    isHamstringStretchHinge(exercise) &&
    exercise.primary_sub_group === 'hamstrings_biceps_fem'
  ) {
    score += SCORE_POSTERIOR_HAMSTRING_STRETCH_BOOST;
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
  constraints: Pick<SolverConstraints, 'mesocycle_phase' | 'mesocycle_week' | 'biological'>,
): { budget: VolumeBudget; phase: ReturnType<typeof resolveEffectiveMesocyclePhase> } {
  const phase = resolveEffectiveMesocyclePhase(constraints.mesocycle_phase, constraints.mesocycle_week);
  const biological = {
    ...initialBiologicalProfile,
    ...constraints.biological,
    mesocycle_phase: phase,
    mesocycle_week: constraints.mesocycle_week ?? constraints.biological?.mesocycle_week ?? initialBiologicalProfile.mesocycle_week,
  };

  return {
    phase,
    budget: calculateVolumeBudget(
      exercise,
      biological,
      isCompoundExercise(exercise),
    ),
  };
}

export function prescribedSetsForSlot(
  slot: SolverSlot,
  exercise: CatalogExercise,
  constraints: Pick<SolverConstraints, 'mesocycle_phase' | 'mesocycle_week' | 'biological'>,
): { prescribedSets: number; budget: VolumeBudget; phase: ReturnType<typeof resolveEffectiveMesocyclePhase> } {
  const requestedSets = Math.max(0, slot.defaultSets);
  const { budget, phase } = volumeBudgetForExercise(exercise, constraints);
  const protocol = constraints.biological?.hormonal_protocol?.type;
  const chaseRaisedMev = protocol === 'trt' || protocol === 'enhanced_cycle';
  // TRT raises weekly MEV via resolveVolumeLimitsForSplit — prescribe toward the enhanced ceiling.
  const target = chaseRaisedMev
    ? Math.max(requestedSets, budget.minSets, budget.maxSets)
    : Math.max(budget.minSets, requestedSets);
  const prescribedSets = Math.min(target, budget.maxSets);
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

export function collectCandidates(
  day: SplitDayKey,
  catalog: ExerciseCatalog,
  slot: SolverSlot,
  constraints: SolverConstraints,
  state: SolverStateWithSelection,
  tracker: WeeklyVolumeTracker,
  currentDayIndex: number | undefined,
  options: {
    ignoreMastery?: boolean;
    ignoreMrv?: boolean;
    ignoreBodyweightBlacklist?: boolean;
    ignoreJointStress?: boolean;
    armsDedicatedRelaxation?: boolean;
    allowSameSlotCategoryDifferentConcept?: boolean;
    daySlotConfig?: DaySlotConfig;
  } = {},
): CatalogExercise[] {
  const candidates: CatalogExercise[] = [];

  for (const exercise of catalog.exercises) {
    const availableEquipment = constraints.available_equipment ?? constraints.equipment;
    const candidateForRedundancy = exerciseWithSlotCategory(exercise, slot);
    const usedExerciseIds = new Set([
      ...state.usedExerciseIds,
      ...(constraints.usedExerciseIds ?? []),
    ]);

    if (!options.ignoreBodyweightBlacklist && !bodyweightExerciseAllowed(exercise, availableEquipment)) {
      logCandidateRejection(slot, exercise, 'blacklist peso corporal com full_gym disponível');
      continue;
    }

    // Regra 4 / anti-duplicata: exact repeats are blocked deterministically across the microcycle.
    if (usedExerciseIds.has(exercise.id)) {
      logCandidateRejection(slot, exercise, 'exercício já usado no microciclo');
      continue;
    }
    const redundant = isRedundant(
      candidateForRedundancy,
      state.selectedExercises ?? [],
      options.daySlotConfig ?? { slots: [slot] },
    );
    if (redundant) {
      logCandidateRejection(slot, exercise, 'redundância conceitual com exercício já selecionado no dia');
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
    if (!matchesSlotCategory(exercise, slot.category)) {
      logCandidateRejection(slot, exercise, `categoria ${slot.category ?? 'n/a'} incompatível`);
      continue;
    }
    const conceptKey = conceptKeyForSlot(exercise, slot);
    if (conceptKey && state.usedConceptKeys?.has(conceptKey)) {
      logCandidateRejection(slot, exercise, `duplicata conceitual no dia: ${conceptKey}`);
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
    if (!equipmentSubsetAllowed(exercise, availableEquipment)) {
      logCandidateRejection(
        slot,
        exercise,
        `equipamento incompatível; requer um de [${exercise.equipment_required.join(', ')}]`,
      );
      continue;
    }
    const relaxJointForArms =
      options.armsDedicatedRelaxation && isLowCnsArmIsolation(exercise);
    if (
      !options.ignoreJointStress &&
      !relaxJointForArms &&
      !jointProfileAllowed(exercise, constraints.blockedJointProfiles)
    ) {
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
      // ABCDE Day 4 (pull) → Day 5 (posterior) are consecutive calendar days.
      // Stretch-mediated hamstring hinges (RDL/stiff-leg) are required on Day 5 and
      // must not lose the hinge_compound slot to non-axial glute hinges.
      const allowPosteriorHamstringHinge =
        slot.category === 'hinge_compound' &&
        constraints.calendarDayIndex === 5 &&
        isHamstringStretchHinge(exercise);
      if (!allowPosteriorHamstringHinge) {
        logCandidateRejection(slot, exercise, 'carga axial em dias consecutivos');
        continue;
      }
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

    const { prescribedSets: setsToAdd } = prescribedSetsForSlot(slot, exercise, constraints);
    const volumeCheck = tracker.canAddSets(exercise, setsToAdd);
    if (!options.ignoreMrv && volumeCheck.clampedSets <= 0) {
      logCandidateRejection(slot, exercise, volumeCheck.reason ?? 'MRV_HARD atingido');
      continue;
    }

    candidates.push(exercise);
  }

  return candidates;
}

export function pickBestCandidate(
  candidates: CatalogExercise[],
  tracker: WeeklyVolumeTracker,
  constraints: SolverConstraints,
  state: SolverState,
  currentDayIndex: number | undefined,
  slot?: SolverSlot,
): { exercise: CatalogExercise; score: number } | null {
  if (candidates.length === 0) return null;

  if (slot?.slotId === 'overhead_press' || slot?.category === 'shoulder_overhead_press') {
    const overheadPress = candidates.find((candidate) => candidate.slug === 'overhead_press');
    if (overheadPress) {
      return {
        exercise: overheadPress,
        score: scoreExerciseCandidate(overheadPress, tracker, constraints, state, currentDayIndex),
      };
    }
  }

  if (slot?.slotId === 'chest_compound_a' || slot?.category === 'chest_horizontal_press') {
    const benchPress = candidates.find((candidate) => candidate.slug === 'barbell_bench_press');
    if (benchPress) {
      return {
        exercise: benchPress,
        score: scoreExerciseCandidate(benchPress, tracker, constraints, state, currentDayIndex),
      };
    }
  }

  if (slot?.category === 'hinge_compound') {
    // Day 5 posterior chain: 1st hinge = hamstring stretch (RDL/stiff-leg);
    // complementary hinge = glute (hip thrust) once hamstring stretch is locked.
    const priorityList = dayAlreadyHasHamstringStretchHinge(state)
      ? GLUTE_HINGE_PRIORITY
      : HAMSTRING_STRETCH_HINGE_PRIORITY;
    const prioritizedHinge = priorityList
      .map((slug) => candidates.find((candidate) => candidate.slug === slug))
      .find((candidate): candidate is CatalogExercise => candidate != null);

    if (prioritizedHinge) {
      return {
        exercise: prioritizedHinge,
        score: scoreExerciseCandidate(prioritizedHinge, tracker, constraints, state, currentDayIndex),
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
      // Finishers must still respect hard MRV — weekly authority is the backstop.
      ignoreMrv: false,
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
  constraints: Pick<SolverConstraints, 'mesocycle_phase' | 'mesocycle_week' | 'biological'>,
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
    usedConceptKeys: Set<string>;
    selectedExercises: RedundancyExercise[];
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
  const isAbsoluteRescue =
    diagnosticReason === 'injury_constraint' ||
    diagnosticReason === 'minimum_viable_path_absolute_last_resort';
  // No MRV clamp here — `enforceWeeklyAuthority` is the sole weekly MRV trim.
  // Absolute rescue uses Constitution floor dose (compound 2 / isolation 1).
  const finalSets = isAbsoluteRescue
    ? setFloorForExercise(exercise)
    : prescribedSets;
  if (finalSets <= 0) return;

  tracker.creditVolume(exercise, finalSets);
  state.usedExerciseIds.add(exercise.id);
  const conceptKey = conceptKeyForSlot(exercise, slot);
  if (conceptKey) state.usedConceptKeys.add(conceptKey);
  state.selectedExercises.push(exerciseWithSlotCategory(exercise, slot));
  state.sessionCnsAccum += exercise.cns_fatigue_cost;
  state.sessionAxialLoad += exercise.axial_loading ?? (isAxialLoadExercise(exercise) ? 3 : 0);
  state.shoulderSets = applyShoulderLedger(state.shoulderSets, exercise, finalSets);
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
    prescribedSets: finalSets,
    score,
    diagnostic_reason: diagnosticReasonForPrescribedSets(
      slot,
      exercise,
      finalSets,
      phase ?? 'maintenance',
      budget ?? {
        minSets: finalSets,
        maxSets: finalSets,
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
  mandatoryCompoundDayIndex?: number,
): { picks: readonly SolverResult[]; state: SolverState } {
  const usedExerciseIds = new Set(initialState.usedExerciseIds);
  const usedConceptKeys = new Set<string>();
  let sessionCnsAccum = initialState.sessionCnsAccum;
  let sessionAxialLoad = initialState.sessionAxialLoad;
  let shoulderSets = { ...initialState.shoulderSets };
  const picks: SolverResult[] = [];
  const selectedExercises: RedundancyExercise[] = [];
  let dayHadAxialLoad = false;
  const mutableState = {
    usedExerciseIds,
    usedConceptKeys,
    selectedExercises,
    sessionCnsAccum,
    sessionAxialLoad,
    shoulderSets,
    dayHadAxialLoad,
  };
  const daySlotConfig: DaySlotConfig = { slots };
  const filledSlotIds = new Set(picks.map((pick) => pick.slotId));

  if (mandatoryCompoundDayIndex != null) {
    const selectedCatalogExercises = (): CatalogExercise[] =>
      mutableState.selectedExercises.map((exercise) => exercise);
    const mandatoryCandidates = getMandatoryCompoundCandidates(
      catalog.exercises,
      mandatoryCompoundDayIndex,
      { available_equipment: constraints.available_equipment ?? constraints.equipment },
      constraints.biological?.preferred_split,
    );

    if (mandatoryCandidates.length > 0 && !hasRequiredCompound(selectedCatalogExercises(), mandatoryCompoundDayIndex, constraints.biological?.preferred_split)) {
      const mandatoryGroups = mandatoryCompoundGroupsForDay(
        mandatoryCompoundDayIndex,
        constraints.biological?.preferred_split,
      );

      for (const mandatoryGroup of mandatoryGroups) {
        if (mandatoryGroup.some((slug) => selectedCatalogExercises().some((exercise) => exercise.slug === slug))) continue;
        let mandatorySelected = false;
        const groupCandidates = mandatoryCandidates.filter((candidate) => mandatoryGroup.includes(candidate.slug));

        for (const mandatoryCandidate of groupCandidates) {
          if (mandatorySelected) break;

          for (const slot of slots) {
            if (filledSlotIds.has(slot.slotId)) continue;
            const bypassSameDayConcepts = mandatoryCompoundDayIndex === 1;
            const stateForSlot: SolverStateWithSelection = {
              ...initialState,
              usedExerciseIds: mutableState.usedExerciseIds,
              usedConceptKeys: bypassSameDayConcepts ? new Set<string>() : mutableState.usedConceptKeys,
              selectedExercises: bypassSameDayConcepts ? [] : mutableState.selectedExercises,
              sessionCnsAccum: mutableState.sessionCnsAccum,
              sessionAxialLoad: mutableState.sessionAxialLoad,
            };
            const candidates = collectCandidates(day, catalog, slot, constraints, stateForSlot, tracker, currentDayIndex, {
              daySlotConfig,
            }).filter((exercise) => exercise.slug === mandatoryCandidate.slug);
            const selection = pickBestCandidate(candidates, tracker, constraints, stateForSlot, currentDayIndex, slot);
            if (!selection) continue;

            const { prescribedSets, budget, phase } = prescribedSetsForSlot(slot, selection.exercise, constraints);
            pushSolverPick(
              picks,
              selection.exercise,
              slot,
              prescribedSets,
              selection.score,
              mutableState,
              tracker,
              undefined,
              budget,
              phase,
            );
            filledSlotIds.add(slot.slotId);
            mandatorySelected = true;
            break;
          }
        }
      }
    }
  }

  for (const slot of slots) {
    if (filledSlotIds.has(slot.slotId)) continue;
    const stateForSlot: SolverStateWithSelection = {
      ...initialState,
      usedExerciseIds: mutableState.usedExerciseIds,
      usedConceptKeys: mutableState.usedConceptKeys,
      selectedExercises: mutableState.selectedExercises,
      sessionCnsAccum: mutableState.sessionCnsAccum,
      sessionAxialLoad: mutableState.sessionAxialLoad,
    };
    const slotCollectOptions = {
      allowSameSlotCategoryDifferentConcept: isRepeatedSlotInstance(slot),
      daySlotConfig,
    };
    const armsRelaxation = isArmsDedicatedIsolationSlot(slot, constraints);

    let candidates = collectCandidates(day, catalog, slot, constraints, stateForSlot, tracker, currentDayIndex, slotCollectOptions);
    let selection = pickBestCandidate(candidates, tracker, constraints, stateForSlot, currentDayIndex, slot);
    let slotDiagnosticReason: string | undefined;

    if (!selection) {
      candidates = collectCandidates(day, catalog, slot, constraints, stateForSlot, tracker, currentDayIndex, {
        ...slotCollectOptions,
        ignoreMrv: true,
        armsDedicatedRelaxation: armsRelaxation,
      });
      selection = pickBestCandidate(candidates, tracker, constraints, stateForSlot, currentDayIndex, slot);
    }

    if (!selection) {
      const exhaustedCandidates = collectCandidates(day, catalog, slot, constraints, stateForSlot, tracker, currentDayIndex, {
        ...slotCollectOptions,
        ignoreMastery: true,
        ignoreMrv: true,
        ignoreBodyweightBlacklist: true,
        ignoreJointStress: true,
        armsDedicatedRelaxation: true,
      });
      if (exhaustedCandidates.length === 0) continue;
      selection = pickBestCandidate(exhaustedCandidates, tracker, constraints, stateForSlot, currentDayIndex, slot);
      slotDiagnosticReason = minimumViableDiagnosticReason(constraints);
    }

    if (!selection) continue;

    const { exercise, score } = selection;
    const { prescribedSets, budget, phase } = prescribedSetsForSlot(slot, exercise, constraints);
    pushSolverPick(
      picks,
      exercise,
      slot,
      prescribedSets,
      score,
      mutableState,
      tracker,
      slotDiagnosticReason,
      budget,
      phase,
    );
    filledSlotIds.add(slot.slotId);
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
      const stateForSlot: SolverStateWithSelection = {
        ...initialState,
        usedExerciseIds: mutableState.usedExerciseIds,
        usedConceptKeys: mutableState.usedConceptKeys,
        selectedExercises: mutableState.selectedExercises,
        sessionCnsAccum: mutableState.sessionCnsAccum,
        sessionAxialLoad: mutableState.sessionAxialLoad,
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
          ignoreMrv: true,
          allowSameSlotCategoryDifferentConcept: isRepeatedSlotInstance(deloadSlot),
          daySlotConfig,
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
      const stateForSlot: SolverStateWithSelection = {
        ...initialState,
        usedExerciseIds: mutableState.usedExerciseIds,
        usedConceptKeys: mutableState.usedConceptKeys,
        selectedExercises: mutableState.selectedExercises,
        sessionCnsAccum: mutableState.sessionCnsAccum,
        sessionAxialLoad: mutableState.sessionAxialLoad,
      };
      const candidates = collectCandidates(day, catalog, fallbackSlot, constraints, stateForSlot, tracker, currentDayIndex, {
        ignoreMastery: true,
        ignoreMrv: true,
        ignoreBodyweightBlacklist: true,
        allowSameSlotCategoryDifferentConcept: isRepeatedSlotInstance(fallbackSlot),
        daySlotConfig,
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
  const templateFilled = slots.every((slot) => filledSlotIds.has(slot.slotId));

  while (targetSeconds - estimatedSeconds > FINISHER_MIN_REMAINING_SECONDS && finisherIndex < 48) {
    // Prefer densifying existing low-CNS isolation over inventing extra movements.
    if (maybeIncreaseExistingLowCnsIsolation(picks, catalog, tracker, constraints)) {
      estimatedSeconds = estimateSessionSeconds(picks, catalog);
      finisherIndex += 1;
      continue;
    }

    // When all template slots are filled, do not inject finisher spam that later
    // displaces prescribed triceps/biceps under the time-budget prune.
    if (templateFilled || picks.length >= Math.max(slots.length, 7)) {
      break;
    }

    const stateForFinisher: SolverStateWithSelection = {
      ...initialState,
      usedExerciseIds: mutableState.usedExerciseIds,
      usedConceptKeys: mutableState.usedConceptKeys,
      selectedExercises: mutableState.selectedExercises,
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

    break;
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
    },
  };
}
