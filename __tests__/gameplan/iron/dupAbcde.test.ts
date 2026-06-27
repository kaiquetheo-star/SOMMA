import { describe, expect, it } from 'vitest';
import { ABCDE_ARMS_CALENDAR_DAY, getDailyIronFocus } from '@/lib/gameplan/engine/iron/dupLogic';

describe('ABCDE DUP — calendar day_index 4–6', () => {
  it('day 4 (Upper Pull) usa stretch_mediated', () => {
    const focus = getDailyIronFocus(3, 'pull', {
      preferredSplit: 'abcde',
      calendarDayIndex: 4,
    });
    expect(focus.focus).toBe('stretch_mediated');
    expect(focus.targetRepRange).toEqual([10, 15]);
  });

  it('day 5 (Lower Posterior) usa unilateral_stability em legs', () => {
    const focus = getDailyIronFocus(4, 'legs', {
      preferredSplit: 'abcde',
      calendarDayIndex: 5,
    });
    expect(focus.focus).toBe('unilateral_stability');
    expect(focus.targetRepRange).toEqual([10, 12]);
  });

  it('day 6 (Arms) usa metabolic_hypertrophy com reps 10–15', () => {
    const focus = getDailyIronFocus(5, 'push', {
      preferredSplit: 'abcde',
      calendarDayIndex: ABCDE_ARMS_CALENDAR_DAY,
    });
    expect(focus.focus).toBe('metabolic_hypertrophy');
    expect(focus.targetRepRange).toEqual([10, 15]);
  });

  it('não aplica fallback PPL quando iron slot index difere do calendar day', () => {
    const wrongPplStyle = getDailyIronFocus(3, 'pull', {
      preferredSplit: 'ppl_x2',
      calendarDayIndex: 4,
    });
    const abcdePull = getDailyIronFocus(3, 'pull', {
      preferredSplit: 'abcde',
      calendarDayIndex: 4,
    });

    expect(wrongPplStyle.focus).toBe('metabolic_hypertrophy');
    expect(abcdePull.focus).toBe('stretch_mediated');
  });
});
