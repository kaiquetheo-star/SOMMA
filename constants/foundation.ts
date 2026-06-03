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
    preference: { iron: 100, nutrition: 100 },
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

export const FOUNDATION_STEPS = ['biology', 'environment'] as const;
export type FoundationStep = (typeof FOUNDATION_STEPS)[number];

export const FOUNDATION_STEP_META: Record<
  FoundationStep,
  { eyebrow: string; title: string; hint: string }
> = {
  biology: {
    eyebrow: 'Step I · Biological Passport',
    title: 'Your biological\nbaseline',
    hint: 'Permanent data is fixed. Confirm body weight, stress, and weekly training frequency.',
  },
  environment: {
    eyebrow: 'Step II · Environment',
    title: 'What instruments\ndo you wield?',
    hint: 'Select every tool available to you today. You may recalibrate later.',
  },
};
