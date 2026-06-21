import { describe, it, expect } from 'vitest';
import {
  calculateE1RM,
  resolveIronGoalType,
  intensityPercentForGoal,
  adjustIntensityForRir,
  targetWeightFromPassport,
  targetWeightFromE1RM,
  estimateBestE1RMFromLogs,
  hasIronHistoryForExercise,
  getTargetWeightFromLogs,
  type PerformanceLogSample,
} from '@/lib/physics/rmCalculator';

describe('calculateE1RM', () => {
  it('returns weightKg when reps is 1 (actual 1RM)', () => {
    expect(calculateE1RM(100, 1)).toBe(100);
  });

  it('applies Epley formula for reps > 1', () => {
    // 80kg × (1 + 10/30) = 80 × 1.333… ≈ 106.67
    expect(calculateE1RM(80, 10)).toBeCloseTo(106.67, 1);
  });

  it('returns 0 for non-finite or non-positive inputs', () => {
    expect(calculateE1RM(0, 10)).toBe(0);
    expect(calculateE1RM(100, 0)).toBe(0);
    expect(calculateE1RM(-50, 5)).toBe(0);
    expect(calculateE1RM(NaN, 5)).toBe(0);
    expect(calculateE1RM(100, Infinity)).toBe(0);
  });
});

describe('resolveIronGoalType', () => {
  it('returns strength when input contains "strength"', () => {
    expect(resolveIronGoalType('Strength')).toBe('strength');
    expect(resolveIronGoalType('max strength')).toBe('strength');
  });

  it('returns hypertrophy when input contains "hypertrophy" or "powerbuilding"', () => {
    expect(resolveIronGoalType('Hypertrophy')).toBe('hypertrophy');
    expect(resolveIronGoalType('powerbuilding')).toBe('hypertrophy');
  });

  it('returns default for null/undefined/unknown', () => {
    expect(resolveIronGoalType(null)).toBe('default');
    expect(resolveIronGoalType(undefined)).toBe('default');
    expect(resolveIronGoalType('endurance')).toBe('default');
    expect(resolveIronGoalType('')).toBe('default');
  });
});

describe('intensityPercentForGoal', () => {
  it('returns correct percentage per goal type', () => {
    expect(intensityPercentForGoal('strength')).toBe(0.875);
    expect(intensityPercentForGoal('hypertrophy')).toBe(0.75);
    expect(intensityPercentForGoal('default')).toBe(0.72);
  });
});

describe('adjustIntensityForRir', () => {
  it('increases intensity for low RIR (harder set)', () => {
    const base = 0.75;
    const adjusted = adjustIntensityForRir(base, 0);
    expect(adjusted).toBeGreaterThan(base);
  });

  it('decreases intensity for high RIR (easier set)', () => {
    const base = 0.75;
    const adjusted = adjustIntensityForRir(base, 4);
    expect(adjusted).toBeLessThan(base);
  });

  it('clamps result between 0.5 and 0.95', () => {
    expect(adjustIntensityForRir(0.94, 0)).toBeLessThanOrEqual(0.95);
    expect(adjustIntensityForRir(0.5, 4)).toBeGreaterThanOrEqual(0.5);
  });
});

describe('targetWeightFromPassport', () => {
  it('returns a plate-rounded cold-start weight for a beginner bench', () => {
    const bio = { weight_kg: 80, experience_level: 'beginner' as const };
    const exercise = { name: 'Bench Press', movement_pattern: 'push' as const };
    const result = targetWeightFromPassport(bio, exercise);
    // 80 × 0.4 = 32 → rounded down to plate increment
    expect(result).toBe(30);
  });

  it('returns null when bodyweight is missing or invalid', () => {
    expect(targetWeightFromPassport({ weight_kg: 0, experience_level: 'beginner' }, { name: 'Squat' })).toBeNull();
    expect(targetWeightFromPassport({ weight_kg: null as unknown as number, experience_level: 'beginner' }, { name: 'Squat' })).toBeNull();
  });

  it('returns null for bodyweight-only exercises', () => {
    const bio = { weight_kg: 80, experience_level: 'intermediate' as const };
    const exercise = { name: 'Pull-up', equipment_required: ['bodyweight'] };
    expect(targetWeightFromPassport(bio, exercise)).toBeNull();
  });

  it('identifies squat by movement_pattern', () => {
    const bio = { weight_kg: 80, experience_level: 'intermediate' as const };
    const exercise = { name: 'Front Squat', movement_pattern: 'squat' as const };
    const result = targetWeightFromPassport(bio, exercise);
    // 80 × 0.75 = 60, plate-rounded = 60
    expect(result).toBe(60);
  });

  it('identifies deadlift by hinge pattern', () => {
    const bio = { weight_kg: 80, experience_level: 'advanced' as const };
    const exercise = { name: 'Romanian DL', movement_pattern: 'hinge' as const };
    const result = targetWeightFromPassport(bio, exercise);
    // 80 × 1.1 = 88, floor to 2.5 → 87.5
    expect(result).toBe(87.5);
  });
});

describe('targetWeightFromE1RM', () => {
  it('returns null for invalid E1RM', () => {
    expect(targetWeightFromE1RM(0, 'hypertrophy', 8, 2)).toBeNull();
    expect(targetWeightFromE1RM(-10, 'hypertrophy', 8, 2)).toBeNull();
    expect(targetWeightFromE1RM(NaN, 'hypertrophy', 8, 2)).toBeNull();
  });

  it('calculates goal-aware target weight from E1RM', () => {
    // E1RM = 100, hypertrophy → 75%, RIR 2 → no delta, reps=8 → repFactor=1
    const result = targetWeightFromE1RM(100, 'hypertrophy', 8, 2);
    expect(result).toBe(75);
  });

  it('applies rep-scaling factor for high-rep targets', () => {
    // reps > 8 → repFactor = 0.97
    const highRep = targetWeightFromE1RM(100, 'hypertrophy', 12, 2);
    const normalRep = targetWeightFromE1RM(100, 'hypertrophy', 8, 2);
    expect(highRep!).toBeLessThan(normalRep!);
  });

  it('applies rep-scaling factor for low-rep targets', () => {
    // reps <= 5 → repFactor = 1.02
    const lowRep = targetWeightFromE1RM(100, 'strength', 3, 1);
    expect(lowRep).toBeDefined();
    expect(lowRep!).toBeGreaterThan(0);
  });
});

describe('estimateBestE1RMFromLogs', () => {
  it('returns null when no matching logs exist', () => {
    const logs: PerformanceLogSample[] = [
      { exercise_id: 'other-exercise', weight_used: 100, reps_completed: 5, timestamp: '2024-01-01' },
    ];
    expect(estimateBestE1RMFromLogs(logs, 'bench-press')).toBeNull();
  });

  it('finds best E1RM from exercise_id match', () => {
    const logs: PerformanceLogSample[] = [
      { exercise_id: 'bench-press', weight_used: 80, reps_completed: 10, timestamp: '2024-01-01' },
      { exercise_id: 'bench-press', weight_used: 90, reps_completed: 5, timestamp: '2024-01-02' },
    ];
    const result = estimateBestE1RMFromLogs(logs, 'bench-press');
    expect(result).not.toBeNull();
    // 80×(1+10/30) = 106.67, 90×(1+5/30) = 105 → best is 106.7
    expect(result!).toBeCloseTo(106.7, 0);
  });

  it('uses payload.iron.sets when available', () => {
    const logs: PerformanceLogSample[] = [
      {
        exercise_id: null,
        weight_used: null,
        reps_completed: null,
        timestamp: '2024-01-01',
        payload: {
          iron: {
            exercise_id: 'squat',
            sets: [
              { weight_kg: 100, reps: 5 },
              { weight_kg: 110, reps: 3 },
            ],
          },
        },
      },
    ];
    const result = estimateBestE1RMFromLogs(logs, 'squat');
    // 100×(1+5/30)=116.67, 110×(1+3/30)=121 → best is 121
    expect(result).toBeCloseTo(121, 0);
  });
});

describe('hasIronHistoryForExercise', () => {
  it('returns true when logs contain the exercise', () => {
    const logs: PerformanceLogSample[] = [
      { exercise_id: 'deadlift', weight_used: 120, reps_completed: 5, timestamp: '2024-01-01' },
    ];
    expect(hasIronHistoryForExercise(logs, 'deadlift')).toBe(true);
  });

  it('returns false when no matching exercise found', () => {
    const logs: PerformanceLogSample[] = [
      { exercise_id: 'squat', weight_used: 100, reps_completed: 5, timestamp: '2024-01-01' },
    ];
    expect(hasIronHistoryForExercise(logs, 'deadlift')).toBe(false);
  });
});

describe('getTargetWeightFromLogs', () => {
  it('returns null for empty exercise ID', () => {
    expect(getTargetWeightFromLogs([], '', 8, 2, 'hypertrophy')).toBeNull();
  });

  it('returns null when no iron logs match', () => {
    expect(getTargetWeightFromLogs([], 'bench-press', 8, 2, 'hypertrophy')).toBeNull();
  });
});
