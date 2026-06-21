import type { BiologicalProfile, TrainingExperienceLevel } from '@/types/biological';
import type { MovementPattern } from '@/types/catalog';
import {
  ironExercisesFromPerformanceLog,
  type PerformanceLogEntry,
} from '@/types/performance';
import {
  calculateE1RM,
  resolveIronGoalType,
  roundWeightKg,
  estimateBestE1RMFromLogs,
  targetWeightFromE1RM,
  type PerformanceLogSample,
} from '@/lib/shared/rmCore';

export type { IronGoalType, PerformanceLogSample } from '@/lib/shared/rmCore';
export {
  calculateE1RM,
  resolveIronGoalType,
  intensityPercentForGoal,
  roundWeightKg,
  adjustIntensityForRir,
  targetWeightFromE1RM,
  estimateBestE1RMFromLogs,
  hasIronHistoryForExercise,
} from '@/lib/shared/rmCore';

const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000;

function roundDownToPlateIncrement(value: number): number {
  return Math.max(0, Math.floor(value / 2.5) * 2.5);
}

type ColdStartLiftCategory = 'bench' | 'squat' | 'deadlift' | 'compound' | 'isolation' | 'bodyweight';
type NormalizedTrainingExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

interface PassportLoadExerciseMeta {
  id?: string;
  slug?: string;
  name?: string;
  movement_pattern?: MovementPattern | null;
  equipment_required?: string[];
}

const BODYWEIGHT_MULTIPLIERS: Record<
  NormalizedTrainingExperienceLevel,
  Record<ColdStartLiftCategory, number>
> = {
  beginner: {
    bench: 0.4,
    squat: 0.55,
    deadlift: 0.7,
    compound: 0.35,
    isolation: 0.15,
    bodyweight: 0,
  },
  intermediate: {
    bench: 0.55,
    squat: 0.75,
    deadlift: 0.95,
    compound: 0.45,
    isolation: 0.2,
    bodyweight: 0,
  },
  advanced: {
    bench: 0.7,
    squat: 0.95,
    deadlift: 1.1,
    compound: 0.55,
    isolation: 0.25,
    bodyweight: 0,
  },
};

function resolveExperienceLevel(
  value: TrainingExperienceLevel | string | null | undefined,
): NormalizedTrainingExperienceLevel {
  const normalized = (value ?? 'beginner').toLowerCase();
  if (normalized === 'intermediate' || normalized === 'advanced') return normalized;
  return 'beginner';
}

function classifyColdStartLift(exercise: PassportLoadExerciseMeta): ColdStartLiftCategory {
  const text = [exercise.id, exercise.slug, exercise.name].filter(Boolean).join(' ').toLowerCase();
  const equipment = exercise.equipment_required ?? [];
  if (equipment.length > 0 && equipment.every((tag) => tag === 'bodyweight')) return 'bodyweight';
  if (/\b(bench|supino)\b/.test(text)) return 'bench';
  if (/\b(deadlift|terra)\b/.test(text)) return 'deadlift';
  if (/\b(squat|agachamento)\b/.test(text) || exercise.movement_pattern === 'squat') return 'squat';
  if (exercise.movement_pattern === 'hinge') return 'deadlift';
  if (exercise.movement_pattern === 'push' || exercise.movement_pattern === 'pull') return 'compound';
  return exercise.movement_pattern === 'isolation' ? 'isolation' : 'compound';
}

/**
 * Passport-only cold start: used only before an exercise has logged sets.
 * Logged E1RM must always supersede this bodyweight baseline.
 */
export function targetWeightFromPassport(
  biological: Pick<BiologicalProfile, 'weight_kg' | 'experience_level'>,
  exercise: PassportLoadExerciseMeta,
): number | null {
  const bodyweightKg = biological.weight_kg;
  if (bodyweightKg == null || !Number.isFinite(bodyweightKg) || bodyweightKg <= 0) return null;

  const experience = resolveExperienceLevel(biological.experience_level);
  const category = classifyColdStartLift(exercise);
  const multiplier = BODYWEIGHT_MULTIPLIERS[experience][category];
  if (multiplier <= 0) return null;

  return roundDownToPlateIncrement(bodyweightKg * multiplier);
}

function performanceEntriesToSamples(entries: PerformanceLogEntry[]): PerformanceLogSample[] {
  const cutoff = Date.now() - THREE_WEEKS_MS;
  const samples: PerformanceLogSample[] = [];

  for (const entry of entries) {
    if (entry.pillar !== 'iron') continue;
    if (Date.parse(entry.timestamp) < cutoff) continue;

    for (const iron of ironExercisesFromPerformanceLog(entry)) {
      if (!iron.sets.length) continue;
      samples.push({
        exercise_id: iron.exercise_id,
        weight_used: iron.sets[iron.sets.length - 1]?.weight_kg ?? null,
        reps_completed: iron.sets[iron.sets.length - 1]?.reps ?? null,
        timestamp: entry.timestamp,
        payload: {
          iron: {
            exercise_id: iron.exercise_id,
            sets: iron.sets.map((set) => ({
              weight_kg: set.weight_kg,
              reps: set.reps,
            })),
          },
        },
      });
    }
  }

  return samples;
}

/**
 * Local performance_logs (Zustand) → E1RM → goal-aware target weight.
 */
export function getTargetWeightFromLogs(
  entries: PerformanceLogEntry[],
  exerciseId: string,
  targetReps: number,
  targetRIR: number,
  goalType: string | null,
): number | null {
  if (!exerciseId) return null;
  const logs = performanceEntriesToSamples(entries);
  const e1rm = estimateBestE1RMFromLogs(logs, exerciseId);
  if (e1rm == null) return null;
  return targetWeightFromE1RM(e1rm, goalType, targetReps, targetRIR);
}

/** @deprecated Use getTargetWeightFromLogs — local-first only */
export async function getTargetWeight(
  _userId: string,
  exerciseId: string,
  targetReps: number,
  targetRIR: number,
  goalType: string | null,
  performanceLogs: PerformanceLogEntry[] = [],
): Promise<number | null> {
  return getTargetWeightFromLogs(performanceLogs, exerciseId, targetReps, targetRIR, goalType);
}
