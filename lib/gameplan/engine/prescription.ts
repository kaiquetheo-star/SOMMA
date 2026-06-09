// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import {
  estimateBestE1RMFromLogs,
  targetWeightFromE1RM,
  targetWeightFromPassport,
  type PerformanceLogSample,
} from '@/lib/physics/rmCalculator';
import {
  HIGH_CNS_SWAP_THRESHOLD,
  HYPERTROPHY_MEV_SETS,
  HYPERTROPHY_MRV_HARD,
  HYPERTROPHY_MRV_SOFT,
  LOW_CNS_SWAP_MAX,
} from '@/lib/gameplan/engine/constants';
import {
  applyDeloadToIronExercise,
  beautifyCatalogName,
  capIronExercisesForDeload,
  CNS_FATIGUE_AUTOREG_THRESHOLD,
  isDeloadMesocycleWeek,
  resolveBiomechanicalPrerequisiteSlugs,
  sortIronExercises,
} from '@/lib/gameplan/engine/clinicalLaws';
import {
  applyHypertrophyVolumeGuardrail,
  archetypeExerciseCountDelta,
  archetypeRirDelta,
  archetypeVolumeCapAdjustment,
  buildWeeklyVolumeMap,
  equipmentMatches,
  injectPrerequisiteIronExercises,
  selectExercisesForSplit,
  targetIronExerciseCount,
} from '@/lib/gameplan/engine/periodization';
import type { DeterministicGenerationContext } from '@/lib/gameplan/engine/generation';
import { maxIronExercisesForMinutes, pruneIronExercisesForTimeBudget } from '@/lib/gameplan/engine/volumePruning';
import { adjustTargetWeightForMonth2 } from '@/lib/gameplan/engine/progression';
import type { ClinicalExitInterview } from '@/types/clinical';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import type { LibraryExercise } from '@/types/catalog';
import type {
  GameplanBlock,
  IronExercisePrescription,
  IronExecutionTechnique,
} from '@/types/gameplan';
import type { BiologicalProfile } from '@/types/biological';
import type { EquipmentTag } from '@/store/useSommaStore';

export interface PillarTimeBudget {
  available_time_iron: number;
}

export interface IronAutoregulationState {
  high_stress_mode: boolean;
  poor_recovery: boolean;
  blocked_joint_profiles: string[];
  swaps_applied: { from_exercise_id: string; to_exercise_id: string; reason: string }[];
}

const MAX_FINISHER_OR_ISOLATION_SETS = 4;
const MAX_REASONABLE_SETS_PER_EXERCISE = 8;

export interface MesocycleExerciseSummary {
  exercise_id: string;
  progression_recommendation: 'maintain' | 'load' | 'volume' | 'deload';
  notes: string;
}

export interface WeeklyMuscleVolumeRow {
  primary_muscle: string;
  working_sets_7d: number;
  status: 'below_mev' | 'optimal' | 'approaching_mrv' | 'at_mrv';
}

function parseBlockedJointProfiles(injuries: string | null): string[] {
  if (!injuries?.trim()) return [];
  const text = injuries.toLowerCase();
  const blocked: string[] = [];
  if (/knee|patella|acl|meniscus/.test(text)) blocked.push('high_knee_shear', 'moderate_knee_stress');
  if (/shoulder|rotator|impingement|labrum/.test(text)) blocked.push('rotator_cuff_heavy', 'shoulder_impingement_risk');
  if (/lumbar|lower back|disc|spine|back/.test(text)) blocked.push('lumbar_shear', 'spinal_axial_load');
  if (/wrist|elbow/.test(text)) blocked.push('wrist_stress');
  if (/neck|cervical/.test(text)) blocked.push('cervical_load');
  return [...new Set(blocked)];
}

export function detectIronAutoregulation(
  biological: BiologicalProfile,
  yesterdayMainRpe: number | null,
  loadTelemetryOverload = false,
): IronAutoregulationState {
  const stress = biological.baseline_stress_level;
  const cnsFatigue = biological.cns_fatigue_score ?? 0;
  const highCnsFatigue = cnsFatigue >= CNS_FATIGUE_AUTOREG_THRESHOLD;
  const highStress = stress != null && stress > 7;
  const poorRecovery =
    highCnsFatigue ||
    highStress ||
    loadTelemetryOverload ||
    (yesterdayMainRpe != null && yesterdayMainRpe >= 8) ||
    (stress != null && stress >= 7 && yesterdayMainRpe != null && yesterdayMainRpe >= 7);

  return {
    high_stress_mode: highStress,
    poor_recovery: poorRecovery,
    blocked_joint_profiles: parseBlockedJointProfiles(biological.current_injuries),
    swaps_applied: [],
  };
}

function isExerciseBlocked(exercise: LibraryExercise, blocked: string[]): boolean {
  if (!exercise.joint_stress_profile) return false;
  return blocked.includes(exercise.joint_stress_profile);
}

function computeRestSecondsFromCns(cns: number | null): number {
  const cost = cns ?? 3;
  if (cost >= 5) return 180;
  if (cost >= 4) return 150;
  if (cost >= 3) return 105;
  if (cost >= 2) return 75;
  return 60;
}

function capIronTargetSets(
  requestedSets: number,
  meta: LibraryExercise | undefined,
  technique?: IronExecutionTechnique,
): number {
  const safeSets = Number.isFinite(requestedSets) ? Math.max(1, Math.round(requestedSets)) : 1;
  const isIsolationOrFinisher =
    safeSets > MAX_REASONABLE_SETS_PER_EXERCISE ||
    meta?.movement_pattern === 'isolation' ||
    technique === 'Myo-Reps' ||
    /face_pull|leg_extension|leg_curl|lying_leg_curl|curl|raise|fly|pushdown|extension|pec_deck|calf/i.test(
      `${meta?.slug ?? ''} ${meta?.name ?? ''}`,
    );

  return isIsolationOrFinisher
    ? Math.min(safeSets, MAX_FINISHER_OR_ISOLATION_SETS)
    : Math.min(safeSets, MAX_REASONABLE_SETS_PER_EXERCISE);
}

function toPerformanceSamples(logs: EnginePerformanceRow[]): PerformanceLogSample[] {
  return logs.map((log) => ({
    exercise_id: log.exercise_id,
    weight_used: log.weight_used,
    reps_completed: log.reps_completed,
    timestamp: log.timestamp,
    payload: log.payload as PerformanceLogSample['payload'],
  }));
}

function buildMesocycleSummaries(
  routineIds: string[],
  catalog: LibraryExercise[],
  ironLogs3w: EnginePerformanceRow[],
): MesocycleExerciseSummary[] {
  return routineIds.map((exerciseId) => {
    const meta = catalog.find((row) => row.id === exerciseId);
    const logs = ironLogs3w.filter((log) => log.exercise_id === exerciseId);
    const last = logs[0];
    let progression: MesocycleExerciseSummary['progression_recommendation'] = 'maintain';
    let notes = 'No iron logs in 21-day mesocycle — establish baseline @ 2 RIR';

    if (last) {
      const hitReps =
        last.reps_completed != null && meta != null && last.reps_completed >= meta.default_reps - 1;
      if (last.rpe_score != null && last.rpe_score >= 9) {
        progression = 'deload';
        notes = `Last RPE ${last.rpe_score} — deload load ~5% or add 1 RIR`;
      } else if (last.rpe_score != null && last.rpe_score <= 8 && hitReps) {
        progression = 'load';
        notes = `Hit reps at RPE ${last.rpe_score} — progress load ~2.5%`;
      } else if (last.rpe_score != null && last.rpe_score <= 8) {
        progression = 'volume';
        notes = `RPE ${last.rpe_score} but rep target missed — add reps before load`;
      }
    }

    return { exercise_id: exerciseId, progression_recommendation: progression, notes };
  });
}

function buildWeeklyVolumeByMuscle(
  catalog: LibraryExercise[],
  ironLogs7d: EnginePerformanceRow[],
): WeeklyMuscleVolumeRow[] {
  const totals = new Map<string, number>();
  for (const log of ironLogs7d) {
    const exerciseId = log.payload?.iron?.exercise_id ?? log.exercise_id;
    if (!exerciseId) continue;
    const meta = catalog.find((row) => row.id === exerciseId);
    const muscle = meta?.primary_muscle;
    if (!muscle) continue;
    const setCount = log.payload?.iron?.sets?.length ?? 1;
    totals.set(muscle, (totals.get(muscle) ?? 0) + Math.max(1, setCount));
  }

  const muscles = new Set(catalog.map((row) => row.primary_muscle).filter(Boolean) as string[]);
  for (const muscle of totals.keys()) muscles.add(muscle);

  return [...muscles].map((primary_muscle) => {
    const working_sets_7d = totals.get(primary_muscle) ?? 0;
    let status: WeeklyMuscleVolumeRow['status'] = 'optimal';
    if (working_sets_7d >= HYPERTROPHY_MRV_HARD) status = 'at_mrv';
    else if (working_sets_7d >= HYPERTROPHY_MRV_SOFT) status = 'approaching_mrv';
    else if (working_sets_7d < HYPERTROPHY_MEV_SETS) status = 'below_mev';
    return { primary_muscle, working_sets_7d, status };
  });
}

function applyWeeklyVolumeSetCap(
  sets: number,
  primaryMuscle: string | null,
  weeklyVolumeMap: Map<string, number>,
): { sets: number; volumeNote: string } {
  return applyHypertrophyVolumeGuardrail(sets, primaryMuscle, weeklyVolumeMap, sets);
}

function findAlternativeExerciseId(
  exerciseId: string,
  catalog: LibraryExercise[],
  blocked: string[],
  equipment: EquipmentTag[],
): string | null {
  const current = catalog.find((row) => row.id === exerciseId);
  if (!current?.primary_muscle) return null;
  const alt = catalog.find(
    (row) =>
      row.id !== exerciseId &&
      row.primary_muscle === current.primary_muscle &&
      (row.cns_fatigue_cost ?? 5) <= (current.cns_fatigue_cost ?? 5) &&
      !isExerciseBlocked(row, blocked) &&
      equipmentMatches(row, equipment),
  );
  return alt?.id ?? null;
}

function prescribeIronExercise(
  exerciseId: string,
  catalog: LibraryExercise[],
  mesocycle: MesocycleExerciseSummary | undefined,
  autoreg: IronAutoregulationState,
  ironLogs3w: EnginePerformanceRow[],
  weeklyVolumeMap: Map<string, number>,
  equipment: EquipmentTag[],
  goalIron: string | null,
  biological: BiologicalProfile,
  clinicalReview: ClinicalExitInterview | null = null,
): IronExercisePrescription {
  const meta = catalog.find((row) => row.id === exerciseId);
  const last = ironLogs3w.find((log) => log.exercise_id === exerciseId);
  const progression = mesocycle?.progression_recommendation ?? 'maintain';
  const samples = toPerformanceSamples(ironLogs3w);

  const rirDelta = archetypeRirDelta(null);
  let targetRir = autoreg.poor_recovery ? 3 : Math.max(1, 2 + rirDelta);
  if (progression === 'deload') targetRir = 4;
  let targetReps = meta?.default_reps ?? 10;
  let targetWeight: number | null = null;
  let note = mesocycle?.notes ?? 'Baseline prescription';

  const e1rm = estimateBestE1RMFromLogs(samples, exerciseId);
  if (e1rm != null) {
    targetWeight = targetWeightFromE1RM(e1rm, goalIron, targetReps, targetRir);
    note = `E1RM ${e1rm} kg (Epley, 21d)`;
  } else if (last?.weight_used != null && last.weight_used > 0) {
    targetWeight = Math.round(last.weight_used * 10) / 10;
    note = `Last logged ${targetWeight} kg — calibrate @ ${targetRir} RIR`;
  } else {
    targetWeight = meta ? targetWeightFromPassport(biological, meta) : null;
    note =
      targetWeight != null
        ? `Passport baseline ${targetWeight} kg — recalibrates after first logged set`
        : 'Calibrate first set @ prescribed RIR';
  }

  if (last?.weight_used != null && last.rpe_score != null) {
    if (progression === 'deload' || last.rpe_score >= 9) {
      targetWeight = Math.round(last.weight_used * 0.95 * 10) / 10;
      targetRir = 4;
    } else if (progression === 'load' && last.rpe_score <= 8) {
      targetWeight = Math.round(last.weight_used * 1.025 * 10) / 10;
      targetReps = Math.max(6, (meta?.default_reps ?? 10) - 2);
    } else if (progression === 'volume') {
      targetReps = Math.min(15, targetReps + 1);
    }
  }

  const hi = meta?.default_reps ?? 10;
  const lo = Math.max(6, hi - 2);
  let sets = meta?.default_sets ?? 4;
  const archetypeBonus = archetypeVolumeCapAdjustment(null, meta?.primary_muscle ?? null);
  if (archetypeBonus > 0) {
    sets = Math.min(sets + 1, 6);
  }
  if (autoreg.poor_recovery && (meta?.cns_fatigue_cost ?? 0) >= HIGH_CNS_SWAP_THRESHOLD) {
    sets = Math.max(2, sets - 1);
  }
  const boostedVolumeMap = new Map(weeklyVolumeMap);
  if (archetypeBonus > 0 && meta?.primary_muscle) {
    const current = boostedVolumeMap.get(meta.primary_muscle) ?? 0;
    boostedVolumeMap.set(meta.primary_muscle, Math.max(0, current - archetypeBonus));
  }
  const volumeCap = applyWeeklyVolumeSetCap(sets, meta?.primary_muscle ?? null, boostedVolumeMap);
  sets = volumeCap.sets;

  if (clinicalReview && targetWeight != null) {
    targetWeight = adjustTargetWeightForMonth2(targetWeight, clinicalReview, targetReps, targetRir);
    note = [note, 'Month 2 — calibrated from Exit Interview'].filter(Boolean).join(' · ');
  }

  let technique: IronExecutionTechnique = 'Standard';
  const cns = meta?.cns_fatigue_cost ?? 3;
  if (autoreg.poor_recovery || progression === 'deload') {
    technique = meta?.stretch_mediated_hypertrophy ? 'Slow Eccentric (4s)' : 'Standard';
  } else if (progression === 'load' && cns <= 2 && !autoreg.high_stress_mode) {
    technique = 'Myo-Reps';
  }

  sets = capIronTargetSets(sets, meta, technique);

  return {
    exercise_id: exerciseId,
    target_sets: sets,
    target_reps: targetReps,
    target_rep_range: `${lo}-${hi} @ ${targetRir} RIR`,
    target_rir: targetRir,
    target_weight_kg: targetWeight,
    rest_seconds: computeRestSecondsFromCns(meta?.cns_fatigue_cost ?? null),
    alternative_exercise_id: findAlternativeExerciseId(exerciseId, catalog, autoreg.blocked_joint_profiles, equipment),
    progression_note: [note, volumeCap.volumeNote].filter(Boolean).join(' · '),
    execution_technique: technique,
  };
}

export function buildIronBlock(
  blockId: string,
  title: string,
  focusLabel: string,
  order: number,
  catalog: LibraryExercise[],
  equipment: EquipmentTag[],
  exerciseIds: string[],
  ironLogs3w: EnginePerformanceRow[],
  ironLogs7d: EnginePerformanceRow[],
  autoreg: IronAutoregulationState,
  goalIron: string | null,
  pillarTime: PillarTimeBudget,
  biological: BiologicalProfile,
  mesocycleWeek = 1,
  clinicalReview: ClinicalExitInterview | null = null,
  generation: DeterministicGenerationContext,
): GameplanBlock {
  const isDeload = isDeloadMesocycleWeek(mesocycleWeek);
  const sessionMinutes = pillarTime.available_time_iron;
  const { cap: timeCap } = maxIronExercisesForMinutes(sessionMinutes);
  let targetCount =
    targetIronExerciseCount(sessionMinutes, goalIron) + archetypeExerciseCountDelta(null);
  targetCount = Math.min(timeCap, Math.max(2, targetCount));
  if (isDeload) targetCount = Math.min(targetCount, 4);

  let routineIds = selectExercisesForSplit(
    focusLabel,
    catalog,
    equipment,
    targetCount,
    autoreg.blocked_joint_profiles,
    generation,
  );
  if (routineIds.length === 0) {
    routineIds = exerciseIds.slice(0, targetCount);
  }

  const provisionalNames = routineIds
    .map((id) => catalog.find((row) => row.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const prerequisiteSlugs = resolveBiomechanicalPrerequisiteSlugs(provisionalNames);
  routineIds = injectPrerequisiteIronExercises(
    routineIds,
    catalog,
    prerequisiteSlugs,
    equipment,
    autoreg.blocked_joint_profiles,
  );

  routineIds = capIronExercisesForDeload(routineIds, isDeload);
  routineIds = routineIds.slice(0, timeCap);

  const mesocycle = buildMesocycleSummaries(routineIds, catalog, ironLogs3w);
  const mesoById = new Map(mesocycle.map((row) => [row.exercise_id, row]));
  const weeklyVolumeMap = buildWeeklyVolumeMap(ironLogs7d, catalog);

  let exercises = routineIds.map((id) =>
    prescribeIronExercise(
      id,
      catalog,
      mesoById.get(id),
      autoreg,
      ironLogs3w,
      weeklyVolumeMap,
      equipment,
      goalIron,
      biological,
      clinicalReview,
    ),
  );
  if (isDeload) {
    exercises = exercises.map((row) => applyDeloadToIronExercise(row));
  }

  exercises = sortIronExercises(exercises, catalog, prerequisiteSlugs);
  exercises = pruneIronExercisesForTimeBudget(
    exercises,
    catalog,
    prerequisiteSlugs,
    sessionMinutes,
  );

  const names = exercises
    .map((row) => row.display_name)
    .filter(Boolean)
    .join(' · ');

  return {
    id: blockId,
    pillar: 'iron',
    title,
    subtitle: names || focusLabel,
    duration_minutes: pillarTime.available_time_iron,
    order,
    status: 'pending',
    iron: { routine_id: `iron_${blockId}`, exercises },
  };
}

export function applyIronRoutineAutoregulation(
  baseRoutineIds: string[],
  catalog: LibraryExercise[],
  equipment: EquipmentTag[],
  autoreg: IronAutoregulationState,
): string[] {
  return baseRoutineIds.map((exerciseId) => {
    let resolvedId = exerciseId;
    const meta = catalog.find((row) => row.id === exerciseId);
    if (meta && isExerciseBlocked(meta, autoreg.blocked_joint_profiles)) {
      const replacement = catalog.find(
        (row) =>
          row.primary_muscle === meta.primary_muscle &&
          row.id !== exerciseId &&
          !isExerciseBlocked(row, autoreg.blocked_joint_profiles) &&
          equipmentMatches(row, equipment),
      );
      if (replacement) resolvedId = replacement.id;
    }
    if (autoreg.high_stress_mode || autoreg.poor_recovery) {
      const current = catalog.find((row) => row.id === resolvedId);
      const cns = current?.cns_fatigue_cost ?? 3;
      if (cns >= HIGH_CNS_SWAP_THRESHOLD && current?.primary_muscle) {
        const swap = catalog.find(
          (row) =>
            row.primary_muscle === current.primary_muscle &&
            row.id !== resolvedId &&
            (row.cns_fatigue_cost ?? 5) <= LOW_CNS_SWAP_MAX &&
            equipmentMatches(row, equipment),
        );
        if (swap) resolvedId = swap.id;
      }
    }
    return resolvedId;
  });
}
