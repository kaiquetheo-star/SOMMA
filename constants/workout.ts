import type { Href } from 'expo-router';

import type { WorkoutPillar } from '@/types/gameplan';

export const WORKOUT_ROUTES: Record<WorkoutPillar, Href> = {
  iron: '/(workout)/iron',
  combat: '/(workout)/combat',
  spirit: '/(workout)/spirit',
};

export const PILLAR_LABELS: Record<WorkoutPillar, string> = {
  iron: 'Iron',
  combat: 'Blood & Bone',
  spirit: 'Spirit & Flow',
};
