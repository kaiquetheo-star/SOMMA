import type { Href } from 'expo-router';

import type { WorkoutPillar } from '@/types/gameplan';

export const WORKOUT_ROUTES: Partial<Record<WorkoutPillar, Href>> = {
  iron: '/(workout)/iron',
  nutrition: '/(tabs)/analytics',
  spirit: '/(tabs)/home',
};

export const PILLAR_LABELS: Record<WorkoutPillar, string> = {
  iron: 'Iron',
  nutrition: 'Nutrition',
  spirit: 'Recovery',
  longevity: 'Longevity',
};
