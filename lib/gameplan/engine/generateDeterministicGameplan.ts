// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import { fetchLibraryExercises } from '@/lib/catalog/library';
import {
    adaptGameplan,
    type AdaptiveStateMachineInput,
    type BiometricCheckpoint,
    type ReadinessScan,
} from '@/lib/gameplan/engine/adaptiveStateMachine';
import {
    applyNeuroMechanicalOrderingToMicrocycle,
} from '@/lib/gameplan/engine/clinicalLaws';
import { MESOCYCLE_DAYS, WEEKLY_VOLUME_DAYS } from '@/lib/gameplan/engine/constants';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import {
    buildIronGameplanBlock,
    finalizeIronDayBlockPrescriptions,
    generateIronMicrocycle,
    type EnrichedIronPick,
    type IronDayBlock,
} from '@/lib/gameplan/engine/iron/generateIronMicrocycle';
import { applyIntensityStrategies } from '@/lib/gameplan/engine/iron/IntensityStrategyEngine';
import {
    detectIronInjuryConstraints,
} from '@/lib/gameplan/engine/iron/injuryConstraints';
import { emitMotorTelemetry } from '@/lib/gameplan/engine/iron/motorTelemetry';
import { generateLongevityAddon } from '@/lib/gameplan/engine/longevityMapper';
import {
    filterIronLogsLastDays,
    filterPerformanceEntriesLastDays,
    flattenPerformanceLogs,
} from '@/lib/gameplan/engine/performanceLogs';
import { abcdeRestDayFocusLabel } from '@/lib/gameplan/engine/iron/splits/abcdeSplit';
import {
    deriveActiveTrainingDays,
    equipmentMatches,
    focusLabelForIronSlot,
    resolvePillarFrequencies,
    spreadPillarDayIndices,
} from '@/lib/gameplan/engine/periodization';
import {
    pruneIronDayBlockPicks,
} from '@/lib/gameplan/engine/volumePruning';
import { sanitizeMicrocycleIronVolume } from '@/lib/gameplan/microcycleValidation';
import { enforceWeeklyAuthority } from '@/lib/gameplan/engine/iron/volumeAuthority';
import { createWeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import type { SolverResult } from '@/lib/gameplan/engine/iron/types';
import { setFloorForExercise } from '@/lib/gameplan/engine/iron/setFloors';
import {
    dateForDayIndex,
    getDayIndexForDate,
    getWeekStartMonday,
} from '@/lib/gameplan/microcycleWeek';
import {
    computeTrainingLoadSnapshot,
} from '@/lib/physics/loadTelemetry';
import { computeNutritionSnapshot } from '@/lib/physics/metabolicTelemetry';
import type { EquipmentTag, FocusPreference, UserStats } from '@/store/useSommaStore';
import type { BiologicalProfile } from '@/types/biological';
import {
    normalizeIronProfileForGeneration,
    normalizePreferredSplit,
} from '@/types/biological';
import type {
    DailyGameplan,
    GameplanBlock,
    MicrocycleDay,
} from '@/types/gameplan';
import type { PerformanceLogEntry } from '@/types/performance';

export interface GenerateDeterministicGameplanInput {
  focus: FocusPreference;
  equipment: EquipmentTag[];
  biological: BiologicalProfile;
  userStats: UserStats;
  performanceLogs: PerformanceLogEntry[];
  readinessScan?: ReadinessScan;
  biometricCheckpoints?: BiometricCheckpoint[];
  /** Optional override for today's date (tests) */
  protocolDate?: string;
}

type BiologicalWithMesocycleWeek = BiologicalProfile & {
  mesocycle_week?: number | null;
};

interface PillarTimeBudget {
  available_time_iron: number;
}

function resolveMesocycleWeek(biological: BiologicalProfile): number | null {
  const mesocycleWeek = (biological as BiologicalWithMesocycleWeek).mesocycle_week;
  return typeof mesocycleWeek === 'number' && Number.isFinite(mesocycleWeek)
    ? mesocycleWeek
    : null;
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function countPillarBlocks(microcycle: MicrocycleDay[], pillar: 'iron'): number {
  return microcycle.reduce(
    (sum, day) => sum + day.blocks.filter((block) => block.pillar === pillar).length,
    0,
  );
}

function buildAbcdeRestDayBlocks(dayIndex: number): GameplanBlock[] {
  if (dayIndex === 3) {
    return [
      {
        id: `block-d${dayIndex}-spirit-healer`,
        pillar: 'spirit',
        title: 'Zona de Cura',
        subtitle: 'Respiração 4-7-8 · redução de CNS mid-week',
        duration_minutes: 12,
        order: 0,
        status: 'pending',
        spirit: {
          mode: 'breathwork',
          tempo_id: 'tempo_478',
          duration_minutes: 12,
          prescribed_reason: 'Recuperação mid-week · Zona de Cura e reset de mobilidade.',
        },
      },
    ];
  }

  if (dayIndex === 7) {
    return [
      {
        id: `block-d${dayIndex}-spirit-reset`,
        pillar: 'spirit',
        title: 'Reset Espiritual',
        subtitle: 'Recuperação parassimpática · fechamento semanal',
        duration_minutes: 15,
        order: 0,
        status: 'pending',
        spirit: {
          mode: 'breathwork',
          tempo_id: 'tempo_478',
          duration_minutes: 15,
          prescribed_reason: 'Reset espiritual de domingo · recuperação nutricional e nervosa.',
        },
      },
    ];
  }

  return [];
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
    if (day.is_rest_day) return day;
    if (day.blocks.some((block) => block.pillar === 'longevity')) return day;

    const ironBlock = day.blocks.find((block) => block.pillar === 'iron');
    const order = ironBlock ? ironBlock.order + 1 : day.blocks.length;

    const longevity = generateLongevityAddon(day.day_index, day.focus_label);
    const longevityBlock: GameplanBlock = {
      id: `block-d${day.day_index}-longevity`,
      pillar: 'longevity',
      title: longevity.title,
      subtitle: `${longevity.mobility_focus} · ${longevity.cardio_prescription}`,
      duration_minutes: longevity.duration_minutes,
      order,
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

function fallbackConceptKey(exercise: { slug?: string; display_name?: string; name?: string }): string | null {
  const text = `${exercise.slug ?? ''} ${exercise.display_name ?? ''} ${exercise.name ?? ''}`.toLowerCase();
  if (/pull[_\s-]?down/.test(text)) return 'vertical_pull:pulldown';
  if (/leg[_\s-]?curl/.test(text)) return 'posterior_leg:leg_curl';
  return null;
}

function stubFillerPick(exercise: CatalogExercise, prescribedSets: number): EnrichedIronPick {
  const solverResult: SolverResult = {
    slotId: `mvp_filler_${exercise.id}`,
    exerciseId: exercise.id,
    prescribedSets,
    score: 0,
    diagnostic_reason: 'minimum_viable_path_absolute_last_resort',
  };
  return {
    ...solverResult,
    exercise,
    prescription: {
      exercise_id: exercise.id,
      slug: exercise.slug,
      display_name: exercise.name,
      target_sets: prescribedSets,
      target_reps: exercise.default_reps ?? 10,
      target_rep_range: `${Math.max(6, (exercise.default_reps ?? 10) - 2)}-${exercise.default_reps ?? 10} @ 3 RIR`,
      target_rir: 3,
      target_weight_kg: null,
      rest_seconds: restSecondsFromCns(exercise.cns_fatigue_cost),
      diagnostic_reason: 'minimum_viable_path_absolute_last_resort',
      slot_category: exercise.slot_category,
      tactical_role: exercise.tactical_role,
    },
  };
}

/**
 * Pick-level MVP fillers (exerciseId + sets only).
 * `finalizeIronDayBlockPrescriptions` / mapToIronPrescription adds weight, cues, notes.
 */
function createFillerPicks(
  catalog: Awaited<ReturnType<typeof fetchLibraryExercises>>,
  equipment: EquipmentTag[],
  blockedJointProfiles: readonly string[],
  focusLabel: string,
  excludedExerciseIds: ReadonlySet<string> = new Set(),
  excludedConceptKeys: ReadonlySet<string> = new Set(),
  count: number,
): EnrichedIronPick[] {
  if (count <= 0) return [];

  const exerciseCatalog = buildExerciseCatalog(catalog, { includeStarvationAliases: true });
  const usedConceptKeys = new Set(excludedConceptKeys);
  const selected: CatalogExercise[] = [];

  for (const exercise of catalog
    .filter(
      (row) =>
        !excludedExerciseIds.has(row.id) &&
        isMinimumViableCandidate(row, equipment, blockedJointProfiles),
    )
    .sort((a, b) => {
      const scoreDelta = candidateScoreForFocus(b, focusLabel) - candidateScoreForFocus(a, focusLabel);
      if (scoreDelta !== 0) return scoreDelta;
      return a.slug.localeCompare(b.slug);
    })) {
    const catalogExercise = exerciseCatalog.byId.get(exercise.id);
    if (!catalogExercise) continue;
    const conceptKey = fallbackConceptKey(catalogExercise);
    if (conceptKey && usedConceptKeys.has(conceptKey)) continue;
    if (conceptKey) usedConceptKeys.add(conceptKey);
    selected.push(catalogExercise);
    if (selected.length >= count) break;
  }

  return selected.map((exercise) => {
    const prescribedSets = setFloorForExercise(exercise);
    return stubFillerPick(exercise, prescribedSets);
  });
}

function injectMinimumViableIronPicks(
  dayBlocks: IronDayBlock[],
  catalog: Awaited<ReturnType<typeof fetchLibraryExercises>>,
  equipment: EquipmentTag[],
  blockedJointProfiles: readonly string[],
): void {
  const MINIMUM_EXERCISES_PER_TRAINING_DAY = 4;

  for (const day of dayBlocks) {
    if (day.picks.length >= MINIMUM_EXERCISES_PER_TRAINING_DAY) continue;

    const excluded = new Set(day.picks.map((pick) => pick.exerciseId));
    const excludedConcepts = new Set(
      day.picks
        .map((pick) => fallbackConceptKey(pick.exercise))
        .filter((key): key is string => key != null),
    );
    const fillers = createFillerPicks(
      catalog,
      equipment,
      blockedJointProfiles,
      day.focusLabel,
      excluded,
      excludedConcepts,
      Math.max(0, MINIMUM_EXERCISES_PER_TRAINING_DAY - day.picks.length),
    );
    day.picks.push(...fillers);
  }
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
      title: 'Nutrição Biológica',
      subtitle: `${target.total_calories} kcal · ${target.carbs_g}g C · ${target.protein_g}g P · ${target.fat_g}g F`,
      duration_minutes: 0,
      order,
      status: 'pending',
      nutrition: {
        goal: biological.nutrition_goal,
        note: `Carboidratos peri-treino: ${Math.round(target.carbs_g * target.peri_workout_carb_ratio)}g · Água ${target.water_ml}ml`,
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
  const biological = normalizeIronProfileForGeneration(input.biological);
  const preferredSplit = normalizePreferredSplit(biological.preferred_split);
  const exerciseCatalog = await fetchLibraryExercises();

  const equipmentFiltered = exerciseCatalog.filter((row) => equipmentMatches(row, input.equipment));
  const catalog = equipmentFiltered.length > 0 ? equipmentFiltered : exerciseCatalog;

  if (catalog.length === 0) {
    throw new Error('INSUFFICIENT_CATALOG: library_exercises empty or no equipment match.');
  }

  const pillarFreq = resolvePillarFrequencies(biological);
  const trainingDaysPerWeek = deriveActiveTrainingDays(pillarFreq);
  const pillarTime: PillarTimeBudget = {
    available_time_iron: biological.available_time_iron ?? 45,
  };

  const flatLogs = flattenPerformanceLogs(input.performanceLogs);
  const ironLogs3w = filterIronLogsLastDays(flatLogs, MESOCYCLE_DAYS);
  const ironLogs7d = filterIronLogsLastDays(flatLogs, WEEKLY_VOLUME_DAYS);
  const loadSnapshot = computeTrainingLoadSnapshot(input.performanceLogs, {
    goalIron: biological.goal_iron,
    mesocycleWeek: resolveMesocycleWeek(biological),
  });
  const injuryConstraints = detectIronInjuryConstraints(biological);

  const ironDayIndices = spreadPillarDayIndices(
    pillarFreq.frequency_iron,
    preferredSplit,
  ).sort((a, b) => a - b);

  const protocolDate = input.protocolDate ?? todayDateKey();
  const week_start_date = getWeekStartMonday(protocolDate);

  const ironMicrocycle = generateIronMicrocycle({
    libraryExercises: catalog,
    biological,
    equipment: input.equipment,
    logs7d: ironLogs7d,
    logs21d: ironLogs3w,
    ironDayIndices,
    weekStartDate: week_start_date,
    blockedJointProfiles: injuryConstraints.blocked_joint_profiles,
    goalIron: biological.goal_iron,
    availableMinutes: pillarTime.available_time_iron,
    // Defer map so prune → MVP → mapToIronPrescription run in linear order.
    deferPrescriptionMapping: true,
  });

  // Pipeline (linear): Solver+Coherence (above) → prune → MVP → map → intensity → adaptive → sanitize → authority
  pruneIronDayBlockPicks(
    ironMicrocycle,
    catalog,
    pillarTime.available_time_iron,
  );
  injectMinimumViableIronPicks(
    ironMicrocycle,
    catalog,
    input.equipment,
    injuryConstraints.blocked_joint_profiles,
  );
  finalizeIronDayBlockPrescriptions(
    ironMicrocycle,
    ironLogs3w,
    biological.goal_iron,
    preferredSplit,
  );

  const ironByDayIndex = new Map(ironMicrocycle.map((day) => [day.dayIndex, day]));

  let ironSlot = 0;
  const microcycle: MicrocycleDay[] = Array.from({ length: 7 }, (_, index) => {
    const day_index = index + 1;
    const wantsIron = ironDayIndices.includes(day_index);
    const active = wantsIron;

    if (!active) {
      const restFocus =
        preferredSplit === 'abcde'
          ? (abcdeRestDayFocusLabel(day_index) ?? 'Rest & Recovery')
          : 'Rest & Recovery';
      const restBlocks =
        preferredSplit === 'abcde' ? buildAbcdeRestDayBlocks(day_index) : [];

      return {
        day_index,
        is_rest_day: true,
        focus_label: restFocus,
        date: dateForDayIndex(week_start_date, day_index),
        blocks: restBlocks,
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
      if (!heuristicDay) {
        throw new Error(`MISSING_IRON_DAY: ${day_index}`);
      }
      ironBlockForPrereqs = buildIronGameplanBlock(
        heuristicDay,
        `block-d${day_index}-iron`,
        order,
        catalog,
        pillarTime.available_time_iron,
      );
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

  orderedMicrocycle = applyIntensityStrategies(
    orderedMicrocycle,
    biological,
    input.performanceLogs,
    catalog,
  );

  const adaptationInput: AdaptiveStateMachineInput = {
    biological,
    logs7d: filterPerformanceEntriesLastDays(input.performanceLogs, WEEKLY_VOLUME_DAYS),
    logs21d: filterPerformanceEntriesLastDays(input.performanceLogs, MESOCYCLE_DAYS),
    readinessScan: input.readinessScan,
    biometricCheckpoints: input.biometricCheckpoints,
  };
  const adaptationResult = await adaptGameplan(orderedMicrocycle, adaptationInput);
  orderedMicrocycle = adaptationResult.microcycle;

  const exerciseCatalogForAuthority = buildExerciseCatalog(catalog, {
    includeStarvationAliases: true,
  });
  orderedMicrocycle = sanitizeMicrocycleIronVolume(orderedMicrocycle, {
    biological,
    catalog: exerciseCatalogForAuthority,
  });
  const volumeTracker = createWeeklyVolumeTracker(
    exerciseCatalogForAuthority,
    ironLogs7d,
    ironLogs3w,
    biological,
  );
  orderedMicrocycle = enforceWeeklyAuthority(
    orderedMicrocycle,
    volumeTracker,
    exerciseCatalogForAuthority,
    {
      preferredSplit,
      biological,
    },
  );
  orderedMicrocycle = injectLongevityAddons(orderedMicrocycle);
  orderedMicrocycle = appendNutritionTargets(orderedMicrocycle, biological);

  emitMotorTelemetry({
    deloadSource: loadSnapshot.deload_source ?? null,
    microcycle: orderedMicrocycle,
  });

  const todayIndex = getDayIndexForDate(protocolDate, week_start_date);
  const blocks = orderedMicrocycle.find((day) => day.day_index === todayIndex)?.blocks ?? [];

  return {
    date: protocolDate,
    week_start_date,
    training_days_per_week: trainingDaysPerWeek,
    microcycle: orderedMicrocycle,
    blocks,
    generated_at: new Date().toISOString(),
    adaptation_logs: adaptationResult.adaptationLogs,
    clinical_review_trigger: null,
  };
}
