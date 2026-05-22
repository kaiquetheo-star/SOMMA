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
    preference: { iron: 45, combat: 20, flow: 20, spirit: 15 },
  },
  {
    id: 'combat',
    label: 'Blood & Bone',
    subtitle: 'Boxing · Muay Thai · metabolic catharsis',
    preference: { iron: 20, combat: 45, flow: 20, spirit: 15 },
  },
  {
    id: 'flow',
    label: 'Flow',
    subtitle: 'Yoga · joint longevity · biomechanical control',
    preference: { iron: 20, combat: 15, flow: 45, spirit: 20 },
  },
  {
    id: 'spirit',
    label: 'Spirit',
    subtitle: 'Breathwork · nervous system · meditation',
    preference: { iron: 15, combat: 15, flow: 20, spirit: 50 },
  },
  {
    id: 'balanced',
    label: 'Balanced Alchemy',
    subtitle: 'Equal attunement across all four pillars',
    preference: { iron: 25, combat: 25, flow: 25, spirit: 25 },
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
  { id: 'heavy_bag', label: 'Heavy Bag' },
  { id: 'full_gym', label: 'Full Gym Access' },
];

export const FOUNDATION_STEPS = ['focus', 'biology', 'environment'] as const;
export type FoundationStep = (typeof FOUNDATION_STEPS)[number];

export const FOUNDATION_STEP_META: Record<
  FoundationStep,
  { eyebrow: string; title: string; hint: string }
> = {
  focus: {
    eyebrow: 'Step I · Attunement',
    title: 'Where does your\nalchemy lean?',
    hint: 'Choose the pillar that will anchor your daily protocol.',
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
