import type { SolverSlot, SplitDayKey } from '@/lib/gameplan/engine/iron/types';

/** Canonical 6-day Push / Pull / Legs rotation (Mon–Sat). */
export const PPL_ROTATION: readonly SplitDayKey[] = [
  'push',
  'pull',
  'legs',
  'push',
  'pull',
  'legs',
];

/**
 * Base slot templates (kept for non-6-day rotations).
 * For PPL×2 elite rotation, use `resolvePplDayTemplate()` below.
 */
export const PPL_DAY_SLOTS: Record<SplitDayKey, readonly SolverSlot[]> = {
  push: [
    { slotId: 'chest_compound_a', day: 'push', requiredPatterns: ['push'], primaryMuscleHint: 'chest', defaultSets: 4 },
    { slotId: 'chest_compound_b', day: 'push', requiredPatterns: ['push'], primaryMuscleHint: 'upper_chest', defaultSets: 3 },
    { slotId: 'overhead_press', day: 'push', requiredPatterns: ['push'], primaryMuscleHint: 'front_delts', defaultSets: 3 },
    { slotId: 'shoulder_lateral', day: 'push', requiredPatterns: ['isolation'], primaryMuscleHint: 'side_delts', isolationOnly: true, defaultSets: 3 },
    { slotId: 'triceps_a', day: 'push', requiredPatterns: ['isolation'], primaryMuscleHint: 'triceps', isolationOnly: true, defaultSets: 3 },
    { slotId: 'triceps_b', day: 'push', requiredPatterns: ['isolation'], primaryMuscleHint: 'triceps', isolationOnly: true, defaultSets: 3 },
  ],
  pull: [
    { slotId: 'back_vertical', day: 'pull', requiredPatterns: ['pull'], primaryMuscleHint: 'back', defaultSets: 4 },
    { slotId: 'back_horizontal', day: 'pull', requiredPatterns: ['pull'], primaryMuscleHint: 'back', defaultSets: 4 },
    { slotId: 'rear_delt', day: 'pull', requiredPatterns: ['isolation', 'pull'], primaryMuscleHint: 'rear_delts', isolationOnly: true, defaultSets: 3 },
    { slotId: 'biceps_a', day: 'pull', requiredPatterns: ['isolation'], primaryMuscleHint: 'biceps', isolationOnly: true, defaultSets: 3 },
    { slotId: 'biceps_b', day: 'pull', requiredPatterns: ['isolation'], primaryMuscleHint: 'biceps', isolationOnly: true, defaultSets: 3 },
  ],
  legs: [
    { slotId: 'quad_a', day: 'legs', requiredPatterns: ['squat', 'lunge'], primaryMuscleHint: 'quads', defaultSets: 4 },
    { slotId: 'quad_b', day: 'legs', requiredPatterns: ['squat', 'lunge'], primaryMuscleHint: 'quads', defaultSets: 3 },
    { slotId: 'hinge_a', day: 'legs', requiredPatterns: ['hinge'], primaryMuscleHint: 'hamstrings', defaultSets: 4 },
    { slotId: 'hinge_b', day: 'legs', requiredPatterns: ['hinge', 'isolation'], primaryMuscleHint: 'hamstrings', defaultSets: 3 },
    { slotId: 'calves', day: 'legs', requiredPatterns: ['isolation'], primaryMuscleHint: 'calves', isolationOnly: true, defaultSets: 4 },
  ],
};

export type Ppl6DayVariant =
  | 'push_chest_focus'
  | 'pull_lat_width'
  | 'legs_quad_focus'
  | 'push_shoulder_focus'
  | 'pull_thickness_traps'
  | 'legs_posterior_focus';

export interface PplDayTemplate {
  splitDay: SplitDayKey;
  variant: Ppl6DayVariant;
  focusLabel: string;
  slots: readonly SolverSlot[];
}

const PUSH_CHEST_FOCUS: readonly SolverSlot[] = [
  { slotId: 'chest_compound_a', day: 'push', requiredPatterns: ['push'], primaryMuscleHint: 'chest', defaultSets: 4 },
  { slotId: 'chest_compound_b', day: 'push', requiredPatterns: ['push'], primaryMuscleHint: 'upper_chest', defaultSets: 4 },
  { slotId: 'chest_iso', day: 'push', requiredPatterns: ['isolation'], primaryMuscleHint: 'chest', isolationOnly: true, defaultSets: 3 },
  { slotId: 'overhead_press', day: 'push', requiredPatterns: ['push'], primaryMuscleHint: 'front_delts', defaultSets: 3 },
  { slotId: 'shoulder_lateral', day: 'push', requiredPatterns: ['isolation'], primaryMuscleHint: 'side_delts', isolationOnly: true, defaultSets: 3 },
  { slotId: 'triceps_a', day: 'push', requiredPatterns: ['isolation'], primaryMuscleHint: 'triceps', isolationOnly: true, defaultSets: 3 },
];

const PUSH_SHOULDER_FOCUS: readonly SolverSlot[] = [
  { slotId: 'overhead_press', day: 'push', requiredPatterns: ['push'], primaryMuscleHint: 'front_delts', defaultSets: 4 },
  { slotId: 'chest_compound_a', day: 'push', requiredPatterns: ['push'], primaryMuscleHint: 'upper_chest', defaultSets: 3 },
  { slotId: 'chest_iso', day: 'push', requiredPatterns: ['isolation'], primaryMuscleHint: 'upper_chest', isolationOnly: true, defaultSets: 3 },
  { slotId: 'shoulder_lateral', day: 'push', requiredPatterns: ['isolation'], primaryMuscleHint: 'side_delts', isolationOnly: true, defaultSets: 4 },
  { slotId: 'triceps_a', day: 'push', requiredPatterns: ['isolation'], primaryMuscleHint: 'triceps', isolationOnly: true, defaultSets: 3 },
  { slotId: 'triceps_b', day: 'push', requiredPatterns: ['isolation'], primaryMuscleHint: 'triceps', isolationOnly: true, defaultSets: 3 },
];

const PULL_LAT_WIDTH: readonly SolverSlot[] = [
  { slotId: 'back_vertical', day: 'pull', requiredPatterns: ['pull'], primaryMuscleHint: 'back', defaultSets: 4 },
  { slotId: 'back_horizontal', day: 'pull', requiredPatterns: ['pull'], primaryMuscleHint: 'back', defaultSets: 4 },
  { slotId: 'lat_iso', day: 'pull', requiredPatterns: ['isolation'], primaryMuscleHint: 'back', isolationOnly: true, defaultSets: 3 },
  { slotId: 'rear_delt', day: 'pull', requiredPatterns: ['isolation', 'pull'], primaryMuscleHint: 'rear_delts', isolationOnly: true, defaultSets: 3 },
  { slotId: 'biceps_a', day: 'pull', requiredPatterns: ['isolation'], primaryMuscleHint: 'biceps', isolationOnly: true, defaultSets: 3 },
];

const PULL_THICKNESS_TRAPS: readonly SolverSlot[] = [
  { slotId: 'back_horizontal', day: 'pull', requiredPatterns: ['pull'], primaryMuscleHint: 'back', defaultSets: 4 },
  { slotId: 'back_vertical', day: 'pull', requiredPatterns: ['pull'], primaryMuscleHint: 'back', defaultSets: 3 },
  { slotId: 'traps', day: 'pull', requiredPatterns: ['isolation'], primaryMuscleHint: 'traps', isolationOnly: true, defaultSets: 3 },
  { slotId: 'rear_delt', day: 'pull', requiredPatterns: ['isolation', 'pull'], primaryMuscleHint: 'rear_delts', isolationOnly: true, defaultSets: 3 },
  { slotId: 'biceps_a', day: 'pull', requiredPatterns: ['isolation'], primaryMuscleHint: 'biceps', isolationOnly: true, defaultSets: 3 },
  { slotId: 'biceps_b', day: 'pull', requiredPatterns: ['isolation'], primaryMuscleHint: 'biceps', isolationOnly: true, defaultSets: 3 },
];

const LEGS_QUAD_FOCUS: readonly SolverSlot[] = [
  { slotId: 'quad_primary', day: 'legs', requiredPatterns: ['squat'], primaryMuscleHint: 'quads', defaultSets: 4 },
  { slotId: 'quad_lunge', day: 'legs', requiredPatterns: ['lunge'], primaryMuscleHint: 'quads', defaultSets: 3 },
  { slotId: 'quad_iso', day: 'legs', requiredPatterns: ['isolation'], primaryMuscleHint: 'quads', isolationOnly: true, defaultSets: 4 },
  { slotId: 'calves', day: 'legs', requiredPatterns: ['isolation'], primaryMuscleHint: 'calves', isolationOnly: true, defaultSets: 4 },
];

const LEGS_POSTERIOR_FOCUS: readonly SolverSlot[] = [
  { slotId: 'hinge_primary', day: 'legs', requiredPatterns: ['hinge'], primaryMuscleHint: 'hamstrings', defaultSets: 4 },
  { slotId: 'glute_hinge', day: 'legs', requiredPatterns: ['hinge'], primaryMuscleHint: 'glutes', defaultSets: 3 },
  { slotId: 'hamstring_curl', day: 'legs', requiredPatterns: ['isolation'], primaryMuscleHint: 'hamstrings', isolationOnly: true, defaultSets: 4 },
  { slotId: 'calves', day: 'legs', requiredPatterns: ['isolation'], primaryMuscleHint: 'calves', isolationOnly: true, defaultSets: 4 },
];

/**
 * 6-day PPL×2 rotation with intra-week emphasis:
 * Push A (Chest) → Pull A (Lat width) → Legs A (Quad)
 * Push B (Shoulders) → Pull B (Thickness/Traps) → Legs B (Posterior)
 */
export function resolvePplDayTemplate(ironSlotIndex: number): PplDayTemplate {
  const slot = ironSlotIndex % 6;
  if (slot === 0) return { splitDay: 'push', variant: 'push_chest_focus', focusLabel: 'Iron: Push A (Chest Focus)', slots: PUSH_CHEST_FOCUS };
  if (slot === 1) return { splitDay: 'pull', variant: 'pull_lat_width', focusLabel: 'Iron: Pull A (Lat Width)', slots: PULL_LAT_WIDTH };
  if (slot === 2) return { splitDay: 'legs', variant: 'legs_quad_focus', focusLabel: 'Iron: Legs A (Quad Focus)', slots: LEGS_QUAD_FOCUS };
  if (slot === 3) return { splitDay: 'push', variant: 'push_shoulder_focus', focusLabel: 'Iron: Push B (Shoulder Focus)', slots: PUSH_SHOULDER_FOCUS };
  if (slot === 4) return { splitDay: 'pull', variant: 'pull_thickness_traps', focusLabel: 'Iron: Pull B (Thickness/Traps)', slots: PULL_THICKNESS_TRAPS };
  return { splitDay: 'legs', variant: 'legs_posterior_focus', focusLabel: 'Iron: Legs B (Posterior Focus)', slots: LEGS_POSTERIOR_FOCUS };
}
