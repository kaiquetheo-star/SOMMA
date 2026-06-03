import type { EquipmentTag, FocusPreference, PillarId } from '@/store/useSommaStore';

export interface PillarOption {
  id: PillarId;
  label: string;
  subtitle: string;
  preference: FocusPreference;
}

/** Preset ratio distributions (sum = 100) per FSD §3.1 Step 1 */
export const PILLAR_OPTIONS: PillarOption[] = [
  {
    id: 'iron',
    label: 'Iron',
    subtitle: 'Hypertrophy · bone density · progressive overload',
    preference: { iron: 80, nutrition: 20 },
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    subtitle: 'Fueling · biomarkers · body composition',
    preference: { iron: 60, nutrition: 40 },
  },
];

export interface EquipmentOption {
  id: EquipmentTag;
  label: string;
}

export const EQUIPMENT_OPTIONS: EquipmentOption[] = [
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'dumbbells', label: 'Dumbbells' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'barbell', label: 'Barbell' },
  { id: 'pull_up_bar', label: 'Pull-up Bar' },
  { id: 'full_gym', label: 'Full Gym Access' },
];

export const FOUNDATION_STEPS = ['focus', 'biology', 'environment'] as const;
export type FoundationStep = (typeof FOUNDATION_STEPS)[number];

export const FOUNDATION_STEP_META: Record<
  FoundationStep,
  { eyebrow: string; title: string; hint: string }
> = {
  focus: {
    eyebrow: 'Step I · Focus',
    title: 'Define your\ntraining focus',
    hint: 'Choose whether Iron or nutrition will anchor your daily protocol.',
  },
  biology: {
    eyebrow: 'Step II · Biological Passport',
    title: 'Your biological\nbaseline',
    hint: 'Weight, age, stress, and injuries shape safe volume and intensity for Iron and recovery.',
  },
  environment: {
    eyebrow: 'Step III · Environment',
    title: 'What instruments\ndo you wield?',
    hint: 'Select every tool available to you today. You may recalibrate later.',
  },
};
