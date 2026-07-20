import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import { getVolumeBudgetForHormonalProfile } from '@/lib/gameplan/engine/iron/hormonalProfile';
import type { MesocyclePhase, UserBiological } from '@/types/biological';
import { normalizePreferredSplit } from '@/types/biological';

export type VolumeExecutionTechnique = 'Standard' | 'Myo-Reps' | 'Drop-Set' | 'Rest-Pause';

export interface VolumeBudget {
  minSets: number;
  maxSets: number;
  targetRepRange: string;
  targetRIR: number;
  executionTechnique: VolumeExecutionTechnique;
}

const COMPOUND_ROLES = new Set(['primary_compound', 'secondary_compound']);

export function isCompoundExercise(exercise: Pick<CatalogExercise, 'tactical_role' | 'movement_pattern'>): boolean {
  if (exercise.tactical_role && COMPOUND_ROLES.has(exercise.tactical_role)) return true;
  return exercise.movement_pattern !== 'isolation';
}

/**
 * The only automatic deload trigger: calendar weeks 4 and 6 lower phase volume
 * budgets. Subjective fatigue, readiness, RPE and ACWR never trigger deloads.
 */
export const DEFAULT_PHASE_BUDGET_DELOAD_WEEKS = [4, 6] as const;

export type DeloadSource = 'phase_budget';

export interface PhaseBudgetDeloadSpec {
  deloadWeeks?: readonly number[];
}

export interface DeloadWeekResolution {
  isDeloadWeek: boolean;
  deload_source: DeloadSource | null;
  phaseBudgetActive: boolean;
}

export function resolveDeloadWeek(
  weekNumber: number,
  phaseBudget: PhaseBudgetDeloadSpec | null | undefined,
  _legacyClinicalMonth?: unknown,
): DeloadWeekResolution {
  const safeWeek = Number.isFinite(weekNumber) ? Math.round(weekNumber) : 0;
  const budgetWeeks = phaseBudget?.deloadWeeks ?? DEFAULT_PHASE_BUDGET_DELOAD_WEEKS;
  const phaseBudgetActive = budgetWeeks.includes(safeWeek);

  return {
    isDeloadWeek: phaseBudgetActive,
    deload_source: phaseBudgetActive ? 'phase_budget' : null,
    phaseBudgetActive,
  };
}

export function resolveEffectiveMesocyclePhase(
  mesocyclePhase: MesocyclePhase | null | undefined,
  mesocycleWeek?: number | null,
): MesocyclePhase {
  if (
    mesocycleWeek != null &&
    resolveDeloadWeek(mesocycleWeek, null, null).phaseBudgetActive
  ) {
    return 'deload';
  }
  return mesocyclePhase ?? 'maintenance';
}

export function calculateVolumeBudget(
  exercise: CatalogExercise,
  biological: UserBiological,
  isCompound: boolean,
): VolumeBudget {
  const mesocyclePhase = biological.mesocycle_phase ?? 'maintenance';
  const hormonalBudget = getVolumeBudgetForHormonalProfile(biological, mesocyclePhase);
  const usesEnhancedRecovery = biological.hormonal_protocol != null && biological.hormonal_protocol.type !== 'natural';
  const usesAbcdeSplit = normalizePreferredSplit(biological.preferred_split) === 'abcde';
  let budget: VolumeBudget;

  if (mesocyclePhase === 'bulking' && usesEnhancedRecovery) {
    budget = isCompound
      ? {
          minSets: 4,
          maxSets: Math.min(6, Math.max(4, hormonalBudget.targetSetsPerSession)),
          targetRepRange: '6-10',
          targetRIR: 1,
          executionTechnique: 'Standard',
        }
      : {
          minSets: 4,
          maxSets: Math.min(8, Math.max(4, hormonalBudget.targetSetsPerSession)),
          targetRepRange: '10-15',
          targetRIR: 2,
          executionTechnique: 'Myo-Reps',
        };
  } else if (mesocyclePhase === 'cutting' && usesEnhancedRecovery) {
    budget = isCompound
      ? {
          minSets: 4,
          maxSets: Math.min(5, Math.max(4, hormonalBudget.targetSetsPerSession)),
          targetRepRange: '8-12',
          targetRIR: 2,
          executionTechnique: 'Standard',
        }
      : {
          minSets: 5,
          maxSets: Math.min(8, Math.max(5, hormonalBudget.targetSetsPerSession)),
          targetRepRange: '12-20',
          targetRIR: 2,
          executionTechnique: 'Myo-Reps',
        };
  } else if (mesocyclePhase === 'bulking') {
    budget = isCompound
      ? {
          minSets: 4,
          maxSets: 5,
          targetRepRange: '5-8',
          targetRIR: 1,
          executionTechnique: 'Standard',
        }
      : {
          minSets: 3,
          maxSets: 4,
          targetRepRange: '8-12',
          targetRIR: 2,
          executionTechnique: 'Standard',
        };
  } else if (mesocyclePhase === 'cutting') {
    budget = isCompound
      ? {
          minSets: 4,
          maxSets: 5,
          targetRepRange: '8-12',
          targetRIR: 2,
          executionTechnique: 'Standard',
        }
      : {
          minSets: 5,
          maxSets: 7,
          targetRepRange: '12-15',
          targetRIR: 2,
          executionTechnique: 'Myo-Reps',
        };
  } else if (mesocyclePhase === 'maintenance') {
    budget = isCompound
      ? {
          minSets: 3,
          maxSets: 4,
          targetRepRange: '8-12',
          targetRIR: 2,
          executionTechnique: 'Standard',
        }
      : {
          minSets: 3,
          maxSets: 4,
          targetRepRange: '10-15',
          targetRIR: 2,
          executionTechnique: 'Standard',
        };
  } else {
    budget = {
      minSets: 2,
      maxSets: 3,
      targetRepRange: '10-15',
      targetRIR: 3,
      executionTechnique: 'Standard',
    };
  }

  if (usesAbcdeSplit && mesocyclePhase !== 'deload') {
    if (!usesEnhancedRecovery) {
      budget = isCompound
        ? {
            minSets: 4,
            maxSets: 5,
            targetRepRange: '6-10',
            targetRIR: 1,
            executionTechnique: 'Standard',
          }
        : {
            minSets: 3,
            maxSets: 4,
            targetRepRange: '10-15',
            targetRIR: 2,
            executionTechnique: 'Standard',
          };
    } else {
      // TRT / enhanced: raise per-exercise ceiling so the boosted weekly MEV can be realized.
      budget = isCompound
        ? {
            minSets: 5,
            maxSets: 6,
            targetRepRange: '6-10',
            targetRIR: 1,
            executionTechnique: 'Standard',
          }
        : {
            minSets: 4,
            maxSets: 5,
            targetRepRange: '10-15',
            targetRIR: 2,
            executionTechnique: 'Standard',
          };
    }
  }

  return budget;
}
