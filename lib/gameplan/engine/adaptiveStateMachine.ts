import type { BiologicalProfile } from '@/types/biological';
import type { IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';
import type { PerformanceLogEntry } from '@/types/performance';
import { ironExercisesFromPerformanceLog } from '@/types/performance';
import { mapToIronPrescription } from '@/lib/gameplan/engine/iron/loadPrescriptionMapper';
import type { ExerciseCatalog, SolverResult } from '@/lib/gameplan/engine/iron/types';
import {
  filterIronLogsLastDays,
  flattenPerformanceLogs,
  type EnginePerformanceRow,
} from '@/lib/gameplan/engine/performanceLogs';
import { MESOCYCLE_DAYS } from '@/lib/gameplan/engine/constants';

export interface ReadinessScan {
  sleep_quality: 1 | 2 | 3 | 4 | 5;
  muscle_soreness: 1 | 2 | 3 | 4 | 5;
  energy_level: 1 | 2 | 3 | 4 | 5;
  stress_level: 1 | 2 | 3 | 4 | 5;
  mobility_feeling: 1 | 2 | 3 | 4 | 5;
  timestamp: string;
}

export interface BiometricCheckpoint {
  date: string;
  weight_kg: number;
  body_fat_percentage?: number | null;
}

export interface AdaptationLogEntry {
  timestamp: string;
  rule_triggered: string;
  action_taken: string;
  exercises_rotated?: string[];
  new_exercises?: string[];
  details?: Record<string, string | number | boolean>;
}

export interface AdaptiveStateMachineInput {
  biological: BiologicalProfile;
  logs7d: PerformanceLogEntry[];
  logs21d: PerformanceLogEntry[];
  readinessScan?: ReadinessScan;
  biometricCheckpoints?: BiometricCheckpoint[];
  /** When provided, rotation remaps weight/cues via mapToIronPrescription. */
  catalog?: ExerciseCatalog;
}

const BLACKLISTED_EXERCISE_IDS = new Set<string>();
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function roundToWhole(value: number) {
  return Math.max(1, Math.round(value));
}

function dateTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRecentSessions(logs: PerformanceLogEntry[], days: number): PerformanceLogEntry[] {
  const cutoff = Date.now() - days * MILLISECONDS_PER_DAY;
  return logs
    .filter((entry) => dateTimestamp(entry.timestamp) >= cutoff)
    .sort((a, b) => dateTimestamp(b.timestamp) - dateTimestamp(a.timestamp));
}

function computeWorkoutWorkload(entry: PerformanceLogEntry): number {
  const exercises = ironExercisesFromPerformanceLog(entry);
  return exercises.flatMap((exercise) => exercise.sets).reduce((sum, set) => sum + set.weight_kg * set.reps, 0);
}

function hasStagnantStrength(logs21d: PerformanceLogEntry[]): boolean {
  const recent7d = getRecentSessions(logs21d, 7);
  const prior14d = getRecentSessions(logs21d, 14).slice(recent7d.length);

  if (recent7d.length < 2 || prior14d.length < 2) return false;

  const recentWorkload = recent7d.reduce((sum, session) => sum + computeWorkoutWorkload(session), 0);
  const priorWorkload = prior14d.reduce((sum, session) => sum + computeWorkoutWorkload(session), 0);

  return recentWorkload > 0 && recentWorkload <= priorWorkload;
}

function deriveReadinessScore(scan: ReadinessScan): number {
  const invertedSoreness = 6 - scan.muscle_soreness;
  const invertedStress = 6 - scan.stress_level;
  return average([
    scan.sleep_quality,
    invertedSoreness,
    scan.energy_level,
    invertedStress,
    scan.mobility_feeling,
  ]);
}

function isWeightStable(checkpoints: BiometricCheckpoint[] = []): boolean {
  if (checkpoints.length < 2) return false;
  const sorted = [...checkpoints].sort((a, b) => dateTimestamp(b.date) - dateTimestamp(a.date));
  const cutoff = Date.now() - 14 * MILLISECONDS_PER_DAY;
  const recent = sorted.filter((checkpoint) => dateTimestamp(checkpoint.date) >= cutoff);
  if (recent.length < 2) return false;
  const weights = recent.map((checkpoint) => checkpoint.weight_kg);
  const maxWeight = Math.max(...weights);
  const minWeight = Math.min(...weights);
  return maxWeight - minWeight <= 0.5;
}

function mapIronBlocks(
  microcycle: MicrocycleDay[],
  transform: (exercise: IronExercisePrescription) => IronExercisePrescription,
): MicrocycleDay[] {
  return microcycle.map((day) => ({
    ...day,
    blocks: (day.blocks ?? []).map((block) => {
      if (block.pillar !== 'iron' || !block.iron) return block;
      const exercises = (block.iron.exercises ?? []).map(transform);
      return {
        ...block,
        iron: {
          ...block.iron,
          exercises,
        },
      };
    }),
  }));
}

function applyExerciseRotation(
  microcycle: MicrocycleDay[],
  logs21d: PerformanceLogEntry[],
  logs: AdaptationLogEntry[],
  catalog: ExerciseCatalog | undefined,
  goalIron: string | null,
  engineLogs21d: readonly EnginePerformanceRow[],
): MicrocycleDay[] {
  if (!hasStagnantStrength(logs21d)) return microcycle;

  const exercisesRotated: string[] = [];
  const newExercises: string[] = [];

  const rotated = mapIronBlocks(microcycle, (exercise) => {
    if (!exercise.alternative_exercise_id) return exercise;
    const altId = exercise.alternative_exercise_id;
    if (altId === exercise.exercise_id || BLACKLISTED_EXERCISE_IDS.has(altId)) return exercise;

    exercisesRotated.push(exercise.exercise_id);
    newExercises.push(altId);

    const altExercise = catalog?.byId.get(altId) ?? catalog?.bySlug.get(altId);
    if (altExercise) {
      const solverResult: SolverResult = {
        slotId: exercise.slot_category ?? 'adaptive_rotation',
        exerciseId: altExercise.id,
        prescribedSets: exercise.target_sets,
        score: 0,
        diagnostic_reason: 'adaptive_rotation_stagnant_strength',
        targetRepRange: exercise.target_rep_range?.replace(/\s*@.*$/, '').trim(),
        targetRIR: exercise.target_rir,
      };
      const remapped = mapToIronPrescription(
        solverResult,
        altExercise,
        null,
        engineLogs21d,
        goalIron,
        null,
      );
      return {
        ...remapped,
        diagnostic_reason: 'adaptive_rotation_stagnant_strength',
        progression_note:
          'Strength plateau detected — rotated to a mechanically similar alternative.',
        alternative_exercise_id: null,
      };
    }

    // Catalog miss — keep structural swap (weight/cues may be stale until next map).
    return {
      ...exercise,
      exercise_id: altId,
      slug: altId,
      display_name: exercise.display_name?.replace(/bench press/i, '').trim() || altId,
      diagnostic_reason: 'adaptive_rotation_stagnant_strength',
      progression_note: 'Strength plateau detected — rotated to a mechanically similar alternative.',
      alternative_exercise_id: null,
    };
  });

  if (exercisesRotated.length > 0) {
    logs.push({
      timestamp: new Date().toISOString(),
      rule_triggered: 'stagnant_strength_2_weeks',
      action_taken: 'rotate_exercises',
      exercises_rotated: exercisesRotated,
      new_exercises: newExercises,
      details: {
        detected_sessions: logs21d.length,
      },
    });
  }

  return rotated;
}

function applyCyclePhaseVolumeMultiplier(
  microcycle: MicrocycleDay[],
  biological: BiologicalProfile,
  logs: AdaptationLogEntry[],
): MicrocycleDay[] {
  const week = biological.mesocycle_week ?? 1;
  const multiplier = week >= 5 && week <= 8 ? 1.15 : 1.0;
  if (multiplier === 1) return microcycle;

  const updated = mapIronBlocks(microcycle, (exercise) => {
    const newSets = roundToWhole(exercise.target_sets * multiplier);
    if (newSets === exercise.target_sets) return exercise;
    return {
      ...exercise,
      target_sets: newSets,
      diagnostic_reason: 'adaptive_cycle_phase_volume_multiplier',
      progression_note: 'Late cycle adaptation — modest volume increase for Durateston phase support.',
    };
  });

  if (JSON.stringify(updated) !== JSON.stringify(microcycle)) {
    logs.push({
      timestamp: new Date().toISOString(),
      rule_triggered: 'durateston_cycle_phase',
      action_taken: 'apply_volume_multiplier',
      details: {
        week,
        multiplier,
      },
    });
  }

  return updated;
}

function applyBiometricNutritionAdaptation(
  microcycle: MicrocycleDay[],
  biometricCheckpoints: BiometricCheckpoint[] | undefined,
  logs: AdaptationLogEntry[],
): MicrocycleDay[] {
  if (!isWeightStable(biometricCheckpoints)) return microcycle;

  let updatedCalories = 0;

  const adapted = microcycle.map((day) => ({
    ...day,
    blocks: (day.blocks ?? []).map((block) => {
      if (block.pillar !== 'nutrition' || !block.nutrition?.nutrition_target) return block;
      const target = block.nutrition.nutrition_target;
      const nextTarget = {
        ...target,
        total_calories: target.total_calories + 100,
      };
      updatedCalories += 100;
      const note = `${nextTarget.note ?? 'Weekly biometric progress detected.'} Stable weight adaptation: +100 kcal.`;
      return {
        ...block,
        subtitle: `${nextTarget.total_calories} kcal · ${nextTarget.carbs_g}g C · ${nextTarget.protein_g}g P · ${nextTarget.water_ml}ml`,
        nutrition: {
          ...block.nutrition,
          note,
          nutrition_target: nextTarget,
        },
      };
    }),
  }));

  if (updatedCalories > 0) {
    logs.push({
      timestamp: new Date().toISOString(),
      rule_triggered: 'stable_weight_14_days',
      action_taken: 'increase_calories_by_100',
      details: {
        calories_added: 100,
      },
    });
  }

  return adapted;
}

function applyBlacklistSafeGuards(
  microcycle: MicrocycleDay[],
  logs: AdaptationLogEntry[],
): MicrocycleDay[] {
  if (BLACKLISTED_EXERCISE_IDS.size === 0) return microcycle;

  const removed: string[] = [];
  const adapted = microcycle.map((day) => ({
    ...day,
    blocks: (day.blocks ?? []).map((block) => {
      if (block.pillar !== 'iron' || !block.iron) return block;
      const updatedExercises = (block.iron.exercises ?? []).filter((exercise) => {
        const keep = !BLACKLISTED_EXERCISE_IDS.has(exercise.exercise_id);
        if (!keep) removed.push(exercise.exercise_id);
        return keep;
      });
      return {
        ...block,
        iron: {
          ...block.iron,
          exercises: updatedExercises,
        },
      };
    }),
  }));

  if (removed.length > 0) {
    logs.push({
      timestamp: new Date().toISOString(),
      rule_triggered: 'blacklisted_exercise_removed',
      action_taken: 'remove_exercise',
      details: {
        removed_exercises: removed.join(','),
      },
    });
  }

  return adapted;
}

export async function adaptGameplan(
  microcycle: MicrocycleDay[],
  input: AdaptiveStateMachineInput,
): Promise<{ microcycle: MicrocycleDay[]; adaptationLogs: AdaptationLogEntry[] }> {
  const adaptationLogs: AdaptationLogEntry[] = [];
  let adapted = microcycle;

  const engineLogs21d =
    input.catalog != null
      ? filterIronLogsLastDays(flattenPerformanceLogs(input.logs21d), MESOCYCLE_DAYS)
      : [];

  adapted = applyCyclePhaseVolumeMultiplier(adapted, input.biological, adaptationLogs);
  adapted = applyExerciseRotation(
    adapted,
    input.logs21d,
    adaptationLogs,
    input.catalog,
    input.biological.goal_iron ?? null,
    engineLogs21d,
  );
  adapted = applyBiometricNutritionAdaptation(adapted, input.biometricCheckpoints, adaptationLogs);
  adapted = applyBlacklistSafeGuards(adapted, adaptationLogs);

  return { microcycle: adapted, adaptationLogs };
}

export function computeReadinessScore(scan: ReadinessScan): number {
  return deriveReadinessScore(scan);
}

export { isWeightStable };
