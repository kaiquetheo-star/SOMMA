// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import {
  dateForDayIndex,
  getDayIndexForDate,
  getWeekStartMonday,
} from '@/lib/gameplan/microcycleWeek';
import {
  deriveActiveTrainingDays,
  equipmentMatches,
  focusLabelForIronSlot,
  resolvePillarFrequencies,
  spreadPillarDayIndices,
} from '@/lib/gameplan/engine/periodization';
import type { PillarTimeBudget } from '@/lib/gameplan/engine/prescription';
import {
  buildIronGameplanBlock,
  generateIronMicrocycle,
  type IronDayBlock,
} from '@/lib/gameplan/engine/iron/generateIronMicrocycle';
import {
  applyIronRoutineAutoregulation,
  buildIronBlock,
  detectIronAutoregulation,
} from '@/lib/gameplan/engine/legacy/ironPrescriptionLegacy';
import {
  filterIronLogsLastDays,
  flattenPerformanceLogs,
} from '@/lib/gameplan/engine/performanceLogs';
import {
  computeTrainingLoadSnapshot,
  telemetrySuggestsPoorRecovery,
  yesterdayEffectiveRpe,
} from '@/lib/physics/loadTelemetry';
import { computeNutritionSnapshot } from '@/lib/physics/metabolicTelemetry';
import { injectRecoveryProtocols } from '@/lib/gameplan/engine/iron/recoveryInjector';
import {
  applyNeuroMechanicalOrderingToMicrocycle,
} from '@/lib/gameplan/engine/clinicalLaws';
import { MESOCYCLE_DAYS, WEEKLY_VOLUME_DAYS } from '@/lib/gameplan/engine/constants';
import { buildGenerationContext } from '@/lib/gameplan/engine/generation';
import { pruneIronBlocksInMicrocycle } from '@/lib/gameplan/engine/volumePruning';
import { fetchLibraryExercises } from '@/lib/catalog/library';
import { sanitizeMicrocycleIronVolume } from '@/lib/gameplan/microcycleValidation';
import { applyIntensityStrategies } from '@/lib/gameplan/engine/iron/IntensityStrategyEngine';
import { generateLongevityAddon } from '@/lib/gameplan/engine/longevityMapper';
import type { BiologicalProfile } from '@/types/biological';
import type {
  DailyGameplan,
  GameplanBlock,
  IronExercisePrescription,
  MicrocycleDay,
} from '@/types/gameplan';
import type { PerformanceLogEntry } from '@/types/performance';
import type { EquipmentTag, FocusPreference, UserStats } from '@/store/useSommaStore';

export interface GenerateDeterministicGameplanInput {
  focus: FocusPreference;
  equipment: EquipmentTag[];
  biological: BiologicalProfile;
  userStats: UserStats;
  performanceLogs: PerformanceLogEntry[];
  /** Optional override for today's date (tests) */
  protocolDate?: string;
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveBaseRoutineIds(
  catalog: Awaited<ReturnType<typeof fetchLibraryExercises>>,
  equipment: EquipmentTag[],
): string[] {
  const eligible = catalog.filter((row) => equipmentMatches(row, equipment));
  const push = eligible.find((row) => row.movement_pattern === 'push');
  const hinge = eligible.find((row) => row.movement_pattern === 'hinge');
  const pull = eligible.find((row) => row.movement_pattern === 'pull');
  const routine: string[] = [];
  if (push) routine.push(push.id);
  if (hinge) routine.push(hinge.id);
  if (pull) routine.push(pull.id);
  if (routine.length === 0) return eligible.slice(0, 3).map((row) => row.id);
  return routine;
}

function countPillarBlocks(microcycle: MicrocycleDay[], pillar: 'iron'): number {
  return microcycle.reduce(
    (sum, day) => sum + day.blocks.filter((block) => block.pillar === pillar).length,
    0,
  );
}

function usesHeuristicIronEngine(frequencyIron: number): boolean {
  return frequencyIron === 6;
}

function nutritionFocusForDay(day: MicrocycleDay): string {
  if (day.is_rest_day) return 'rest';
  return day.focus_label.toLowerCase();
}

function totalTrainingDuration(day: MicrocycleDay): number {
  return day.blocks
    .filter((block) => block.pillar === 'iron')
    .reduce((sum, block) => sum + block.duration_minutes, 0);
}

function injectLongevityAddons(microcycle: MicrocycleDay[]): MicrocycleDay[] {
  return microcycle.map((day) => {
    const ironBlock = day.blocks.find((block) => block.pillar === 'iron');
    if (!ironBlock) return day;

    const longevity = generateLongevityAddon(day.day_index, day.focus_label);
    const longevityBlock: GameplanBlock = {
      id: `block-d${day.day_index}-longevity`,
      pillar: 'longevity',
      title: longevity.title,
      subtitle: `${longevity.mobility_focus} · ${longevity.cardio_prescription}`,
      duration_minutes: longevity.duration_minutes,
      order: ironBlock.order + 1,
      status: 'pending',
      longevity,
    };

    return {
      ...day,
      blocks: [...day.blocks, longevityBlock].sort((a, b) => a.order - b.order),
    };
  });
}

function restSecondsFromCns(cns: number | null): number {
  const cost = cns ?? 3;
  if (cost >= 5) return 180;
  if (cost >= 4) return 150;
  if (cost >= 3) return 105;
  if (cost >= 2) return 75;
  return 60;
}

function isMinimumViableCandidate(
  exercise: Awaited<ReturnType<typeof fetchLibraryExercises>>[number],
  equipment: EquipmentTag[],
  blockedJointProfiles: readonly string[],
): boolean {
  if (!equipmentMatches(exercise, equipment)) return false;
  if (exercise.joint_stress_profile && blockedJointProfiles.includes(exercise.joint_stress_profile)) return false;
  if (exercise.primary_muscle === 'obliques' || exercise.primary_muscle === 'core') return false;
  return exercise.movement_pattern != null;
}

function candidateScoreForFocus(
  exercise: Awaited<ReturnType<typeof fetchLibraryExercises>>[number],
  focusLabel: string,
): number {
  const focus = focusLabel.toLowerCase();
  let score = 0;
  if (focus.includes('push') && exercise.movement_pattern === 'push') score += 100;
  if (focus.includes('pull') && exercise.movement_pattern === 'pull') score += 100;
  if (
    (focus.includes('leg') || focus.includes('quad') || focus.includes('posterior')) &&
    (exercise.movement_pattern === 'squat' ||
      exercise.movement_pattern === 'hinge' ||
      exercise.movement_pattern === 'lunge')
  ) {
    score += 100;
  }
  if (exercise.movement_pattern === 'isolation') score -= 25;
  score -= (exercise.cns_fatigue_cost ?? 3) * 5;
  return score;
}

function buildMinimumViableIronExercises(
  catalog: Awaited<ReturnType<typeof fetchLibraryExercises>>,
  equipment: EquipmentTag[],
  blockedJointProfiles: readonly string[],
  focusLabel: string,
): IronExercisePrescription[] {
  return catalog
    .filter((exercise) => isMinimumViableCandidate(exercise, equipment, blockedJointProfiles))
    .sort((a, b) => {
      const scoreDelta = candidateScoreForFocus(b, focusLabel) - candidateScoreForFocus(a, focusLabel);
      if (scoreDelta !== 0) return scoreDelta;
      return a.slug.localeCompare(b.slug);
    })
    .slice(0, 2)
    .map((exercise) => ({
      exercise_id: exercise.id,
      slug: exercise.slug,
      display_name: exercise.name,
      target_sets: 2,
      target_reps: exercise.default_reps ?? 10,
      target_rep_range: `${Math.max(6, (exercise.default_reps ?? 10) - 2)}-${exercise.default_reps ?? 10} @ 3 RIR`,
      target_rir: 3,
      target_weight_kg: null,
      rest_seconds: restSecondsFromCns(exercise.cns_fatigue_cost),
      alternative_exercise_id: null,
      progression_note: 'Minimum viable deload fallback: MRV/CNS relaxed to avoid an empty training day.',
      execution_technique: 'Standard',
    }));
}

function injectMinimumViableIronWorkouts(
  microcycle: MicrocycleDay[],
  catalog: Awaited<ReturnType<typeof fetchLibraryExercises>>,
  equipment: EquipmentTag[],
  blockedJointProfiles: readonly string[],
): MicrocycleDay[] {
  return microcycle.map((day) => {
    if (day.is_rest_day) return day;
    const blocks = day.blocks.map((block) => {
      if (block.pillar !== 'iron' || (block.iron?.exercises?.length ?? 0) > 0) return block;

      const exercises = buildMinimumViableIronExercises(
        catalog,
        equipment,
        blockedJointProfiles,
        day.focus_label,
      );
      if (exercises.length === 0) return block;

      return {
        ...block,
        subtitle: exercises.map((exercise) => exercise.display_name).filter(Boolean).join(' · '),
        iron: {
          routine_id: block.iron?.routine_id ?? `iron_${block.id}`,
          exercises,
        },
      };
    });

    const hasIron = blocks.some((block) => block.pillar === 'iron');
    if (hasIron) return { ...day, blocks };

    const exercises = buildMinimumViableIronExercises(
      catalog,
      equipment,
      blockedJointProfiles,
      day.focus_label,
    );
    if (exercises.length === 0) return { ...day, blocks };

    return {
      ...day,
      blocks: [
        {
          id: `block-d${day.day_index}-iron`,
          pillar: 'iron',
          title: day.focus_label,
          subtitle: exercises.map((exercise) => exercise.display_name).filter(Boolean).join(' · '),
          duration_minutes: 20,
          order: 0,
          status: 'pending',
          iron: { routine_id: `iron_block-d${day.day_index}-iron`, exercises },
        },
        ...blocks,
      ],
    };
  });
}

function appendNutritionTargets(
  microcycle: MicrocycleDay[],
  biological: BiologicalProfile,
): MicrocycleDay[] {
  return microcycle.map((day) => {
    const target = computeNutritionSnapshot(
      biological,
      nutritionFocusForDay(day),
      totalTrainingDuration(day),
    );
    const order = day.blocks.reduce((max, block) => Math.max(max, block.order), -1) + 1;
    const nutritionBlock: GameplanBlock = {
      id: `block-d${day.day_index}-nutrition`,
      pillar: 'nutrition',
      title: 'Biological Fueling',
      subtitle: `${target.total_calories} kcal · ${target.carbs_g}g C · ${target.protein_g}g P · ${target.fat_g}g F`,
      duration_minutes: 0,
      order,
      status: 'pending',
      nutrition: {
        goal: biological.nutrition_goal,
        note: `Peri-workout carbs: ${Math.round(target.carbs_g * target.peri_workout_carb_ratio)}g · Water ${target.water_ml}ml`,
        nutrition_target: target,
      },
    };

    return {
      ...day,
      blocks: [...day.blocks, nutritionBlock],
    };
  });
}

/**
 * Local Head Coach — $0 API. Builds a 7-day microcycle from catalog + passport + logs.
 */
export async function generateDeterministicGameplan(
  input: GenerateDeterministicGameplanInput,
): Promise<DailyGameplan> {
  const exerciseCatalog = await fetchLibraryExercises();

  const equipmentFiltered = exerciseCatalog.filter((row) => equipmentMatches(row, input.equipment));
  const catalog = equipmentFiltered.length > 0 ? equipmentFiltered : exerciseCatalog;

  if (catalog.length === 0) {
    throw new Error('INSUFFICIENT_CATALOG: library_exercises empty or no equipment match.');
  }

  const pillarFreq = resolvePillarFrequencies(input.biological);
  const trainingDaysPerWeek = deriveActiveTrainingDays(pillarFreq);
  const pillarTime: PillarTimeBudget = {
    available_time_iron: input.biological.available_time_iron ?? 45,
  };

  const flatLogs = flattenPerformanceLogs(input.performanceLogs);
  const ironLogs3w = filterIronLogsLastDays(flatLogs, MESOCYCLE_DAYS);
  const ironLogs7d = filterIronLogsLastDays(flatLogs, WEEKLY_VOLUME_DAYS);
  const loadSnapshot = computeTrainingLoadSnapshot(input.performanceLogs, {
    goalIron: input.biological.goal_iron,
  });
  const { rpe: yesterdayMainRpe } = yesterdayEffectiveRpe(input.performanceLogs);

  const autoreg = detectIronAutoregulation(
    input.biological,
    yesterdayMainRpe,
    telemetrySuggestsPoorRecovery(loadSnapshot, input.biological.goal_iron),
  );
  const baseRoutine = applyIronRoutineAutoregulation(
    resolveBaseRoutineIds(catalog, input.equipment),
    catalog,
    input.equipment,
    autoreg,
  );

  const ironDayIndices = spreadPillarDayIndices(pillarFreq.frequency_iron).sort((a, b) => a - b);

  const protocolDate = input.protocolDate ?? todayDateKey();
  const week_start_date = getWeekStartMonday(protocolDate);

  let ironByDayIndex = new Map<number, IronDayBlock>();
  if (usesHeuristicIronEngine(pillarFreq.frequency_iron)) {
    const ironMicrocycle = generateIronMicrocycle({
      libraryExercises: catalog,
      biological: input.biological,
      equipment: input.equipment,
      logs7d: ironLogs7d,
      logs21d: ironLogs3w,
      ironDayIndices,
      weekStartDate: week_start_date,
      blockedJointProfiles: autoreg.blocked_joint_profiles,
      goalIron: input.biological.goal_iron,
      availableMinutes: pillarTime.available_time_iron,
    });
    ironByDayIndex = new Map(ironMicrocycle.map((day) => [day.dayIndex, day]));
  }

  let ironSlot = 0;
  const { ctx: generation } = buildGenerationContext({
    protocolDate,
    biological: input.biological,
  });

  const microcycle: MicrocycleDay[] = Array.from({ length: 7 }, (_, index) => {
    const day_index = index + 1;
    const wantsIron = ironDayIndices.includes(day_index);
    const active = wantsIron;

    if (!active) {
      return {
        day_index,
        is_rest_day: true,
        focus_label: 'Rest & Recovery',
        date: dateForDayIndex(week_start_date, day_index),
        blocks: [],
      };
    }

    const focusLabel =
      ironByDayIndex.get(day_index)?.focusLabel ??
      focusLabelForIronSlot(trainingDaysPerWeek || pillarFreq.frequency_iron || 4, ironSlot++);

    const blocks: GameplanBlock[] = [];
    let order = 0;

    let ironBlockForPrereqs: GameplanBlock | null = null;

    if (wantsIron) {
      const heuristicDay = ironByDayIndex.get(day_index);
      if (heuristicDay) {
        ironBlockForPrereqs = buildIronGameplanBlock(
          heuristicDay,
          `block-d${day_index}-iron`,
          order,
          catalog,
          pillarTime.available_time_iron,
        );
      } else {
        ironBlockForPrereqs = buildIronBlock(
          `block-d${day_index}-iron`,
          focusLabel,
          focusLabel,
          order,
          catalog,
          input.equipment,
          baseRoutine,
          ironLogs3w,
          ironLogs7d,
          autoreg,
          input.biological.goal_iron,
          pillarTime,
          input.biological,
          1,
          input.biological.clinical_exit_interview,
          generation,
        );
      }
      blocks.push(ironBlockForPrereqs);
      order += 1;
    }
    return {
      day_index,
      is_rest_day: false,
      focus_label: focusLabel,
      date: dateForDayIndex(week_start_date, day_index),
      blocks,
    };
  });

  const ironCount = countPillarBlocks(microcycle, 'iron');

  if (pillarFreq.frequency_iron > 0 && ironCount < pillarFreq.frequency_iron) {
    throw new Error(
      `DEGENERATE_MICROCYCLE: Iron ${ironCount}/${pillarFreq.frequency_iron}`,
    );
  }

  let orderedMicrocycle = applyNeuroMechanicalOrderingToMicrocycle(microcycle, catalog);

  pruneIronBlocksInMicrocycle(
    orderedMicrocycle,
    catalog,
    pillarTime.available_time_iron,
  );

  orderedMicrocycle = injectMinimumViableIronWorkouts(
    orderedMicrocycle,
    catalog,
    input.equipment,
    autoreg.blocked_joint_profiles,
  );

  orderedMicrocycle = injectRecoveryProtocols(
    orderedMicrocycle,
    {
      ...loadSnapshot,
      is_deload_week: loadSnapshot.is_deload_week === true,
    },
    input.biological,
  );

  orderedMicrocycle = applyIntensityStrategies(
    orderedMicrocycle,
    input.biological,
    input.performanceLogs,
    catalog,
  );

  orderedMicrocycle = sanitizeMicrocycleIronVolume(orderedMicrocycle);
  orderedMicrocycle = injectLongevityAddons(orderedMicrocycle);
  orderedMicrocycle = appendNutritionTargets(orderedMicrocycle, input.biological);

  const todayIndex = getDayIndexForDate(protocolDate, week_start_date);
  const blocks = orderedMicrocycle.find((day) => day.day_index === todayIndex)?.blocks ?? [];

  return {
    date: protocolDate,
    week_start_date,
    training_days_per_week: trainingDaysPerWeek,
    microcycle: orderedMicrocycle,
    blocks,
    generated_at: new Date().toISOString(),
    clinical_review_trigger: null,
  };
}
