import type { SolverSlot, SplitDayKey } from '@/lib/gameplan/engine/iron/types';

export type AbcdeCategory =
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

export interface AbcdeSlotSpec {
  category: AbcdeCategory;
  count: number;
  priority: 1 | 2 | 3;
}

export interface AbcdeTrainingDay {
  day_index: 1 | 2 | 4 | 5 | 6;
  splitDay: SplitDayKey;
  focus_label: string;
  primary_muscles: readonly string[];
  secondary_muscles: readonly string[];
  min_exercises: number;
  max_exercises: number;
  slots: readonly AbcdeSlotSpec[];
}

export interface AbcdeRestDay {
  day_index: 3 | 7;
  focus_label: string;
  is_rest_day: true;
}

/** Iron sessions Mon, Tue, Thu, Fri, Sat — mid-week (Wed) and Sunday rest. */
export const ABCDE_IRON_DAY_INDICES = [1, 2, 4, 5, 6] as const;

export const ABCDE_REST_DAY_INDICES = [3, 7] as const;

const ABCDE_TRAINING_DAYS: readonly AbcdeTrainingDay[] = [
  {
    day_index: 1,
    splitDay: 'push',
    focus_label: 'Iron: Upper Push (Chest · Shoulders · Triceps)',
    primary_muscles: ['pectoralis_major', 'deltoid_anterior', 'triceps_brachii'],
    secondary_muscles: ['deltoid_lateral'],
    min_exercises: 7,
    max_exercises: 9,
    slots: [
      { category: 'chest_horizontal_press', count: 1, priority: 1 },
      { category: 'chest_incline_press', count: 1, priority: 1 },
      { category: 'chest_decline_press', count: 1, priority: 1 },
      { category: 'chest_fly', count: 2, priority: 1 },
      { category: 'shoulder_overhead_press', count: 1, priority: 2 },
      { category: 'shoulder_lateral_raise', count: 1, priority: 2 },
      { category: 'triceps_overhead', count: 1, priority: 2 },
      { category: 'triceps_pushdown', count: 1, priority: 3 },
    ],
  },
  {
    day_index: 2,
    splitDay: 'legs',
    focus_label: 'Iron: Lower Anterior (Quads · Calves)',
    primary_muscles: ['quadriceps', 'calves'],
    secondary_muscles: ['gluteus_maximus'],
    min_exercises: 6,
    max_exercises: 8,
    slots: [
      { category: 'quad_compound', count: 2, priority: 1 },
      { category: 'quad_isolation', count: 2, priority: 1 },
      { category: 'calf_raise', count: 2, priority: 2 },
      { category: 'adductor', count: 1, priority: 3 },
    ],
  },
  {
    day_index: 4,
    splitDay: 'pull',
    focus_label: 'Iron: Upper Pull (Back · Rear Delts · Biceps)',
    primary_muscles: ['latissimus_dorsi', 'posterior_deltoid', 'biceps_brachii'],
    secondary_muscles: ['trapezius', 'brachialis'],
    min_exercises: 7,
    max_exercises: 9,
    slots: [
      { category: 'back_vertical_pull', count: 2, priority: 1 },
      { category: 'back_horizontal_row', count: 2, priority: 1 },
      { category: 'shoulder_posterior_fly', count: 2, priority: 1 },
      { category: 'biceps_curl_long_head', count: 1, priority: 2 },
      { category: 'biceps_curl_short_head', count: 1, priority: 2 },
      { category: 'biceps_hammer', count: 1, priority: 3 },
    ],
  },
  {
    day_index: 5,
    splitDay: 'legs',
    focus_label: 'Iron: Lower Posterior (Hamstrings · Glutes · Calves)',
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
  {
    day_index: 6,
    splitDay: 'push',
    focus_label: 'Iron: Weak Point · Arms · Core (X-Frame)',
    primary_muscles: ['biceps_brachii', 'triceps_brachii', 'rectus_abdominis'],
    secondary_muscles: ['forearms', 'obliques', 'deltoid_lateral'],
    min_exercises: 7,
    max_exercises: 9,
    slots: [
      { category: 'shoulder_lateral_raise', count: 2, priority: 1 },
      { category: 'biceps_curl', count: 2, priority: 1 },
      { category: 'triceps_extension', count: 2, priority: 1 },
      { category: 'forearm_isolation', count: 1, priority: 2 },
      { category: 'core_anti_extension', count: 1, priority: 2 },
      { category: 'core_rotation', count: 1, priority: 3 },
    ],
  },
];

export const ABCDE_SPLIT: {
  name: 'ABCDE + 2 Rest (X-Frame)';
  days: 7;
  structure: readonly (AbcdeTrainingDay | AbcdeRestDay)[];
} = {
  name: 'ABCDE + 2 Rest (X-Frame)',
  days: 7,
  structure: [
    ...ABCDE_TRAINING_DAYS,
    {
      day_index: 3,
      focus_label: 'Rest · Healer Zone & Mobility',
      is_rest_day: true,
    },
    {
      day_index: 7,
      focus_label: 'Rest · Spirit & Nutrition Reset',
      is_rest_day: true,
    },
  ],
};

export type AbcdeDayTemplate = {
  splitDay: SplitDayKey;
  focusLabel: string;
  minExercises: number;
  maxExercises: number;
  slots: readonly SolverSlot[];
  calendarDayIndex: AbcdeTrainingDay['day_index'];
};

function slotDefaultsForCategory(category: AbcdeCategory): Pick<
  SolverSlot,
  'requiredPatterns' | 'primaryMuscleHint' | 'isolationOnly' | 'defaultSets'
> {
  switch (category) {
    case 'chest_horizontal_press':
    case 'chest_incline_press':
    case 'chest_decline_press':
      return { requiredPatterns: ['push'], primaryMuscleHint: 'chest', defaultSets: 5 };
    case 'chest_fly':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'chest', isolationOnly: true, defaultSets: 4 };
    case 'triceps_compound':
      return { requiredPatterns: ['push', 'isolation'], primaryMuscleHint: 'triceps', defaultSets: 4 };
    case 'triceps_overhead':
    case 'triceps_pushdown':
    case 'triceps_extension':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'triceps', isolationOnly: true, defaultSets: 4 };
    case 'back_vertical_pull':
    case 'back_horizontal_row':
      return { requiredPatterns: ['pull'], primaryMuscleHint: 'back', defaultSets: 5 };
    case 'biceps_curl_long_head':
    case 'biceps_curl_short_head':
    case 'biceps_hammer':
    case 'biceps_curl':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'biceps', isolationOnly: true, defaultSets: 4 };
    case 'quad_compound':
      return { requiredPatterns: ['squat', 'lunge'], primaryMuscleHint: 'quads', defaultSets: 5 };
    case 'quad_isolation':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'quads', isolationOnly: true, defaultSets: 4 };
    case 'adductor':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'adductors', isolationOnly: true, defaultSets: 3 };
    case 'calf_raise':
    case 'calf_raise_seated':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'calves', isolationOnly: true, defaultSets: 4 };
    case 'shoulder_overhead_press':
      return { requiredPatterns: ['push'], primaryMuscleHint: 'front_delts', defaultSets: 5 };
    case 'shoulder_lateral_raise':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'side_delts', isolationOnly: true, defaultSets: 4 };
    case 'shoulder_posterior_fly':
      return { requiredPatterns: ['isolation', 'pull'], primaryMuscleHint: 'rear_delts', isolationOnly: true, defaultSets: 4 };
    case 'shoulder_anterior_raise':
      return { requiredPatterns: ['isolation', 'push'], primaryMuscleHint: 'front_delts', defaultSets: 4 };
    case 'trap_shrug':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'traps', isolationOnly: true, defaultSets: 4 };
    case 'forearm_isolation':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'forearms', isolationOnly: true, defaultSets: 3 };
    case 'core_anti_extension':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'core', isolationOnly: true, defaultSets: 4 };
    case 'core_rotation':
      return { requiredPatterns: ['isolation'], isolationOnly: true, defaultSets: 3 };
    case 'hinge_compound':
      return { requiredPatterns: ['hinge'], primaryMuscleHint: 'hamstrings', defaultSets: 5 };
    case 'hamstring_curl':
      return { requiredPatterns: ['isolation'], primaryMuscleHint: 'hamstrings', isolationOnly: true, defaultSets: 4 };
    case 'glute_isolation':
      return { requiredPatterns: ['isolation', 'hinge'], primaryMuscleHint: 'glutes', defaultSets: 4 };
  }
}

function expandSlots(day: AbcdeTrainingDay): SolverSlot[] {
  return day.slots.flatMap((slotSpec) =>
    Array.from({ length: slotSpec.count }, (_, index) => ({
      slotId: `${slotSpec.category}_${index + 1}`,
      day: day.splitDay,
      category: slotSpec.category,
      ...slotDefaultsForCategory(slotSpec.category),
    })),
  );
}

export function resolveAbcdeDayTemplate(ironSlotIndex: number): AbcdeDayTemplate {
  const day = ABCDE_TRAINING_DAYS[ironSlotIndex % ABCDE_TRAINING_DAYS.length]!;
  return {
    splitDay: day.splitDay,
    focusLabel: day.focus_label,
    minExercises: day.min_exercises,
    maxExercises: day.max_exercises,
    calendarDayIndex: day.day_index,
    slots: expandSlots(day),
  };
}

export function abcdeRestDayFocusLabel(dayIndex: number): string | null {
  const restDay = ABCDE_SPLIT.structure.find(
    (entry): entry is AbcdeRestDay => 'is_rest_day' in entry && entry.day_index === dayIndex,
  );
  return restDay?.focus_label ?? null;
}
