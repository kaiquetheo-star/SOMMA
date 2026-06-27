import type { ExerciseTempo } from '@/types/catalog';
import type { PreferredSplit } from '@/types/biological';
import { normalizePreferredSplit } from '@/types/biological';

export type DupSplitDay = 'push' | 'pull' | 'legs';

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

/** ABCDE calendar day 6 — Weak Point · Arms · Core. */
export const ABCDE_ARMS_CALENDAR_DAY = 6;

export interface DailyIronFocusContext {
  preferredSplit?: PreferredSplit | string | null;
  /** Calendar day_index (1–7), not iron slot rotation index. */
  calendarDayIndex?: number;
}

function getPplDailyIronFocus(dayIndex: number, split: DupSplitDay): DailyIronFocus {
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

/**
 * ABCDE X-Frame DUP — explicit calendar mapping (days 1, 2, 4, 5, 6).
 * Avoids PPL modulo fallbacks that mis-assign Pull/Legs posterior stimulus.
 */
function getAbcdeDailyIronFocus(calendarDayIndex: number, split: DupSplitDay): DailyIronFocus {
  switch (calendarDayIndex) {
    case 1:
      return {
        focus: 'metabolic_hypertrophy',
        targetRepRange: [8, 12],
        defaultTempo: [3, 0, 1, 1],
      };
    case 2:
      if (split === 'legs') {
        return {
          focus: 'pure_mechanical_tension',
          targetRepRange: [5, 8],
          defaultTempo: [3, 1, 'X', 0],
        };
      }
      return {
        focus: 'metabolic_hypertrophy',
        targetRepRange: [8, 12],
        defaultTempo: [3, 0, 1, 1],
      };
    case 4:
      return {
        focus: 'stretch_mediated',
        targetRepRange: [10, 15],
        defaultTempo: [3, 1, 1, 1],
      };
    case 5:
      if (split === 'legs') {
        return {
          focus: 'unilateral_stability',
          targetRepRange: [10, 12],
          defaultTempo: [2, 1, 1, 1],
        };
      }
      return {
        focus: 'stretch_mediated',
        targetRepRange: [10, 15],
        defaultTempo: [3, 1, 1, 1],
      };
    case ABCDE_ARMS_CALENDAR_DAY:
      return {
        focus: 'metabolic_hypertrophy',
        targetRepRange: [10, 15],
        defaultTempo: [3, 1, 1, 1],
      };
    default:
      return {
        focus: 'metabolic_hypertrophy',
        targetRepRange: [8, 12],
        defaultTempo: [3, 0, 1, 1],
      };
  }
}

/**
 * Regra 5.1: DUP deterministicamente alterna vias de estímulo.
 * PPL×2 usa índice de rotação (1–6); ABCDE usa `calendarDayIndex` explícito.
 */
export function getDailyIronFocus(
  dayIndex: number,
  split: DupSplitDay,
  context: DailyIronFocusContext = {},
): DailyIronFocus {
  const preferredSplit = normalizePreferredSplit(context.preferredSplit);
  const calendarDay = context.calendarDayIndex ?? dayIndex;

  if (preferredSplit === 'abcde' || preferredSplit === 'abcdef') {
    return getAbcdeDailyIronFocus(calendarDay, split);
  }

  return getPplDailyIronFocus(dayIndex, split);
}
