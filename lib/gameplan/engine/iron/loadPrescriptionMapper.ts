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

const isIronPrescriptionDebug =
  (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.NODE_ENV !== 'production';

const COMPOUND_PATTERNS = new Set(['push', 'pull', 'squat', 'hinge', 'lunge', 'carry']);

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

function lastReportedRpe(
  logs: readonly EnginePerformanceRow[],
  exerciseId: string,
  exerciseSlug: string,
): number | null {
  const lastLog = findLastLogForExercise(logs, exerciseId, exerciseSlug);
  if (!lastLog) return null;

  if (lastLog.rpe_score != null && Number.isFinite(lastLog.rpe_score)) {
    return lastLog.rpe_score;
  }

  const sets = lastLog.payload?.iron?.sets;
  if (!sets?.length) return null;

  for (let i = sets.length - 1; i >= 0; i -= 1) {
    const set = sets[i];
    const rpe = set ? effectiveRpeFromSet(set) : null;
    if (rpe != null && Number.isFinite(rpe)) return rpe;
  }

  return null;
}

/** SRS §3.3 — RPE ≤ 8 → +2.5%; RPE ≥ 9 → deload ~5%. */
function applyRpeOverload(weightKg: number, rpe: number | null): { weight: number; note: string } {
  if (rpe == null) return { weight: weightKg, note: '' };

  if (rpe >= 9) {
    return {
      weight: Math.round(weightKg * 0.95 * 10) / 10,
      note: 'RPE ≥9 — −5% load (deload)',
    };
  }

  if (rpe <= 8) {
    return {
      weight: Math.round(weightKg * 1.025 * 10) / 10,
      note: 'RPE ≤8 — +2.5% load',
    };
  }

  return { weight: weightKg, note: '' };
}

function repRangeForExercise(exercise: CatalogExercise, prescribedSets: number): {
  targetReps: number;
  targetRir: number;
  lo: number;
  hi: number;
} {
  const hi = exercise.default_reps;
  const lo = Math.max(6, hi - 2);
  const targetReps = hi;
  const targetRir = 2;
  return { targetReps, targetRir, lo, hi };
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
  const periodizedRange = !dailyFocus && solverResult.targetRepRange
    ? solverResult.targetRepRange
        .split('-')
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value))
    : undefined;
  const fallback = repRangeForDupFocus(
    exercise,
    solverResult.prescribedSets,
    dailyFocus,
  );
  const lo = periodizedRange?.[0] ?? fallback.lo;
  const hi = periodizedRange?.[1] ?? fallback.hi;
  const targetReps = hi;
  const targetRir = solverResult.targetRIR ?? fallback.targetRir;
  const samples = engineRowsToSamples(recentLogs);
  const resolvedE1rm = e1rm ?? estimateBestE1RMFromLogs(samples, exercise.id);
  const lastLog = findLastLogForExercise(recentLogs, exercise.id, exercise.slug);
  const dayFocus = dailyFocus?.focus ?? 'metabolic_hypertrophy';

  if (isIronPrescriptionDebug) {
    console.log('[SOMMA Iron] lastLog lookup', {
      exercise_id: exercise.id,
      slug: exercise.slug,
      lastLog_weight: lastLog?.weight_used ?? null,
      lastLog_exercise_id: lastLog?.payload?.iron?.exercise_id ?? lastLog?.exercise_id ?? null,
      lastLog_slug: lastLog?.payload?.iron?.exercise_slug ?? null,
    });
  }

  let targetWeight: number | null = null;
  const notes: string[] = [];

  if (lastLog?.weight_used != null && lastLog.weight_used > 0) {
    targetWeight = Math.round(lastLog.weight_used * 10) / 10;
    notes.push(`Last logged ${targetWeight} kg — calibrate @ ${targetRir} RIR`);
  } else if (isCompoundPattern(exercise.movement_pattern) && resolvedE1rm != null) {
    targetWeight = targetWeightFromE1RM(resolvedE1rm, goalIron, targetReps, targetRir);
    notes.push(`E1RM ${resolvedE1rm} kg (Epley, 21d)`);
  } else if (!isCompoundPattern(exercise.movement_pattern)) {
    notes.push('Calibrate first set @ prescribed RIR');
  } else {
    notes.push('Calibrate first set @ prescribed RIR');
  }

  if (targetWeight != null) {
    const lastRpe = lastReportedRpe(recentLogs, exercise.id, exercise.slug);
    const adjusted = applyRpeOverload(targetWeight, lastRpe);
    targetWeight = adjusted.weight;
    if (adjusted.note) notes.push(adjusted.note);
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
    // Regra 4.1 + Regra 5.1: DUP cadence overrides catalog default for the day stimulus.
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
