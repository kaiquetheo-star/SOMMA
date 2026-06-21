import { describe, it, expect } from 'vitest';
import {
  calculateNaturalTargetTimeline,
  computeFFMI,
} from '@/lib/physics/longevityMath';
import type { BiologicalProfile } from '@/types/biological';

function makeProfile(overrides: Partial<BiologicalProfile> = {}): BiologicalProfile {
  return {
    date_of_birth: '1994-05-14',
    weight_kg: 82,
    height_cm: 178,
    body_fat_percentage: 20,
    current_injuries: null,
    baseline_stress_level: 5,
    goal_iron: 'Hypertrophy',
    nutrition_goal: 'Hypertrophy support',
    training_days_per_week: 5,
    experience_level: 'intermediate',
    available_time_iron: 90,
    iron_mastery: 5,
    frequency_iron: 5,
    cns_fatigue_score: 0,
    clinical_exit_interview: null,
    current_body_fat_estimate: null,
    ...overrides,
  };
}

describe('calculateNaturalTargetTimeline', () => {
  it('returns a timeline for a valid profile', () => {
    const result = calculateNaturalTargetTimeline(makeProfile());
    expect(result).not.toBeNull();
    expect(result!.label).toBe('Functional Sustainable Hypertrophy');
    expect(result!.target_timeline_weeks).toBeGreaterThanOrEqual(8);
    expect(result!.target_timeline_weeks).toBeLessThanOrEqual(104);
    expect(result!.summary).toContain('Week');
  });

  it('returns null when weight_kg is missing or zero', () => {
    expect(calculateNaturalTargetTimeline(makeProfile({ weight_kg: 0 }))).toBeNull();
    expect(calculateNaturalTargetTimeline(makeProfile({ weight_kg: null as unknown as number }))).toBeNull();
  });

  it('returns null when body fat is invalid', () => {
    expect(calculateNaturalTargetTimeline(makeProfile({ body_fat_percentage: 0 }))).toBeNull();
    expect(calculateNaturalTargetTimeline(makeProfile({ body_fat_percentage: 65 }))).toBeNull();
  });

  it('clamps timeline to minimum 8 weeks', () => {
    // Low body fat → minimal fat loss weeks needed
    const result = calculateNaturalTargetTimeline(makeProfile({ body_fat_percentage: 13 }));
    expect(result).not.toBeNull();
    expect(result!.target_timeline_weeks).toBeGreaterThanOrEqual(8);
  });

  it('clamps timeline to maximum 104 weeks', () => {
    // Very high body fat → many fat loss weeks needed but clamped
    const result = calculateNaturalTargetTimeline(makeProfile({ body_fat_percentage: 55, weight_kg: 150 }));
    expect(result).not.toBeNull();
    expect(result!.target_timeline_weeks).toBeLessThanOrEqual(104);
  });

  it('handles younger athlete with lower training experience estimate', () => {
    const youngProfile = makeProfile({ date_of_birth: '2005-01-01', training_days_per_week: 3 });
    const result = calculateNaturalTargetTimeline(youngProfile);
    expect(result).not.toBeNull();
    expect(result!.target_timeline_weeks).toBeGreaterThanOrEqual(8);
  });
});

describe('computeFFMI', () => {
  it('computes FFMI correctly', () => {
    // 80kg, 178cm, 15% BF → lean = 68, heightM = 1.78, FFMI = 68 / (1.78^2) ≈ 21.46
    const ffmi = computeFFMI(80, 178, 15);
    expect(ffmi).toBeCloseTo(21.46, 1);
  });

  it('uses default height of 175cm when height is null', () => {
    const ffmi = computeFFMI(80, null, 15);
    const expected = (80 * 0.85) / (1.75 * 1.75);
    expect(ffmi).toBeCloseTo(expected, 2);
  });

  it('handles zero body fat', () => {
    // All mass is lean
    const ffmi = computeFFMI(80, 180, 0);
    expect(ffmi).toBeCloseTo(80 / (1.8 * 1.8), 2);
  });
});
