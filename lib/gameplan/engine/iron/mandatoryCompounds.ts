import type { EquipmentTag } from '@/store/useSommaStore';
import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import { normalizePreferredSplit, type PreferredSplit } from '@/types/biological';

export const MANDATORY_COMPOUNDS_BY_DAY: Record<number, string[]> = {
  // At least one heavy incline chest press and one flat barbell bench press.
  1: [
    'incline_bench_press',
    'barbell_incline_bench_press',
    'incline_bench_press_barbell',
    'dumbbell_incline_bench_press',
    'incline_bench_press_dumbbell',
    'barbell_bench_press',
  ],
  // At least one heavy row.
  2: ['barbell_bent_over_row', 't_bar_row', 'lever_t_bar_row', 'chest_supported_row'],
  // At least one heavy leg compound.
  3: ['hack_squat', 'hack_squats', 'leg_press', 'barbell_back_squat', 'dumbbell_single_leg_split_squat', 'smith_single_leg_split_squat'],
  // At least one overhead press.
  4: [
    'barbell_overhead_press',
    'overhead_press',
    'barbell_seated_overhead_press',
    'dumbbell_shoulder_press',
    'dumbbell_standing_overhead_press',
    'arnold_press',
    'dumbbell_arnold_press_v_2',
  ],
  // Arms day does not require a mandatory compound.
  5: [],
  // At least one hinge.
  6: ['romanian_deadlift', 'stiff_leg_deadlift', 'dumbbell_stiff_leg_deadlift', 'good_morning', 'barbell_hip_thrust', 'hip_thrust_barbell'],
};

export const MANDATORY_COMPOUND_GROUPS_BY_DAY: Record<number, readonly string[][]> = {
  1: [
    [
      'incline_bench_press',
      'barbell_incline_bench_press',
      'incline_bench_press_barbell',
      'dumbbell_incline_bench_press',
      'incline_bench_press_dumbbell',
    ],
    ['barbell_bench_press'],
  ],
  2: [MANDATORY_COMPOUNDS_BY_DAY[2]!],
  3: [MANDATORY_COMPOUNDS_BY_DAY[3]!],
  4: [MANDATORY_COMPOUNDS_BY_DAY[4]!],
  5: [],
  6: [MANDATORY_COMPOUNDS_BY_DAY[6]!],
};

/** Calendar-day mandatory groups for ABCDE (1× frequency). */
export const ABCDE_MANDATORY_COMPOUND_GROUPS_BY_DAY: Record<number, readonly string[][]> = {
  1: MANDATORY_COMPOUND_GROUPS_BY_DAY[1]!,
  2: MANDATORY_COMPOUND_GROUPS_BY_DAY[3]!,
  4: MANDATORY_COMPOUND_GROUPS_BY_DAY[2]!,
  5: MANDATORY_COMPOUND_GROUPS_BY_DAY[6]!,
  6: [],
};

export function mandatoryCompoundGroupsForDay(
  dayIndex: number,
  preferredSplit?: PreferredSplit | null,
): readonly string[][] {
  if (normalizePreferredSplit(preferredSplit) === 'abcde') {
    return ABCDE_MANDATORY_COMPOUND_GROUPS_BY_DAY[dayIndex] ?? [];
  }
  return MANDATORY_COMPOUND_GROUPS_BY_DAY[dayIndex] ?? [];
}

export function mandatoryCompoundSlugsForDay(
  dayIndex: number,
  preferredSplit?: PreferredSplit | null,
): string[] {
  return mandatoryCompoundGroupsForDay(dayIndex, preferredSplit).flat();
}

export function hasRequiredEquipment(
  exercise: CatalogExercise,
  availableEquipment: readonly EquipmentTag[],
): boolean {
  if (availableEquipment.length === 0) return false;
  if (exercise.equipment_required.length === 0) return true;
  return exercise.equipment_required.some((tag) => availableEquipment.includes(tag as EquipmentTag));
}

export function hasRequiredCompound(
  exercises: readonly CatalogExercise[],
  dayIndex: number,
  preferredSplit?: PreferredSplit | null,
): boolean {
  const mandatoryGroups = mandatoryCompoundGroupsForDay(dayIndex, preferredSplit);
  if (mandatoryGroups.length === 0) return true;

  return mandatoryGroups.every((group) =>
    exercises.some((exercise) => group.includes(exercise.slug)),
  );
}

export function getMandatoryCompoundCandidates(
  catalog: readonly CatalogExercise[],
  dayIndex: number,
  environment: { available_equipment: readonly EquipmentTag[] },
  preferredSplit?: PreferredSplit | null,
): CatalogExercise[] {
  const mandatory = mandatoryCompoundSlugsForDay(dayIndex, preferredSplit);
  return catalog
    .filter(
      (exercise) =>
        mandatory.includes(exercise.slug) &&
        hasRequiredEquipment(exercise, environment.available_equipment),
    )
    .sort((a, b) => mandatory.indexOf(a.slug) - mandatory.indexOf(b.slug));
}
