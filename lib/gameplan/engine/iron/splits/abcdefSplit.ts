import type { SolverSlot, SplitDayKey } from '@/lib/gameplan/engine/iron/types';

export type AbcdefCategory =
  | 'chest_horizontal_press'
  | 'chest_incline_press'
  | 'chest_decline_press'
  | 'chest_fly'
  | 'triceps_overhead'
  | 'triceps_pushdown'
  | 'triceps_compound'
  | 'back_vertical_pull'
  | 'back_horizontal_row'
  | 'biceps_curl_long_head'
  | 'biceps_curl_short_head'
  | 'biceps_hammer'
  | 'quad_compound'
  | 'quad_isolation'
  | 'adductor'
  | 'calf_raise'
  | 'shoulder_overhead_press'
  | 'shoulder_lateral_raise'
  | 'shoulder_posterior_fly'
  | 'shoulder_anterior_raise'
  | 'trap_shrug'
  | 'biceps_curl'
  | 'triceps_extension'
  | 'forearm_isolation'
  | 'core_anti_extension'
  | 'core_rotation'
  | 'hinge_compound'
  | 'hamstring_curl'
  | 'glute_isolation'
  | 'calf_raise_seated';

export interface AbcdefSlotSpec {
  category: AbcdefCategory;
  count: number;
  priority: 1 | 2 | 3;
}

export interface AbcdefTrainingDay {
  day_index: 1 | 2 | 3 | 4 | 5 | 6;
  splitDay: SplitDayKey;
  focus_label: string;
  primary_muscles: readonly string[];
  secondary_muscles: readonly string[];
  min_exercises: number;
  max_exercises: number;
  slots: readonly AbcdefSlotSpec[];
}

export interface AbcdefRestDay {
  day_index: 7;
  focus_label: 'Rest & Recovery';
  is_rest_day: true;
}

const ABCDEF_TRAINING_DAYS: readonly AbcdefTrainingDay[] = [
  {
    day_index: 1,
    splitDay: 'push',
    focus_label: 'Iron: Chest & Triceps',
    primary_muscles: ['pectoralis_major', 'triceps_brachii'],
    secondary_muscles: ['deltoid_anterior'],
    min_exercises: 6,
    max_exercises: 8,
    slots: [
      { category: 'chest_horizontal_press', count: 1, priority: 1 },
      { category: 'chest_incline_press', count: 1, priority: 1 },
      { category: 'chest_decline_press', count: 1, priority: 2 },
      { category: 'chest_fly', count: 2, priority: 2 },
      { category: 'triceps_overhead', count: 1, priority: 2 },
      { category: 'triceps_pushdown', count: 1, priority: 2 },
      { category: 'triceps_compound', count: 1, priority: 3 },
    ],
  },
  {
    day_index: 2,
    splitDay: 'pull',
    focus_label: 'Iron: Back (Width) & Biceps',
    primary_muscles: ['latissimus_dorsi', 'biceps_brachii'],
    secondary_muscles: ['posterior_deltoid', 'brachialis'],
    min_exercises: 6,
    max_exercises: 8,
    slots: [
      { category: 'back_vertical_pull', count: 2, priority: 1 },
      { category: 'back_horizontal_row', count: 2, priority: 1 },
      { category: 'biceps_curl_long_head', count: 1, priority: 2 },
      { category: 'biceps_curl_short_head', count: 1, priority: 2 },
      { category: 'biceps_hammer', count: 1, priority: 3 },
      { category: 'forearm_isolation', count: 1, priority: 3 },
    ],
  },
  {
    day_index: 3,
    splitDay: 'legs',
    focus_label: 'Iron: Legs (Quad Focus)',
    primary_muscles: ['quadriceps', 'gluteus_maximus'],
    secondary_muscles: ['calves'],
    min_exercises: 6,
    max_exercises: 8,
    slots: [
      { category: 'quad_compound', count: 2, priority: 1 },
      { category: 'quad_isolation', count: 2, priority: 1 },
      { category: 'adductor', count: 1, priority: 2 },
      { category: 'calf_raise', count: 2, priority: 2 },
    ],
  },
  {
    day_index: 4,
    splitDay: 'push',
    focus_label: 'Iron: Shoulders & Traps',
    primary_muscles: ['deltoid_lateral', 'deltoid_posterior', 'trapezius'],
    secondary_muscles: ['deltoid_anterior'],
    min_exercises: 7,
    max_exercises: 9,
    slots: [
      { category: 'shoulder_overhead_press', count: 1, priority: 1 },
      { category: 'shoulder_lateral_raise', count: 3, priority: 1 },
      { category: 'shoulder_posterior_fly', count: 2, priority: 1 },
      { category: 'shoulder_anterior_raise', count: 1, priority: 2 },
      { category: 'trap_shrug', count: 1, priority: 2 },
    ],
  },
  {
    day_index: 5,
    splitDay: 'pull',
    focus_label: 'Iron: Arms & Core',
    primary_muscles: ['biceps_brachii', 'triceps_brachii', 'rectus_abdominis'],
    secondary_muscles: ['forearms', 'obliques'],
    min_exercises: 7,
    max_exercises: 9,
    slots: [
      { category: 'biceps_curl', count: 2, priority: 1 },
      { category: 'triceps_extension', count: 2, priority: 1 },
      { category: 'forearm_isolation', count: 1, priority: 2 },
      { category: 'core_anti_extension', count: 1, priority: 2 },
      { category: 'core_rotation', count: 1, priority: 3 },
    ],
  },
  {
    day_index: 6,
    splitDay: 'legs',
    focus_label: 'Iron: Legs (Posterior Focus)',
    primary_muscles: ['hamstrings', 'gluteus_maximus'],
    secondary_muscles: ['calves', 'erector_spinae'],
    min_exercises: 6,
    max_exercises: 8,
    slots: [
      { category: 'hinge_compound', count: 2, priority: 1 },
      { category: 'hamstring_curl', count: 2, priority: 1 },
      { category: 'glute_isolation', count: 1, priority: 2 },
      { category: 'calf_raise_seated', count: 2, priority: 2 },
    ],
  },
];

export const ABCDEF_SPLIT: {
  name: 'ABCDEF Specialization (Enhanced)';
  days: 7;
  structure: readonly [...typeof ABCDEF_TRAINING_DAYS, AbcdefRestDay];
} = {
  name: 'ABCDEF Specialization (Enhanced)',
  days: 7,
  structure: [
    ...ABCDEF_TRAINING_DAYS,
    {
      day_index: 7,
      focus_label: 'Rest & Recovery',
      is_rest_day: true,
    },
  ],
};

export type AbcdefDayTemplate = {
  splitDay: SplitDayKey;
  focusLabel: string;
  minExercises: number;
  maxExercises: number;
  slots: readonly SolverSlot[];
};

function slotDefaultsForCategory(category: AbcdefCategory): Pick<
  SolverSlot,
  'requiredPatterns' | 'primaryMuscleHint' | 'isolationOnly' | 'defaultSets'
> {
  switch (category) {
    case 'chest_horizontal_press':
      return { requiredPatterns: ['push'], primaryMuscleHint: 'chest', defaultSets: 4 };
    case 'chest_incline_press':
      return { requiredPatterns: ['push'], primaryMuscleHint: 'upper_chest', defaultSets: 4 };
    case 'chest_decline_press':
      return { requiredPatterns: ['push'], primaryMuscleHint: 'chest', defaultSets: 4 };
    case 'chest_fly':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'chest', isolationOnly: true, defaultSets: 3 };
    case 'triceps_compound':
      return { requiredPatterns: ['push', 'isolation'], primaryMuscleHint: 'triceps', defaultSets: 3 };
    case 'triceps_overhead':
    case 'triceps_pushdown':
    case 'triceps_extension':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'triceps', isolationOnly: true, defaultSets: 3 };
    case 'back_vertical_pull':
    case 'back_horizontal_row':
      return { requiredPatterns: ['pull'], primaryMuscleHint: 'back', defaultSets: 4 };
    case 'biceps_curl_long_head':
    case 'biceps_curl_short_head':
    case 'biceps_hammer':
    case 'biceps_curl':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'biceps', isolationOnly: true, defaultSets: 3 };
    case 'quad_compound':
      return { requiredPatterns: ['squat', 'lunge'], primaryMuscleHint: 'quads', defaultSets: 4 };
    case 'quad_isolation':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'quads', isolationOnly: true, defaultSets: 4 };
    case 'adductor':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'adductors', isolationOnly: true, defaultSets: 3 };
    case 'calf_raise':
    case 'calf_raise_seated':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'calves', isolationOnly: true, defaultSets: 4 };
    case 'shoulder_overhead_press':
      return { requiredPatterns: ['push'], primaryMuscleHint: 'front_delts', defaultSets: 4 };
    case 'shoulder_lateral_raise':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'side_delts', isolationOnly: true, defaultSets: 4 };
    case 'shoulder_posterior_fly':
      return { requiredPatterns: ['isolation', 'pull'], primaryMuscleHint: 'rear_delts', isolationOnly: true, defaultSets: 4 };
    case 'shoulder_anterior_raise':
      return { requiredPatterns: ['isolation', 'push'], primaryMuscleHint: 'front_delts', defaultSets: 3 };
    case 'trap_shrug':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'traps', isolationOnly: true, defaultSets: 3 };
    case 'forearm_isolation':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'forearms', isolationOnly: true, defaultSets: 3 };
    case 'core_anti_extension':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'core', isolationOnly: true, defaultSets: 3 };
    case 'core_rotation':
      return { requiredPatterns: ['isolation'], isolationOnly: true, defaultSets: 3 };
    case 'hinge_compound':
      return { requiredPatterns: ['hinge'], primaryMuscleHint: 'hamstrings', defaultSets: 4 };
    case 'hamstring_curl':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'hamstrings', isolationOnly: true, defaultSets: 4 };
    case 'glute_isolation':
      return { requiredPatterns: ['isolation', 'hinge'], primaryMuscleHint: 'glutes', defaultSets: 3 };
  }
}

function expandSlots(day: AbcdefTrainingDay): SolverSlot[] {
  return day.slots.flatMap((slotSpec) =>
    Array.from({ length: slotSpec.count }, (_, index) => ({
      slotId: `${slotSpec.category}_${index + 1}`,
      day: day.splitDay,
      category: slotSpec.category,
      ...slotDefaultsForCategory(slotSpec.category),
    })),
  );
}

export function resolveAbcdefDayTemplate(ironSlotIndex: number): AbcdefDayTemplate {
  const day = ABCDEF_TRAINING_DAYS[ironSlotIndex % ABCDEF_TRAINING_DAYS.length]!;
  return {
    splitDay: day.splitDay,
    focusLabel: day.focus_label,
    minExercises: day.min_exercises,
    maxExercises: day.max_exercises,
    slots: expandSlots(day),
  };
}
