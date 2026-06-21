import { describe, it, expect } from 'vitest';
import {
  getWeekStartMonday,
  getDayIndexForDate,
  dateForDayIndex,
  getMicrocycleDay,
  spreadTrainingDayIndices,
  MICROCYCLE_DAY_LABELS,
} from '@/lib/gameplan/microcycleWeek';
import type { MicrocycleDay } from '@/types/gameplan';

describe('MICROCYCLE_DAY_LABELS', () => {
  it('has 7 labels from Mon to Sun', () => {
    expect(MICROCYCLE_DAY_LABELS).toHaveLength(7);
    expect(MICROCYCLE_DAY_LABELS[0]).toBe('Mon');
    expect(MICROCYCLE_DAY_LABELS[6]).toBe('Sun');
  });
});

describe('getWeekStartMonday', () => {
  it('returns the Monday of the given date week', () => {
    // 2024-01-10 is a Wednesday → Monday = 2024-01-08
    expect(getWeekStartMonday('2024-01-10')).toBe('2024-01-08');
  });

  it('returns the same date when date is already Monday', () => {
    // 2024-01-08 is a Monday
    expect(getWeekStartMonday('2024-01-08')).toBe('2024-01-08');
  });

  it('handles Sunday correctly (goes back 6 days)', () => {
    // 2024-01-14 is a Sunday → Monday = 2024-01-08
    expect(getWeekStartMonday('2024-01-14')).toBe('2024-01-08');
  });

  it('returns input for invalid dates', () => {
    expect(getWeekStartMonday('invalid-date')).toBe('invalid-date');
  });
});

describe('getDayIndexForDate', () => {
  it('returns 1 for the week start date itself (Monday)', () => {
    expect(getDayIndexForDate('2024-01-08', '2024-01-08')).toBe(1);
  });

  it('returns 3 for Wednesday within the week', () => {
    expect(getDayIndexForDate('2024-01-10', '2024-01-08')).toBe(3);
  });

  it('returns 7 for Sunday', () => {
    expect(getDayIndexForDate('2024-01-14', '2024-01-08')).toBe(7);
  });

  it('clamps values to 1-7 range', () => {
    // Date before the week start
    expect(getDayIndexForDate('2024-01-07', '2024-01-08')).toBe(1);
    // Date far after the week
    expect(getDayIndexForDate('2024-01-20', '2024-01-08')).toBe(7);
  });

  it('returns 1 for invalid date input', () => {
    expect(getDayIndexForDate('bad-date', '2024-01-08')).toBe(1);
  });
});

describe('dateForDayIndex', () => {
  it('returns the correct date for day_index 1 (Monday)', () => {
    expect(dateForDayIndex('2024-01-08', 1)).toBe('2024-01-08');
  });

  it('returns Wednesday for day_index 3', () => {
    expect(dateForDayIndex('2024-01-08', 3)).toBe('2024-01-10');
  });

  it('returns Sunday for day_index 7', () => {
    expect(dateForDayIndex('2024-01-08', 7)).toBe('2024-01-14');
  });

  it('returns weekStartDate for invalid start date', () => {
    expect(dateForDayIndex('invalid', 3)).toBe('invalid');
  });
});

describe('getMicrocycleDay', () => {
  const mockMicrocycle: MicrocycleDay[] = [
    { day_index: 1, is_rest_day: false, focus_label: 'Push', date: '2024-01-08', blocks: [] },
    { day_index: 2, is_rest_day: false, focus_label: 'Pull', date: '2024-01-09', blocks: [] },
    { day_index: 3, is_rest_day: true, focus_label: 'Rest', date: '2024-01-10', blocks: [] },
  ];

  it('finds day by day_index', () => {
    expect(getMicrocycleDay(mockMicrocycle, 1)?.focus_label).toBe('Push');
    expect(getMicrocycleDay(mockMicrocycle, 2)?.focus_label).toBe('Pull');
  });

  it('returns null for non-existent day_index', () => {
    expect(getMicrocycleDay(mockMicrocycle, 5)).toBeNull();
  });

  it('returns null for null microcycle', () => {
    expect(getMicrocycleDay(null, 1)).toBeNull();
  });
});

describe('spreadTrainingDayIndices', () => {
  it('returns empty array for 0 days', () => {
    expect(spreadTrainingDayIndices(0)).toEqual([]);
  });

  it('returns day 4 (Thursday) for 1 training day', () => {
    expect(spreadTrainingDayIndices(1)).toEqual([4]);
  });

  it('returns [1, 7] for 2 training days (spread across week)', () => {
    const result = spreadTrainingDayIndices(2);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(7);
  });

  it('returns all 7 days for 7 training days', () => {
    expect(spreadTrainingDayIndices(7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('returns correct count for 5 training days', () => {
    const result = spreadTrainingDayIndices(5);
    expect(result).toHaveLength(5);
    expect(result.every((d) => d >= 1 && d <= 7)).toBe(true);
    // Should be sorted
    for (let i = 1; i < result.length; i++) {
      expect(result[i]).toBeGreaterThan(result[i - 1]);
    }
  });

  it('clamps to range [0, 7]', () => {
    expect(spreadTrainingDayIndices(10)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(spreadTrainingDayIndices(-1)).toEqual([]);
  });
});
