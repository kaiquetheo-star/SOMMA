import type { Href } from 'expo-router';

import type { WorkoutPillar } from '@/types/gameplan';

export const WORKOUT_ROUTES: Partial<Record<WorkoutPillar, Href>> = {
  iron: '/(workout)/iron',
  longevity: '/(workout)/longevity' as Href,
  nutrition: '/(tabs)/analytics',
  spirit: '/(tabs)/home',
};
