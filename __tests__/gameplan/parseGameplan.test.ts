import { describe, it, expect } from 'vitest';
import {
  parseGameplanBlocks,
  parseDailyGameplanPayload,
} from '@/lib/gameplan/parseGameplan';

describe('parseGameplanBlocks', () => {
  it('returns empty array for non-array input', () => {
    expect(parseGameplanBlocks(null)).toEqual([]);
    expect(parseGameplanBlocks(undefined)).toEqual([]);
    expect(parseGameplanBlocks('string')).toEqual([]);
    expect(parseGameplanBlocks(123)).toEqual([]);
  });

  it('parses a valid iron block', () => {
    const raw = [
      {
        id: 'block-1',
        pillar: 'iron',
        title: 'Push Day',
        subtitle: 'Chest & Shoulders',
        duration_minutes: 60,
        order: 0,
        iron: {
          exercises: [
            {
              exercise_id: 'bench-press',
              target_sets: 4,
              target_reps: 8,
              target_weight_kg: 80,
            },
          ],
        },
      },
    ];

    const result = parseGameplanBlocks(raw);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('block-1');
    expect(result[0].pillar).toBe('iron');
    expect(result[0].title).toBe('Push Day');
    expect(result[0].iron).toBeDefined();
    expect(result[0].iron!.exercises).toHaveLength(1);
    expect(result[0].iron!.exercises[0].exercise_id).toBe('bench-press');
    expect(result[0].status).toBe('pending');
  });

  it('parses a nutrition block', () => {
    const raw = [
      {
        pillar: 'nutrition',
        title: 'Nutrition Plan',
        subtitle: 'High protein day',
        duration_minutes: 0,
        order: 1,
        nutrition_goal: 'Cut',
      },
    ];

    const result = parseGameplanBlocks(raw);
    expect(result).toHaveLength(1);
    expect(result[0].pillar).toBe('nutrition');
    expect(result[0].nutrition).toBeDefined();
    expect(result[0].nutrition!.goal).toBe('Cut');
  });

  it('parses a longevity block', () => {
    const raw = [
      {
        pillar: 'longevity',
        title: 'Recovery',
        subtitle: 'Mobility session',
        duration_minutes: 15,
        order: 2,
        longevity: {
          duration_minutes: 12,
          mobility_focus: 'Hip mobility',
          mobility_cues: ['Open hips', 'Stretch hamstrings'],
          core_exercise: 'Dead Bug',
          cardio_prescription: '10 min walk',
        },
      },
    ];

    const result = parseGameplanBlocks(raw);
    expect(result).toHaveLength(1);
    expect(result[0].longevity).toBeDefined();
    expect(result[0].longevity!.mobility_focus).toBe('Hip mobility');
    expect(result[0].longevity!.mobility_cues).toEqual(['Open hips', 'Stretch hamstrings']);
  });

  it('skips invalid items (null, wrong type, missing pillar)', () => {
    const raw = [null, 'string', { no_pillar: true }, { pillar: 'invalid' }];
    expect(parseGameplanBlocks(raw)).toEqual([]);
  });

  it('auto-generates id when missing', () => {
    const raw = [{ pillar: 'spirit', title: 'Breath', subtitle: '', duration_minutes: 10, order: 0 }];
    const result = parseGameplanBlocks(raw);
    expect(result[0].id).toBe('block-0');
  });

  it('applies defaults for missing fields', () => {
    const raw = [{ pillar: 'iron' }];
    const result = parseGameplanBlocks(raw);
    expect(result[0].title).toBe('Ritual Block');
    expect(result[0].subtitle).toBe('');
    expect(result[0].duration_minutes).toBe(20);
  });

  it('skips iron prescription with empty exercises array', () => {
    const raw = [
      {
        pillar: 'iron',
        title: 'Empty',
        subtitle: '',
        duration_minutes: 60,
        order: 0,
        iron: { exercises: [] },
      },
    ];
    const result = parseGameplanBlocks(raw);
    expect(result[0].iron).toBeUndefined();
  });
});

describe('parseDailyGameplanPayload', () => {
  it('returns null for null/undefined/non-object input', () => {
    expect(parseDailyGameplanPayload(null)).toBeNull();
    expect(parseDailyGameplanPayload(undefined)).toBeNull();
    expect(parseDailyGameplanPayload('string')).toBeNull();
  });

  it('returns null when error field is present', () => {
    expect(parseDailyGameplanPayload({ error: 'Something failed' })).toBeNull();
  });

  it('parses a payload with blocks array (legacy format)', () => {
    const payload = {
      date: '2024-01-10',
      blocks: [
        {
          id: 'block-1',
          pillar: 'iron',
          title: 'Push',
          subtitle: 'Chest',
          duration_minutes: 60,
          order: 0,
          iron: {
            exercises: [{ exercise_id: 'bench-press', target_sets: 4, target_reps: 8 }],
          },
        },
      ],
    };

    const result = parseDailyGameplanPayload(payload);
    expect(result).not.toBeNull();
    expect(result!.date).toBe('2024-01-10');
    expect(result!.blocks).toHaveLength(1);
    expect(result!.microcycle).toHaveLength(7);
  });

  it('parses a payload with microcycle array', () => {
    const payload = {
      date: '2024-01-10',
      week_start_date: '2024-01-08',
      microcycle: [
        {
          day_index: 1,
          is_rest_day: false,
          focus_label: 'Push',
          blocks: [
            {
              id: 'b1',
              pillar: 'iron',
              title: 'Push',
              subtitle: '',
              duration_minutes: 60,
              order: 0,
              iron: { exercises: [{ exercise_id: 'bp', target_sets: 4, target_reps: 8 }] },
            },
          ],
        },
        { day_index: 2, is_rest_day: true, focus_label: 'Rest' },
        { day_index: 3, is_rest_day: false, focus_label: 'Pull', blocks: [
          { id: 'b2', pillar: 'iron', title: 'Pull', subtitle: '', duration_minutes: 60, order: 0,
            iron: { exercises: [{ exercise_id: 'row', target_sets: 4, target_reps: 8 }] } },
        ]},
      ],
    };

    const result = parseDailyGameplanPayload(payload);
    expect(result).not.toBeNull();
    expect(result!.microcycle).toHaveLength(7); // normalized to 7 days
    expect(result!.week_start_date).toBe('2024-01-08');
  });

  it('returns null when blocks array is empty', () => {
    expect(parseDailyGameplanPayload({ date: '2024-01-10', blocks: [] })).toBeNull();
  });

  it('returns null when all blocks fail to parse', () => {
    const payload = {
      date: '2024-01-10',
      blocks: [{ invalid: true }, { also_invalid: true }],
    };
    expect(parseDailyGameplanPayload(payload)).toBeNull();
  });

  it('uses current date when date field is missing', () => {
    const payload = {
      blocks: [
        { id: 'b', pillar: 'iron', title: 'X', subtitle: '', duration_minutes: 30, order: 0,
          iron: { exercises: [{ exercise_id: 'ex', target_sets: 3, target_reps: 10 }] } },
      ],
    };
    const result = parseDailyGameplanPayload(payload);
    expect(result).not.toBeNull();
    expect(result!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rejects degenerate microcycle when training_days_per_week far exceeds actual training days', () => {
    const payload = {
      date: '2024-01-10',
      training_days_per_week: 10,
      microcycle: [
        { day_index: 1, is_rest_day: false, focus_label: 'A', blocks: [
          { id: 'b', pillar: 'iron', title: 'X', subtitle: '', duration_minutes: 30, order: 0,
            iron: { exercises: [{ exercise_id: 'ex', target_sets: 3, target_reps: 10 }] } },
        ]},
        { day_index: 2, is_rest_day: false, focus_label: 'B', blocks: [
          { id: 'b2', pillar: 'iron', title: 'Y', subtitle: '', duration_minutes: 30, order: 0,
            iron: { exercises: [{ exercise_id: 'ex2', target_sets: 3, target_reps: 10 }] } },
        ]},
      ],
    };
    // Degenerate: claims 7 training days but only has 2 actual days with blocks
    const result = parseDailyGameplanPayload(payload);
    expect(result).toBeNull();
  });
});
