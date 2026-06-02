import { beautifyCatalogName } from '@/lib/gameplan/engine/clinicalLaws';
import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import type { SolverResult } from '@/lib/gameplan/engine/iron/types';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import {
  calculateE1RM,
  estimateBestE1RMFromLogs,
  targetWeightFromE1RM,
  type PerformanceLogSample,
} from '@/lib/physics/rmCalculator';
import { computeRestSecondsFromCns } from '@/types/catalog';
import type { IronExercisePrescription } from '@/types/gameplan';

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

function lastReportedRir(logs: readonly EnginePerformanceRow[], exerciseId: string): number | null {
  for (const row of logs) {
    const id = row.payload?.iron?.exercise_id ?? row.exercise_id;
    if (id !== exerciseId) continue;

    const sets = row.payload?.iron?.sets;
    if (!sets?.length) continue;

    for (let i = sets.length - 1; i >= 0; i -= 1) {
      const set = sets[i];
      const rir = set?.reported_rir ?? set?.rir ?? null;
      if (rir != null && Number.isFinite(rir)) return rir;
    }
  }
  return null;
}

function applyRirBiofeedback(weightKg: number, reportedRir: number | null): {
  weight: number;
  note: string;
} {
  if (reportedRir == null) return { weight: weightKg, note: '' };

  if (reportedRir <= 1) {
    return {
      weight: Math.round(weightKg * 0.95 * 10) / 10,
      note: 'RIR ≤1 — −5% load (recovery)',
    };
  }

  if (reportedRir >= 3) {
    return {
      weight: Math.round(weightKg * 1.025 * 10) / 10,
      note: 'RIR ≥3 — +2.5% load',
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

/**
 * Maps solver output → UI-ready `IronExercisePrescription` (Text-Only Elite / Zustand shape).
 */
export function mapToIronPrescription(
  solverResult: SolverResult,
  exercise: CatalogExercise,
  e1rm: number | null,
  recentLogs: readonly EnginePerformanceRow[],
  goalIron: string | null,
): IronExercisePrescription {
  const { targetReps, targetRir, lo, hi } = repRangeForExercise(exercise, solverResult.prescribedSets);
  const samples = engineRowsToSamples(recentLogs);
  const resolvedE1rm = e1rm ?? estimateBestE1RMFromLogs(samples, exercise.id);

  let targetWeight: number | null = null;
  const notes: string[] = [];

  if (isCompoundPattern(exercise.movement_pattern) && resolvedE1rm != null) {
    targetWeight = targetWeightFromE1RM(resolvedE1rm, goalIron, targetReps, targetRir);
    notes.push(`E1RM ${resolvedE1rm} kg (Epley, 21d)`);

    if (targetWeight != null) {
      const lastRir = lastReportedRir(recentLogs, exercise.id);
      const adjusted = applyRirBiofeedback(targetWeight, lastRir);
      targetWeight = adjusted.weight;
      if (adjusted.note) notes.push(adjusted.note);
    }
  } else if (!isCompoundPattern(exercise.movement_pattern)) {
    notes.push('Calibrate first set @ prescribed RIR');
  } else {
    notes.push('Calibrate first set @ prescribed RIR');
  }

  return {
    exercise_id: exercise.id,
    display_name: beautifyCatalogName(exercise.name),
    target_sets: solverResult.prescribedSets,
    target_reps: targetReps,
    target_rep_range: `${lo}-${hi} @ ${targetRir} RIR`,
    target_rir: targetRir,
    target_weight_kg: targetWeight,
    rest_seconds: computeRestSecondsFromCns(exercise.cns_fatigue_cost),
    progression_note: notes.join(' · ') || 'Heuristic engine prescription',
    execution_technique: 'Standard',
  };
}

/** Convenience — derive E1RM from a single logged top set (tests / diagnostics). */
export function e1rmFromTopSet(weightKg: number, reps: number): number {
  return calculateE1RM(weightKg, reps);
}
