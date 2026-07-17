import { beautifyCatalogName } from '@/lib/gameplan/engine/clinicalLaws';
import { findLastLogForExercise } from '@/lib/gameplan/engine/iron/exerciseLogMatch';
import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import type { SolverResult } from '@/lib/gameplan/engine/iron/types';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import { mapToExerciseCueCard } from '@/lib/gameplan/engine/iron/cueMapper';
import type { DailyIronFocus } from '@/lib/gameplan/engine/iron/dupLogic';
import {
  calculateE1RM,
  estimateBestE1RMFromLogs,
  targetWeightFromE1RM,
  type PerformanceLogSample,
} from '@/lib/physics/rmCalculator';
import { effectiveRpeFromSet } from '@/lib/physics/loadTelemetry';
import { computeRestSecondsFromCns } from '@/types/catalog';
import type { IronExercisePrescription } from '@/types/gameplan';
import type { IronSetLog } from '@/types/performance';

const isIronPrescriptionDebug =
  (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.NODE_ENV !== 'production';

const COMPOUND_PATTERNS = new Set(['push', 'pull', 'squat', 'hinge', 'lunge', 'carry']);

export interface BestWorkingSet {
  weightKg: number;
  reps: number;
  reportedRpe: number | null;
}

function isCompoundPattern(pattern: string): boolean {
  return COMPOUND_PATTERNS.has(pattern);
}

function engineRowsToSamples(logs: readonly EnginePerformanceRow[]): PerformanceLogSample[] {
  return logs.map((row) => ({
    exercise_id: row.payload?.iron?.exercise_id ?? row.exercise_id,
    weight_used: row.weight_used,
    reps_completed: row.reps_completed,
    timestamp: row.timestamp,
    payload: row.payload ?? undefined,
  }));
}

function setWeightKg(set: IronSetLog | { weight_kg?: number; weightKg?: number }): number | null {
  const raw =
    'weight_kg' in set && set.weight_kg != null
      ? set.weight_kg
      : 'weightKg' in set && typeof set.weightKg === 'number'
        ? set.weightKg
        : null;
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return null;
  return raw;
}

function setReps(set: IronSetLog | { reps?: number }): number | null {
  if (set.reps == null || !Number.isFinite(set.reps) || set.reps <= 0) return null;
  return set.reps;
}

/**
 * Best Working Set — highest load among sets that reached the DUP top-of-range.
 * Ignores failed drop-set remnants that sit below the rep target.
 */
export function findBestWorkingSet(
  log: EnginePerformanceRow | null | undefined,
  targetRepsTop: number,
): BestWorkingSet | null {
  if (!log) return null;

  const sets = log.payload?.iron?.sets ?? [];
  let best: BestWorkingSet | null = null;

  for (const set of sets) {
    const weightKg = setWeightKg(set);
    const reps = setReps(set);
    if (weightKg == null || reps == null) continue;
    if (reps < targetRepsTop) continue;

    const reportedRpe = effectiveRpeFromSet(set);
    if (
      best == null ||
      weightKg > best.weightKg ||
      (weightKg === best.weightKg && reps > best.reps)
    ) {
      best = {
        weightKg,
        reps,
        reportedRpe: reportedRpe != null && Number.isFinite(reportedRpe) ? reportedRpe : null,
      };
    }
  }

  if (best) return best;

  // No set hit the top — keep anchor weight as heaviest set that still logged reps,
  // but double-progression gate will hold load and push for more reps.
  let fallback: BestWorkingSet | null = null;
  for (const set of sets) {
    const weightKg = setWeightKg(set);
    const reps = setReps(set);
    if (weightKg == null || reps == null) continue;
    const reportedRpe = effectiveRpeFromSet(set);
    if (
      fallback == null ||
      weightKg > fallback.weightKg ||
      (weightKg === fallback.weightKg && reps > fallback.reps)
    ) {
      fallback = {
        weightKg,
        reps,
        reportedRpe: reportedRpe != null && Number.isFinite(reportedRpe) ? reportedRpe : null,
      };
    }
  }

  if (fallback) return fallback;

  if (log.weight_used != null && log.weight_used > 0) {
    return {
      weightKg: Math.round(log.weight_used * 10) / 10,
      reps: log.reps_completed ?? 0,
      reportedRpe: log.rpe_score ?? null,
    };
  }

  return null;
}

/**
 * Double progression — hit rep top → +2.5% load; otherwise hold load and chase reps.
 */
export function applyDoubleProgression(input: {
  weightKg: number;
  bestSetReps: number;
  targetRepsTop: number;
}): { weight: number; targetReps: number; note: string } {
  const { weightKg, bestSetReps, targetRepsTop } = input;

  if (bestSetReps >= targetRepsTop) {
    return {
      weight: Math.round(weightKg * 1.025 * 10) / 10,
      targetReps: targetRepsTop,
      note: 'Hit rep top — +2.5% load',
    };
  }

  return {
    weight: weightKg,
    targetReps: targetRepsTop,
    note: `Reps ${bestSetReps}/${targetRepsTop} — add reps before load`,
  };
}

function repRangeForExercise(exercise: CatalogExercise, _prescribedSets: number): {
  targetReps: number;
  targetRir: number;
  lo: number;
  hi: number;
} {
  const hi = exercise.default_reps;
  const lo = Math.max(6, hi - 2);
  return { targetReps: hi, targetRir: 2, lo, hi };
}

function repRangeForDupFocus(
  exercise: CatalogExercise,
  prescribedSets: number,
  dailyFocus: DailyIronFocus | null,
): {
  targetReps: number;
  targetRir: number;
  lo: number;
  hi: number;
} {
  if (!dailyFocus) return repRangeForExercise(exercise, prescribedSets);

  const [lo, hi] = dailyFocus.targetRepRange;
  return {
    targetReps: hi,
    targetRir: dailyFocus.focus === 'pure_mechanical_tension' ? 1 : 2,
    lo,
    hi,
  };
}

function displayTechnique(technique: SolverResult['intensity_technique']): string {
  if (!technique || technique === 'standard') return 'Standard';
  return technique
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-')
    .replace('Myo-Reps', 'Myo-Reps');
}

/**
 * Maps solver output → UI-ready `IronExercisePrescription` (Text-Only Elite / Zustand shape).
 */
export function mapToIronPrescription(
  solverResult: SolverResult,
  exercise: CatalogExercise,
  e1rm: number | null,
  recentLogs: readonly EnginePerformanceRow[],
  goalIron: string | null,
  dailyFocus: DailyIronFocus | null = null,
): IronExercisePrescription {
  const periodizedRange =
    !dailyFocus && solverResult.targetRepRange
      ? solverResult.targetRepRange
          .split('-')
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isFinite(value))
      : undefined;
  const fallback = repRangeForDupFocus(exercise, solverResult.prescribedSets, dailyFocus);
  const lo = periodizedRange?.[0] ?? fallback.lo;
  const hi = periodizedRange?.[1] ?? fallback.hi;
  let targetReps = hi;
  const targetRir = solverResult.targetRIR ?? fallback.targetRir;
  const samples = engineRowsToSamples(recentLogs);
  const resolvedE1rm = e1rm ?? estimateBestE1RMFromLogs(samples, exercise.id);
  const lastLog = findLastLogForExercise(recentLogs, exercise.id, exercise.slug);
  const bestSet = findBestWorkingSet(lastLog, hi);
  const dayFocus = dailyFocus?.focus ?? 'metabolic_hypertrophy';

  if (isIronPrescriptionDebug) {
    console.log('[SOMMA Iron] lastLog lookup', {
      exercise_id: exercise.id,
      slug: exercise.slug,
      lastLog_weight: lastLog?.weight_used ?? null,
      best_working_set_kg: bestSet?.weightKg ?? null,
      best_working_set_reps: bestSet?.reps ?? null,
      lastLog_exercise_id: lastLog?.payload?.iron?.exercise_id ?? lastLog?.exercise_id ?? null,
      lastLog_slug: lastLog?.payload?.iron?.exercise_slug ?? null,
    });
  }

  let targetWeight: number | null = null;
  const notes: string[] = [];

  if (bestSet != null) {
    targetWeight = Math.round(bestSet.weightKg * 10) / 10;
    notes.push(`Best working set ${targetWeight} kg × ${bestSet.reps} — calibrate @ ${targetRir} RIR`);

    const progressed = applyDoubleProgression({
      weightKg: targetWeight,
      bestSetReps: bestSet.reps,
      targetRepsTop: hi,
    });
    targetWeight = progressed.weight;
    targetReps = progressed.targetReps;
    if (progressed.note) notes.push(progressed.note);
  } else if (isCompoundPattern(exercise.movement_pattern) && resolvedE1rm != null) {
    targetWeight = targetWeightFromE1RM(resolvedE1rm, goalIron, targetReps, targetRir);
    notes.push(`E1RM ${resolvedE1rm} kg (Epley, 21d)`);
  } else {
    notes.push('Calibrate first set @ prescribed RIR');
  }

  if (isIronPrescriptionDebug) {
    console.log('[SOMMA Iron] target_weight_kg', {
      exercise_id: exercise.id,
      slug: exercise.slug,
      target_weight_kg: targetWeight,
    });
  }

  if (solverResult.technique_params?.note) {
    notes.push(solverResult.technique_params.note);
  }

  return {
    exercise_id: exercise.id,
    slug: exercise.slug,
    display_name: beautifyCatalogName(exercise.name),
    target_sets: solverResult.prescribedSets,
    diagnostic_reason: solverResult.diagnostic_reason,
    target_reps: targetReps,
    target_rep_range: `${lo}-${hi} @ ${targetRir} RIR`,
    target_rir: targetRir,
    target_weight_kg: targetWeight,
    rest_seconds: computeRestSecondsFromCns(exercise.cns_fatigue_cost),
    progression_note: notes.join(' · ') || 'Calibrate First Set',
    execution_technique: displayTechnique(solverResult.intensity_technique),
    tempo: dailyFocus?.defaultTempo ?? exercise.tempo,
    cue_card: mapToExerciseCueCard(exercise, dayFocus),
    tactical_role: exercise.tactical_role,
    stability_demand: exercise.stability_demand,
    axial_loading: exercise.axial_loading,
    resistance_profile: exercise.resistance_profile,
    slot_category: exercise.slot_category,
  };
}

/** Convenience — derive E1RM from a single logged top set (tests / diagnostics). */
export function e1rmFromTopSet(weightKg: number, reps: number): number {
  return calculateE1RM(weightKg, reps);
}
