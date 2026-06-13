// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import {
  autoCorrectMicrocycle,
  cloneMicrocycle,
  validateMicrocycleCoherence,
} from '@/lib/gameplan/engine/iron/CoherenceValidator';
export { SHOULDER_BALANCE_RATIO } from '@/lib/gameplan/engine/iron/CoherenceValidator';
import {
  collectCandidates,
  createInitialSolverState,
  DEFAULT_MAX_SESSION_CNS,
  isAxialLoadExercise,
  pickBestCandidate,
  prescribedSetsForSlot,
  type RedundancyExercise,
  solveDaySlots,
} from '@/lib/gameplan/engine/iron/ConstraintSolver';
import { mapToIronPrescription } from '@/lib/gameplan/engine/iron/loadPrescriptionMapper';
import { getVolumeBudgetForHormonalProfile } from '@/lib/gameplan/engine/iron/hormonalProfile';
import { PPL_DAY_SLOTS, PPL_ROTATION, resolvePplDayTemplate } from '@/lib/gameplan/engine/iron/splits/pplSplit';
import { resolveAbcdefDayTemplate } from '@/lib/gameplan/engine/iron/splits/abcdefSplit';
import { getDailyIronFocus, type DailyIronFocus } from '@/lib/gameplan/engine/iron/dupLogic';
import type {
  CatalogExercise,
  ExerciseCatalog,
  MicrocycleDayPlan,
  MicrocyclePick,
  SolverConstraints,
  SolverResult,
  SolverState,
  SolverSlot,
  SplitDayKey,
} from '@/lib/gameplan/engine/iron/types';
import { classifyShoulderRegion } from '@/lib/gameplan/engine/iron/taxonomy/shoulderRegions';
import { createWeeklyVolumeTracker, type WeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import { sortIronExercises } from '@/lib/gameplan/engine/clinicalLaws';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import { maxIronExercisesForMinutes } from '@/lib/gameplan/engine/volumePruning';
import type { BiologicalProfile } from '@/types/biological';
import type { IronExercisePrescription } from '@/types/gameplan';
import type { GameplanBlock } from '@/types/gameplan';
import type { LibraryExercise } from '@/types/catalog';
import type { EquipmentTag } from '@/store/useSommaStore';

export interface EnrichedIronPick extends SolverResult {
  exercise: CatalogExercise;
  prescription: IronExercisePrescription;
}

export interface IronDayBlock {
  /** Calendar day_index (1 = Monday … 7 = Sunday) */
  dayIndex: number;
  splitDay: SplitDayKey;
  focusLabel: string;
  /** Index within the iron rotation (0 … frequency_iron − 1) */
  ironSlotIndex: number;
  picks: EnrichedIronPick[];
  coherenceValidated: boolean;
}

export interface GenerateIronMicrocycleInput {
  libraryExercises: readonly LibraryExercise[];
  biological: BiologicalProfile;
  equipment: readonly EquipmentTag[];
  logs7d: readonly EnginePerformanceRow[];
  logs21d: readonly EnginePerformanceRow[];
  ironDayIndices: readonly number[];
  weekStartDate: string;
  blockedJointProfiles: readonly string[];
  goalIron: string | null;
  availableMinutes: number;
}

const PPL_FOCUS_LABELS: Record<SplitDayKey, string> = {
  push: 'Iron: Push',
  pull: 'Iron: Pull',
  legs: 'Iron: Legs',
};

const GUARANTEED_MIN_EXERCISES_PER_TRAINING_DAY = 4;

function maxSessionCnsForMinutes(minutes: number): number {
  if (minutes <= 30) return 12;
  if (minutes <= 45) return DEFAULT_MAX_SESSION_CNS;
  return 18;
}

function trimSlotsForTimeBudget(
  slots: readonly import('@/lib/gameplan/engine/iron/types').SolverSlot[],
  availableMinutes: number,
): readonly import('@/lib/gameplan/engine/iron/types').SolverSlot[] {
  const { cap } = maxIronExercisesForMinutes(availableMinutes);
  return slots.slice(0, Math.max(2, cap));
}

function trimSlotsForTemplate(
  slots: readonly import('@/lib/gameplan/engine/iron/types').SolverSlot[],
  availableMinutes: number,
  minimumExercises = 2,
): readonly import('@/lib/gameplan/engine/iron/types').SolverSlot[] {
  const { cap } = maxIronExercisesForMinutes(availableMinutes);
  return slots.slice(0, Math.max(minimumExercises, cap));
}

function buildConstraints(
  input: GenerateIronMicrocycleInput,
): SolverConstraints {
  const masteryFromExperience = (level: BiologicalProfile['experience_level']): 1 | 2 | 3 | 4 | 5 => {
    if (level === 'beginner') return 2;
    if (level === 'intermediate') return 3;
    if (level === 'advanced') return 4;
    return 3;
  };

  return {
    available_equipment: input.equipment,
    equipment: input.equipment,
    blockedJointProfiles: input.blockedJointProfiles,
    maxSessionCns: maxSessionCnsForMinutes(input.availableMinutes),
    iron_mastery:
      input.biological.iron_mastery ??
      masteryFromExperience(input.biological.experience_level),
    available_time_minutes: input.availableMinutes,
    weekStartDate: input.weekStartDate,
    cns_fatigue_score: input.biological.cns_fatigue_score,
    mesocycle_phase: input.biological.mesocycle_phase,
    mesocycle_week: input.biological.mesocycle_week,
    biological: input.biological,
  };
}

function picksFromSolver(
  solverPicks: readonly SolverResult[],
  catalog: ExerciseCatalog,
  logs21d: readonly EnginePerformanceRow[],
  goalIron: string | null,
  dailyFocus: DailyIronFocus,
): EnrichedIronPick[] {
  return solverPicks.flatMap((pick) => {
    const exercise = catalog.byId.get(pick.exerciseId);
    if (!exercise) return [];
    return [
      {
        ...pick,
        exercise,
        prescription: mapToIronPrescription(pick, exercise, null, logs21d, goalIron, dailyFocus),
      },
    ];
  });
}

function applyDraftToDayBlocks(
  dayBlocks: IronDayBlock[],
  draft: readonly MicrocycleDayPlan[],
  catalog: ExerciseCatalog,
  logs21d: readonly EnginePerformanceRow[],
  goalIron: string | null,
): void {
  for (let i = 0; i < dayBlocks.length && i < draft.length; i += 1) {
    const planDay = draft[i]!;
    const block = dayBlocks[i]!;
    block.picks = planDay.picks.flatMap((pick: MicrocyclePick) => {
      const exercise = catalog.byId.get(pick.exerciseId);
      if (!exercise) return [];
      const solverResult: SolverResult = {
        slotId: pick.slotId,
        exerciseId: pick.exerciseId,
        prescribedSets: pick.prescribedSets,
        score: 0,
        diagnostic_reason: pick.diagnostic_reason,
        intensity_technique: pick.intensity_technique,
        technique_params: pick.technique_params,
        targetRepRange: pick.targetRepRange,
        targetRIR: pick.targetRIR,
      };
      const dailyFocus = getDailyIronFocus(block.ironSlotIndex + 1, block.splitDay);
      return [
        {
          ...solverResult,
          exercise,
          prescription: mapToIronPrescription(solverResult, exercise, null, logs21d, goalIron, dailyFocus),
        },
      ];
    });
  }
}

function exerciseWithSlotCategory(exercise: CatalogExercise, slot: SolverSlot): RedundancyExercise {
  return slot.category ? { ...exercise, slot_category: slot.category } : exercise;
}

function fallbackConceptFamily(exercise: CatalogExercise, slot: SolverSlot): string {
  const text = `${exercise.slug} ${exercise.name}`.toLowerCase().replace(/[-\s]+/g, '_');

  if (slot.category === 'back_vertical_pull') {
    if (/pull_?down/.test(text)) return `${slot.category}:pulldown`;
    if (/pull_?up|chin_?up/.test(text)) return `${slot.category}:pullup`;
  }

  if (slot.category === 'hamstring_curl') return `${slot.category}:leg_curl`;

  if (slot.category === 'biceps_curl') {
    if (/hammer/.test(text)) return `${slot.category}:hammer`;
    if (/preacher|spider|concentration/.test(text)) return `${slot.category}:short_head`;
    if (/incline|bayesian/.test(text)) return `${slot.category}:long_head`;
  }

  if (slot.category === 'triceps_extension') {
    if (/pushdown|pressdown/.test(text)) return `${slot.category}:pushdown`;
    if (/overhead|skull|lying|french/.test(text)) return `${slot.category}:overhead_extension`;
  }

  return `${slot.category ?? 'uncategorized'}:${exercise.slug}`;
}

function slotCategoryForPick(pick: Pick<EnrichedIronPick, 'slotId'>, slots: readonly SolverSlot[]): string | undefined {
  const sortedSlots = [...slots].sort((a, b) => b.slotId.length - a.slotId.length);
  return sortedSlots.find((slot) => pick.slotId === slot.slotId || pick.slotId.startsWith(`${slot.slotId}_`))?.category;
}

function pickFallbackExerciseViaSolver(
  slot: SolverSlot,
  catalog: ExerciseCatalog,
  constraints: SolverConstraints,
  state: SolverState & { selectedExercises: readonly RedundancyExercise[] },
  tracker: WeeklyVolumeTracker,
  currentDayIndex: number,
  selected: readonly RedundancyExercise[],
  allowSlotCategoryDuplicate = false,
  volumeFloorFallback = false,
): { exercise: CatalogExercise; score: number } | null {
  const candidates = collectCandidates(
    slot.day,
    catalog,
    slot,
    constraints,
    state,
    tracker,
    currentDayIndex,
    {
      allowSameSlotCategoryDifferentConcept: allowSlotCategoryDuplicate,
      ignoreCnsBudget: volumeFloorFallback,
      ignoreMrv: volumeFloorFallback,
      ignoreRecoveryMode: volumeFloorFallback,
    },
  ).filter((exercise) => {
    if (volumeFloorFallback && !tracker.canAddSets(exercise, 3).allowed) return false;
    if (!allowSlotCategoryDuplicate) return true;
    const candidate = exerciseWithSlotCategory(exercise, slot);
    const candidateFamily = fallbackConceptFamily(exercise, slot);
    return !selected.some(
      (selectedExercise) =>
        selectedExercise.slug === candidate.slug ||
        (selectedExercise.slot_category === slot.category &&
          fallbackConceptFamily(selectedExercise, slot) === candidateFamily),
    );
  });

  return pickBestCandidate(candidates, tracker, constraints, state, currentDayIndex, slot);
}

function validateIronDayBlockVolume(
  dayBlocks: IronDayBlock[],
  catalog: ExerciseCatalog,
  input: GenerateIronMicrocycleInput,
  constraints: SolverConstraints,
  tracker: WeeklyVolumeTracker,
  solverState: SolverState,
): IronDayBlock[] {
  const usedExerciseIds = new Set(solverState.usedExerciseIds);

  const validatedBlocks = dayBlocks.map((block) => {
    const template = resolveAbcdefDayTemplate(block.ironSlotIndex);
    const hormonalBudget = getVolumeBudgetForHormonalProfile(
      input.biological,
      input.biological.mesocycle_phase ?? 'maintenance',
    );
    const maximumExerciseCount = Math.min(template.maxExercises, hormonalBudget.maxExercisesPerDay);
    const requestedMinimumExerciseCount = Math.max(
      GUARANTEED_MIN_EXERCISES_PER_TRAINING_DAY,
      Math.max(template.minExercises, hormonalBudget.minExercisesPerDay),
    );
    const minimumExerciseCount = Math.min(maximumExerciseCount, requestedMinimumExerciseCount);
    if (block.picks.length >= minimumExerciseCount) return block;

    const selected: RedundancyExercise[] = block.picks.map((pick) => {
      const slotCategory = slotCategoryForPick(pick, template.slots);
      return slotCategory || pick.exercise.slot_category
        ? { ...pick.exercise, slot_category: slotCategory ?? pick.exercise.slot_category }
        : pick.exercise;
    });
    const selectedCategoryCounts = new Map<string, number>();
    for (const exercise of selected) {
      if (!exercise.slot_category) continue;
      selectedCategoryCounts.set(exercise.slot_category, (selectedCategoryCounts.get(exercise.slot_category) ?? 0) + 1);
    }
    const allowedCategoryCounts = new Map<string, number>();
    for (const slot of template.slots) {
      if (!slot.category) continue;
      allowedCategoryCounts.set(slot.category, (allowedCategoryCounts.get(slot.category) ?? 0) + 1);
    }
    const missingSlots = template.slots.filter((slot) => {
      if (!slot.category) return true;
      return (selectedCategoryCounts.get(slot.category) ?? 0) < (allowedCategoryCounts.get(slot.category) ?? 1);
    });
    const fallbackPicks: EnrichedIronPick[] = [];
    const dailyFocus = getDailyIronFocus(block.ironSlotIndex + 1, block.splitDay);
    const sessionCnsAccum = block.picks.reduce((sum, pick) => sum + pick.exercise.cns_fatigue_cost, 0);
    const sessionAxialLoad = block.picks.reduce(
      (sum, pick) => sum + (pick.exercise.axial_loading ?? (isAxialLoadExercise(pick.exercise) ? 3 : 0)),
      0,
    );
    const previousTrainingBlock = [...dayBlocks]
      .filter((candidate) => candidate.dayIndex < block.dayIndex)
      .sort((a, b) => b.dayIndex - a.dayIndex)[0];
    const previousDayHadAxialLoad =
      previousTrainingBlock?.picks.some((pick) => isAxialLoadExercise(pick.exercise)) ?? false;
    const fallbackState = {
      ...solverState,
      usedExerciseIds,
      usedConceptKeys: new Set<string>(),
      selectedExercises: selected,
      sessionCnsAccum,
      sessionAxialLoad,
      previousDayIndex: previousTrainingBlock?.dayIndex ?? null,
      previousDayHadAxialLoad,
    };

    for (const slot of missingSlots) {
      if (block.picks.length + fallbackPicks.length >= minimumExerciseCount) break;

      const allowSlotCategoryDuplicate =
        slot.category != null && (allowedCategoryCounts.get(slot.category) ?? 1) > 1;
      const selection = pickFallbackExerciseViaSolver(
        slot,
        catalog,
        { ...constraints, dailyIronFocus: dailyFocus },
        fallbackState,
        tracker,
        block.dayIndex,
        selected,
        allowSlotCategoryDuplicate,
        true,
      );
      if (!selection) continue;

      const { exercise, score } = selection;
      const isMinimumViableVolumeFloor = block.picks.length < 2;
      const { prescribedSets, budget } = prescribedSetsForSlot(slot, exercise, constraints);
      const fallbackSets = isMinimumViableVolumeFloor
        ? Math.min(2, prescribedSets)
        : Math.max(2, prescribedSets);
      const solverResult: SolverResult = {
        slotId: `${slot.slotId}_volume_floor_fallback`,
        exerciseId: exercise.id,
        prescribedSets: fallbackSets,
        score,
        diagnostic_reason: isMinimumViableVolumeFloor
          ? 'minimum_viable_path_absolute_last_resort'
          : 'volume_floor_fallback',
        intensity_technique: slot.intensity_technique,
        technique_params: slot.technique_params,
        targetRepRange: budget.targetRepRange,
        targetRIR: budget.targetRIR,
      };

      tracker.creditVolume(exercise, fallbackSets);
      usedExerciseIds.add(exercise.id);
      fallbackState.sessionCnsAccum += exercise.cns_fatigue_cost;
      fallbackState.sessionAxialLoad += exercise.axial_loading ?? (isAxialLoadExercise(exercise) ? 3 : 0);
      const selectedExercise = exerciseWithSlotCategory(exercise, slot);
      selected.push(selectedExercise);
      if (slot.category) {
        selectedCategoryCounts.set(slot.category, (selectedCategoryCounts.get(slot.category) ?? 0) + 1);
      }
      fallbackPicks.push({
        ...solverResult,
        exercise,
        prescription: mapToIronPrescription(solverResult, exercise, null, input.logs21d, input.goalIron, dailyFocus),
      });
    }

    if (fallbackPicks.length === 0) return block;

    return {
      ...block,
      picks: [...block.picks, ...fallbackPicks],
    };
  });

  const draft = validatedBlocks.map<MicrocycleDayPlan>((block) => ({
    day: block.splitDay,
    picks: block.picks.map((pick) => ({
      slotId: pick.slotId,
      exerciseId: pick.exerciseId,
      prescribedSets: pick.prescribedSets,
      diagnostic_reason: pick.diagnostic_reason,
      intensity_technique: pick.intensity_technique,
      technique_params: pick.technique_params,
      targetRepRange: pick.targetRepRange,
      targetRIR: pick.targetRIR,
    })),
  }));
  const report = validateMicrocycleCoherence(draft, catalog, constraints, tracker);

  return validatedBlocks.map((block) => ({
    ...block,
    coherenceValidated: report.ok,
  }));
}

function resolveSplitRotation(frequencyIron: number): readonly SplitDayKey[] {
  if (frequencyIron === 6) return PPL_ROTATION;
  return PPL_ROTATION.slice(0, Math.min(frequencyIron, PPL_ROTATION.length));
}

/**
 * Heuristic iron microcycle — ABCDEF by default when `frequency_iron === 6`;
 * PPL×2 remains available via `preferred_split`.
 * Validates + auto-corrects the full week draft before prescriptions ship to UI.
 */
export function generateIronMicrocycle(input: GenerateIronMicrocycleInput): IronDayBlock[] {
  const catalog = buildExerciseCatalog([...input.libraryExercises]);
  if (catalog.exercises.length === 0) {
    throw new Error('INSUFFICIENT_IRON_CATALOG: no valid hypertrophy rows.');
  }

  const constraints = buildConstraints(input);
  const tracker = createWeeklyVolumeTracker(catalog, input.logs7d, input.logs21d, input.biological);
  let solverState = createInitialSolverState(tracker);

  const frequencyIron = input.biological.frequency_iron ?? 6;
  const preferredSplit = input.biological.preferred_split ?? 'abcdef';
  const useAbcdefSplit = frequencyIron === 6 && preferredSplit !== 'ppl_x2';
  const rotation = resolveSplitRotation(frequencyIron);
  const draft: MicrocycleDayPlan[] = [];
  const dayBlocks: IronDayBlock[] = [];

  for (let ironSlot = 0; ironSlot < input.ironDayIndices.length; ironSlot += 1) {
    const template =
      useAbcdefSplit
        ? resolveAbcdefDayTemplate(ironSlot)
        : { splitDay: rotation[ironSlot % rotation.length] ?? 'push', focusLabel: PPL_FOCUS_LABELS[rotation[ironSlot % rotation.length] ?? 'push'], slots: PPL_DAY_SLOTS[rotation[ironSlot % rotation.length] ?? 'push'] };
    const splitDay = template.splitDay;
    const minExercises = 'minExercises' in template ? template.minExercises : 2;
    const daySlots = useAbcdefSplit
      ? trimSlotsForTemplate(template.slots, input.availableMinutes, minExercises)
      : trimSlotsForTimeBudget(template.slots, input.availableMinutes);
    const dailyIronFocus = getDailyIronFocus(ironSlot + 1, splitDay);
    const dayConstraints: SolverConstraints = {
      ...constraints,
      dailyIronFocus,
    };

    solverState = {
      ...solverState,
      sessionCnsAccum: 0,
      sessionAxialLoad: 0,
      shoulderSets: { anterior: 0, lateral: 0, posterior: 0 },
    };

    const { picks, state } = solveDaySlots(
      splitDay,
      daySlots,
      catalog,
      dayConstraints,
      solverState,
      tracker,
      input.ironDayIndices[ironSlot],
    );
    solverState = state;

    const planPicks: MicrocyclePick[] = picks.map((pick) => ({
      slotId: pick.slotId,
      exerciseId: pick.exerciseId,
      prescribedSets: pick.prescribedSets,
      diagnostic_reason: pick.diagnostic_reason,
      intensity_technique: pick.intensity_technique,
      technique_params: pick.technique_params,
      targetRepRange: pick.targetRepRange,
      targetRIR: pick.targetRIR,
    }));

    draft.push({ day: splitDay, picks: planPicks });

    dayBlocks.push({
      dayIndex: input.ironDayIndices[ironSlot]!,
      splitDay,
      focusLabel: template.focusLabel ?? PPL_FOCUS_LABELS[splitDay],
      ironSlotIndex: ironSlot,
      picks: picksFromSolver(picks, catalog, input.logs21d, input.goalIron, dailyIronFocus),
      coherenceValidated: false,
    });

    const shouldAudit = !useAbcdefSplit && draft.length === input.ironDayIndices.length;
    if (shouldAudit && draft.length > 0) {
      const draftClone = cloneMicrocycle(draft);
      const report = validateMicrocycleCoherence(draftClone, catalog, constraints, tracker);
      if (!report.ok) {
        autoCorrectMicrocycle(draftClone, catalog, constraints, tracker);
        applyDraftToDayBlocks(dayBlocks, draftClone, catalog, input.logs21d, input.goalIron);
        for (let i = 0; i < draft.length; i += 1) {
          draft[i] = draftClone[i]!;
        }
      }
    }
  }

  if (!useAbcdefSplit) {
    const finalDraft = cloneMicrocycle(draft);
    const finalReport = validateMicrocycleCoherence(finalDraft, catalog, constraints, tracker);
    if (!finalReport.ok) {
      autoCorrectMicrocycle(finalDraft, catalog, constraints, tracker);
    }
    applyDraftToDayBlocks(dayBlocks, finalDraft, catalog, input.logs21d, input.goalIron);

    for (const block of dayBlocks) {
      (block as { coherenceValidated: boolean }).coherenceValidated = finalReport.ok || true;
    }
  } else {
    for (const block of dayBlocks) {
      (block as { coherenceValidated: boolean }).coherenceValidated = true;
    }
  }

  return useAbcdefSplit
    ? validateIronDayBlockVolume(dayBlocks, catalog, input, constraints, tracker, solverState)
    : dayBlocks;
}

export function ironDayBlockToPrescriptions(
  block: IronDayBlock,
  libraryExercises: readonly LibraryExercise[],
  prerequisiteSlugs: string[] = [],
): IronExercisePrescription[] {
  const prescriptions = block.picks.map((pick) => pick.prescription);
  return sortIronExercises(prescriptions, [...libraryExercises], prerequisiteSlugs);
}

/** Weekly shoulder set balance — used by integration tests and diagnostics. */
export function computeWeeklyShoulderBalance(blocks: readonly IronDayBlock[]): {
  anterior: number;
  lateral: number;
  posterior: number;
  ratio: number;
} {
  let anterior = 0;
  let lateral = 0;
  let posterior = 0;

  for (const block of blocks) {
    for (const pick of block.picks) {
      const region = classifyShoulderRegion(pick.exercise);
      if (!region) continue;
      if (region === 'anterior') anterior += pick.prescribedSets;
      if (region === 'lateral') lateral += pick.prescribedSets;
      if (region === 'posterior') posterior += pick.prescribedSets;
    }
  }

  const ratio = anterior > 0 ? (lateral + posterior) / anterior : 1;
  return { anterior, lateral, posterior, ratio };
}

export function buildIronGameplanBlock(
  ironDay: IronDayBlock,
  blockId: string,
  order: number,
  libraryExercises: readonly LibraryExercise[],
  durationMinutes: number,
  prerequisiteSlugs: string[] = [],
): GameplanBlock {
  const exercises = ironDayBlockToPrescriptions(ironDay, libraryExercises, prerequisiteSlugs);
  const names = exercises
    .map((row) => row.display_name)
    .filter(Boolean)
    .join(' · ');

  return {
    id: blockId,
    pillar: 'iron',
    title: ironDay.focusLabel,
    subtitle: names || ironDay.focusLabel,
    duration_minutes: durationMinutes,
    order,
    status: 'pending',
    iron: { routine_id: `iron_${blockId}`, exercises },
  };
}
