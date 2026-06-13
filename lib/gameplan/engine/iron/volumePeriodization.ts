import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import type { MesocyclePhase } from '@/types/biological';

export type VolumeExecutionTechnique = 'Standard' | 'Myo-Reps' | 'Drop-Set' | 'Rest-Pause';

export interface VolumeBudget {
  minSets: number;
  maxSets: number;
  targetRepRange: string;
  targetRIR: number;
  executionTechnique: VolumeExecutionTechnique;
}

const COMPOUND_ROLES = new Set(['primary_compound', 'secondary_compound']);

function normalizeCnsFatigue(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return score > 10 ? score / 10 : score;
}

function reduceVolumeForHighCnsFatigue(budget: VolumeBudget, cnsFatigueScore: number): VolumeBudget {
  if (normalizeCnsFatigue(cnsFatigueScore) <= 7) return budget;

  return {
    ...budget,
    minSets: Math.max(1, Math.floor(budget.minSets * 0.8)),
    maxSets: Math.max(1, Math.round(budget.maxSets * 0.8)),
  };
}

export function isCompoundExercise(exercise: Pick<CatalogExercise, 'tactical_role' | 'movement_pattern'>): boolean {
  if (exercise.tactical_role && COMPOUND_ROLES.has(exercise.tactical_role)) return true;
  return exercise.movement_pattern !== 'isolation';
}

export function resolveEffectiveMesocyclePhase(
  mesocyclePhase: MesocyclePhase | null | undefined,
  mesocycleWeek?: number | null,
): MesocyclePhase {
  if (mesocycleWeek === 4 || mesocycleWeek === 6) return 'deload';
  return mesocyclePhase ?? 'maintenance';
}

export function calculateVolumeBudget(
  exercise: CatalogExercise,
  mesocyclePhase: MesocyclePhase,
  isCompound: boolean,
  cnsFatigueScore: number,
): VolumeBudget {
  let budget: VolumeBudget;

  if (mesocyclePhase === 'bulking') {
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

  return reduceVolumeForHighCnsFatigue(budget, cnsFatigueScore);
}
