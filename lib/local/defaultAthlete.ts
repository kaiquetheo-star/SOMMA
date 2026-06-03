import { PILLAR_OPTIONS } from '@/constants/foundation';
import {
  DEFAULT_AVAILABLE_TIME_IRON,
  DEFAULT_FREQUENCY_IRON,
  DEFAULT_TRAINING_DAYS_PER_WEEK,
  type BiologicalProfile,
} from '@/types/biological';
import type { EquipmentTag, FocusPreference } from '@/store/useSommaStore';

export const LOCAL_ATHLETE_ID = 'local-athlete-0001';

const DEFAULT_FOCUS = PILLAR_OPTIONS.find((option) => option.id === 'iron')!.preference;

export const DEFAULT_LOCAL_EQUIPMENT: EquipmentTag[] = [
  'bodyweight',
  'dumbbells',
  'barbell',
  'full_gym',
];

export const DEFAULT_LOCAL_BIOLOGICAL: BiologicalProfile = {
  date_of_birth: '1990-06-15',
  weight_kg: 82,
  height_cm: 178,
  body_fat_percentage: null,
  current_injuries: null,
  baseline_stress_level: 5,
  goal_iron: 'Hypertrophy',
  nutrition_goal: 'Hypertrophy support',
  training_days_per_week: DEFAULT_TRAINING_DAYS_PER_WEEK,
  experience_level: 'beginner',
  available_time_iron: DEFAULT_AVAILABLE_TIME_IRON,
  iron_mastery: null,
  frequency_iron: DEFAULT_FREQUENCY_IRON,
  mesocycle_week: 1,
  cns_fatigue_score: 0,
  clinical_exit_interview: null,
  current_body_fat_estimate: null,
  target_archetype: null,
};

export function defaultLocalFocusPreference(): FocusPreference {
  return { ...DEFAULT_FOCUS };
}
