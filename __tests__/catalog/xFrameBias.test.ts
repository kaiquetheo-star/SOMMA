import { describe, expect, it } from 'vitest';
import { enrichExerciseWithCues } from '@/lib/catalog/biomechanicalMapper';
import {
  XFRAME_BIAS_CONFIG,
  calculateSelectionScore,
  isXFrameBlacklisted,
} from '@/lib/gameplan/engine/iron/xFrameBias';
import type { LibraryExercise } from '@/types/catalog';

function mockSeedExercise(partial: Partial<LibraryExercise> & Pick<LibraryExercise, 'slug' | 'name'>): LibraryExercise {
  return {
    id: partial.id ?? `ex-${partial.slug}`,
    slug: partial.slug,
    name: partial.name,
    biomechanical_instructions: partial.biomechanical_instructions ?? {},
    equipment_required: partial.equipment_required ?? ['full_gym'],
    default_sets: partial.default_sets ?? 3,
    default_reps: partial.default_reps ?? 10,
    movement_pattern: partial.movement_pattern ?? 'isolation',
    primary_muscle: partial.primary_muscle ?? 'chest',
    synergist_muscles: partial.synergist_muscles ?? [],
    cns_fatigue_cost: partial.cns_fatigue_cost ?? 2,
    joint_stress_profile: partial.joint_stress_profile ?? 'low_impact',
    stretch_mediated_hypertrophy: partial.stretch_mediated_hypertrophy ?? false,
  };
}

const CABLE_LATERAL_RAISE = mockSeedExercise({
  slug: 'cable_lateral_raise',
  name: 'Cable Lateral Raise',
  biomechanical_instructions: {
    setup: 'Cable crosses behind body, soft elbows, lead with elbows.',
    eccentric: '3s lower without trap takeover.',
    concentric: 'Raise to shoulder height; constant tension.',
    safety: 'No swinging.',
  },
  equipment_required: ['full_gym'],
  default_sets: 3,
  default_reps: 15,
  movement_pattern: 'isolation',
  primary_muscle: 'side_delts',
  synergist_muscles: ['traps'],
  cns_fatigue_cost: 1,
  joint_stress_profile: 'low_impact',
});

const BARBELL_BACK_SQUAT = mockSeedExercise({
  slug: 'barbell_back_squat',
  name: 'Barbell Back Squat',
  biomechanical_instructions: {
    setup: 'High-bar or low-bar, brace 360°, heels hip-width.',
    eccentric: 'Sit between hips; knees track toes; neutral spine.',
    concentric: 'Drive floor; hips and chest rise together.',
    safety: 'Safety bars set; avoid valgus collapse.',
  },
  equipment_required: ['barbell', 'full_gym'],
  default_sets: 4,
  default_reps: 6,
  movement_pattern: 'squat',
  primary_muscle: 'quadriceps',
  synergist_muscles: ['glutes', 'erectors', 'core'],
  cns_fatigue_cost: 5,
  joint_stress_profile: 'spinal_axial_load',
});

const DUMBBELL_LATERAL_FLEXION = mockSeedExercise({
  slug: 'dumbbell_lateral_flexion',
  name: 'Flexao Lateral com Halter',
  biomechanical_instructions: {
    setup: 'Hold one dumbbell beside the hip.',
  },
  equipment_required: ['dumbbells'],
  movement_pattern: 'lateral_flexion',
  primary_muscle: 'obliques',
  synergist_muscles: ['quadratus_lumborum'],
  cns_fatigue_cost: 2,
});

describe('X-Frame catalog enrichment', () => {
  it('scores cable lateral raise as the highest deltoid-lateral priority', () => {
    const enriched = enrichExerciseWithCues(CABLE_LATERAL_RAISE);

    expect(enriched.selection_score).toBe(XFRAME_BIAS_CONFIG.priorityWeights.deltoid_lateral);
    expect(enriched.selection_score).toBe(3.0);
    expect(enriched.tempo).toEqual([2, 0, 1, 0]);
    expect(enriched.cue_card).toEqual({
      setup: 'Cable crosses behind body, soft elbows, lead with elbows.',
      vector: 'Raise to shoulder height; constant tension.',
      catch: '3s lower without trap takeover.',
      anti_pattern: 'No swinging.',
      failure_type: 'concentric',
    });
  });

  it('enriches barbell back squat with quad bias defaults and technical failure', () => {
    const enriched = enrichExerciseWithCues(BARBELL_BACK_SQUAT);

    expect(enriched.selection_score).toBeGreaterThanOrEqual(2.0);
    expect(enriched.tempo).toEqual([3, 1, 'X', 0]);
    expect(enriched.cue_card.failure_type).toBe('technical');
    expect(enriched.cue_card.setup).toBe('High-bar or low-bar, brace 360°, heels hip-width.');
    expect(enriched.cue_card.vector).toBe('Drive floor; hips and chest rise together.');
    expect(enriched.cue_card.catch).toBe('Sit between hips; knees track toes; neutral spine.');
    expect(enriched.cue_card.anti_pattern).toBe('Safety bars set; avoid valgus collapse.');
  });

  it('blocks weighted lateral-flexion waist-thickening patterns', () => {
    const enriched = enrichExerciseWithCues(DUMBBELL_LATERAL_FLEXION);

    expect(XFRAME_BIAS_CONFIG.blacklistPatterns).toContain('lateral_flexion');
    expect(isXFrameBlacklisted(DUMBBELL_LATERAL_FLEXION)).toBe(true);
    expect(calculateSelectionScore(enriched)).toBe(0);
    expect(enriched.selection_score).toBe(0);
  });
});
