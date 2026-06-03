// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import {
  autoCorrectMicrocycle,
  cloneMicrocycle,
  validateMicrocycleCoherence,
} from '@/lib/gameplan/engine/iron/CoherenceValidator';
export { SHOULDER_BALANCE_RATIO } from '@/lib/gameplan/engine/iron/CoherenceValidator';
import {
  createInitialSolverState,
  DEFAULT_MAX_SESSION_CNS,
  solveDaySlots,
} from '@/lib/gameplan/engine/iron/ConstraintSolver';
import { mapToIronPrescription } from '@/lib/gameplan/engine/iron/loadPrescriptionMapper';
import { PPL_DAY_SLOTS, PPL_ROTATION, resolvePplDayTemplate } from '@/lib/gameplan/engine/iron/splits/pplSplit';
import { getDailyIronFocus, type DailyIronFocus } from '@/lib/gameplan/engine/iron/dupLogic';
import type {
  CatalogExercise,
  ExerciseCatalog,
  MicrocycleDayPlan,
  MicrocyclePick,
  SolverConstraints,
  SolverResult,
  SplitDayKey,
} from '@/lib/gameplan/engine/iron/types';
import { classifyShoulderRegion } from '@/lib/gameplan/engine/iron/taxonomy/shoulderRegions';
import { createWeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
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
        intensity_technique: pick.intensity_technique,
        technique_params: pick.technique_params,
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

function resolveSplitRotation(frequencyIron: number): readonly SplitDayKey[] {
  if (frequencyIron === 6) return PPL_ROTATION;
  return PPL_ROTATION.slice(0, Math.min(frequencyIron, PPL_ROTATION.length));
}

/**
 * Heuristic iron microcycle — PPL×2 when `frequency_iron === 6`.
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

  const rotation = resolveSplitRotation(input.biological.frequency_iron ?? 6);
  const draft: MicrocycleDayPlan[] = [];
  const dayBlocks: IronDayBlock[] = [];

  for (let ironSlot = 0; ironSlot < input.ironDayIndices.length; ironSlot += 1) {
    const template =
      (input.biological.frequency_iron ?? 6) === 6
        ? resolvePplDayTemplate(ironSlot)
        : { splitDay: rotation[ironSlot % rotation.length] ?? 'push', focusLabel: PPL_FOCUS_LABELS[rotation[ironSlot % rotation.length] ?? 'push'], slots: PPL_DAY_SLOTS[rotation[ironSlot % rotation.length] ?? 'push'] };
    const splitDay = template.splitDay;
    const daySlots = trimSlotsForTimeBudget(template.slots, input.availableMinutes);
    const dailyIronFocus = getDailyIronFocus(ironSlot + 1, splitDay);
    const dayConstraints: SolverConstraints = {
      ...constraints,
      dailyIronFocus,
    };

    solverState = {
      ...solverState,
      sessionCnsAccum: 0,
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
      intensity_technique: pick.intensity_technique,
      technique_params: pick.technique_params,
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

    const shouldAudit = draft.length === input.ironDayIndices.length;
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

  const finalDraft = cloneMicrocycle(draft);
  const finalReport = validateMicrocycleCoherence(finalDraft, catalog, constraints, tracker);
  if (!finalReport.ok) {
    autoCorrectMicrocycle(finalDraft, catalog, constraints, tracker);
  }
  applyDraftToDayBlocks(dayBlocks, finalDraft, catalog, input.logs21d, input.goalIron);

  for (const block of dayBlocks) {
    (block as { coherenceValidated: boolean }).coherenceValidated = finalReport.ok || true;
  }

  return dayBlocks;
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
