import type { EquipmentTag } from '@/store/useSommaStore';

export interface IronExerciseTemplate {
  id: string;
  name: string;
  equipment_required: EquipmentTag[];
  alternate_id: string;
  target_weight_kg: number;
  target_reps: number;
  total_sets: number;
  rest_seconds: number;
}

export const IRON_EXERCISE_LIBRARY: IronExerciseTemplate[] = [
  {
    id: 'barbell_bench',
    name: 'Barbell Bench Press',
    equipment_required: ['barbell', 'full_gym'],
    alternate_id: 'pushup',
    target_weight_kg: 72.5,
    target_reps: 8,
    total_sets: 4,
    rest_seconds: 90,
  },
  {
    id: 'dumbbell_press',
    name: 'Dumbbell Bench Press',
    equipment_required: ['dumbbells'],
    alternate_id: 'pushup',
    target_weight_kg: 28,
    target_reps: 10,
    total_sets: 4,
    rest_seconds: 75,
  },
  {
    id: 'pushup',
    name: 'Push-up Progression',
    equipment_required: ['bodyweight'],
    alternate_id: 'pushup',
    target_weight_kg: 0,
    target_reps: 12,
    total_sets: 4,
    rest_seconds: 60,
  },
  {
    id: 'barbell_squat',
    name: 'Back Squat',
    equipment_required: ['barbell', 'full_gym'],
    alternate_id: 'goblet_squat',
    target_weight_kg: 100,
    target_reps: 6,
    total_sets: 4,
    rest_seconds: 120,
  },
  {
    id: 'goblet_squat',
    name: 'Goblet Squat',
    equipment_required: ['dumbbells', 'kettlebell'],
    alternate_id: 'goblet_squat',
    target_weight_kg: 24,
    target_reps: 10,
    total_sets: 3,
    rest_seconds: 90,
  },
];

export function resolveIronExercise(equipment: EquipmentTag[]): IronExerciseTemplate {
  const has = (tags: EquipmentTag[]) => tags.some((tag) => equipment.includes(tag));

  if (has(['barbell', 'full_gym'])) {
    return IRON_EXERCISE_LIBRARY.find((ex) => ex.id === 'barbell_bench')!;
  }
  if (has(['dumbbells'])) {
    return IRON_EXERCISE_LIBRARY.find((ex) => ex.id === 'dumbbell_press')!;
  }
  return IRON_EXERCISE_LIBRARY.find((ex) => ex.id === 'pushup')!;
}

export function getAlternateExercise(exerciseId: string): IronExerciseTemplate {
  const current = IRON_EXERCISE_LIBRARY.find((ex) => ex.id === exerciseId);
  const alternateId = current?.alternate_id ?? 'pushup';
  return IRON_EXERCISE_LIBRARY.find((ex) => ex.id === alternateId) ?? IRON_EXERCISE_LIBRARY[2];
}
