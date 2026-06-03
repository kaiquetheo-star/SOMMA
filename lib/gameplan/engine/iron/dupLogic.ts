import type { ExerciseTempo } from '@/types/catalog';

type DupSplitDay = 'push' | 'pull' | 'legs';

export type DailyIronFocusKey =
  | 'metabolic_hypertrophy'
  | 'pure_mechanical_tension'
  | 'stretch_mediated'
  | 'unilateral_stability';

export interface DailyIronFocus {
  focus: DailyIronFocusKey;
  targetRepRange: [number, number];
  defaultTempo: ExerciseTempo;
}

/**
 * Regra 5.1: DUP deterministicamente alterna vias de estímulo no PPLx2.
 * `dayIndex` é o índice do treino Iron dentro da rotação de 6 dias (1-6).
 */
export function getDailyIronFocus(dayIndex: number, split: DupSplitDay): DailyIronFocus {
  const normalizedDay = ((Math.max(1, Math.round(dayIndex)) - 1) % 6) + 1;

  if (split === 'legs' && normalizedDay === 3) {
    return {
      focus: 'pure_mechanical_tension',
      targetRepRange: [5, 8],
      defaultTempo: [3, 1, 'X', 0],
    };
  }

  if (split === 'legs' && normalizedDay === 6) {
    return {
      focus: 'unilateral_stability',
      targetRepRange: [10, 12],
      defaultTempo: [2, 1, 1, 1],
    };
  }

  if (normalizedDay === 2 || normalizedDay === 5) {
    return {
      focus: 'stretch_mediated',
      targetRepRange: [10, 15],
      defaultTempo: [3, 1, 1, 1],
    };
  }

  return {
    focus: 'metabolic_hypertrophy',
    targetRepRange: [8, 12],
    defaultTempo: [3, 0, 1, 1],
  };
}
