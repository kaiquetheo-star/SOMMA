import type { ClinicalExitInterview } from '@/types/clinical';

export type TrainingExperienceLevel =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'BEGINNER'
  | 'INTERMEDIATE'
  | 'ADVANCED';

export type MesocyclePhase = 'bulking' | 'cutting' | 'maintenance' | 'deload';

export type MesocycleGoal = 'strength' | 'hypertrophy' | 'metabolic_conditioning';

export type PreferredSplit = 'abcdef' | 'ppl_x2';

/** Biological Passport — maps to anthropometric, Iron and nutrition steering fields */
export interface BiologicalProfile {
  date_of_birth: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_percentage: number | null;
  current_injuries: string | null;
  baseline_stress_level: number | null;
  goal_iron: string | null;
  nutrition_goal: string | null;
  /** Weekly availability for microcycle planning (1–7) */
  training_days_per_week: number | null;
  /** Self-reported lifting experience for cold-start load safety. */
  experience_level: TrainingExperienceLevel | null;
  /** Typical Iron session duration (minutes) */
  available_time_iron: number | null;
  /**
   * Iron mastery tier (1–5). 5 = elite (Mr. Olympia), 1 = beginner.
   * Used by the deterministic iron engine to filter overly-basic movements and improve rotation quality.
   */
  iron_mastery: 1 | 2 | 3 | 4 | 5 | null;
  /** Iron blocks per 7-day microcycle (0–7) */
  frequency_iron: number | null;
  /** Rolling CNS fatigue 0–100 from performance sync */
  cns_fatigue_score: number | null;
  /** Annual macro phase for Iron volume periodization. */
  mesocycle_phase?: MesocyclePhase | null;
  /** Current mesocycle week (1–6). Weeks 4/6 force deload volume. */
  mesocycle_week?: number | null;
  /** Primary adaptation target for the current mesocycle. */
  mesocycle_goal?: MesocycleGoal | null;
  /** Weekly Iron split template. ABCDEF is the X-Frame default; PPL x2 is legacy. */
  preferred_split?: PreferredSplit | null;
  /** Month 1 exit interview — calibrates Month 2 target loads */
  clinical_exit_interview: ClinicalExitInterview | null;
  /** User-reported body fat estimate (%) for timeline calculation */
  current_body_fat_estimate: number | null;
  /** Regra 2/3: hormonal transition phase increases recovery and hydration caution. */
  hormonal_transition?: boolean | null;
}

export type UserBiological = BiologicalProfile;

export const PILLAR_FREQUENCY_MIN = 0;
export const PILLAR_FREQUENCY_MAX = 7;
export const FIXED_DATE_OF_BIRTH = '1994-05-14';
export const FIXED_HEIGHT_CM = 159;
export const FIXED_GOAL_IRON = 'Hypertrophy';
export const FIXED_NUTRITION_GOAL = 'Hypertrophy support';
export const DEFAULT_FREQUENCY_IRON = 6;
export const DEFAULT_PREFERRED_SPLIT: PreferredSplit = 'abcdef';

export const TIME_BUDGET_PRESETS = [
  { id: '45', label: '45m', iron: 45 },
  { id: '60', label: '60m', iron: 60 },
  { id: '90', label: '90m', iron: 90 },
  { id: 'max', label: 'Unlimited / Max Results', iron: 180 },
] as const;

export type TimeBudgetPresetId = (typeof TIME_BUDGET_PRESETS)[number]['id'];

export const DEFAULT_AVAILABLE_TIME_IRON = 90;

export const TRAINING_DAYS_MIN = 1;
export const TRAINING_DAYS_MAX = 7;
export const DEFAULT_TRAINING_DAYS_PER_WEEK = 6;

export const initialBiologicalProfile: BiologicalProfile = {
  date_of_birth: FIXED_DATE_OF_BIRTH,
  weight_kg: null,
  height_cm: FIXED_HEIGHT_CM,
  body_fat_percentage: null,
  current_injuries: null,
  baseline_stress_level: null,
  goal_iron: FIXED_GOAL_IRON,
  nutrition_goal: FIXED_NUTRITION_GOAL,
  training_days_per_week: DEFAULT_TRAINING_DAYS_PER_WEEK,
  experience_level: 'advanced',
  available_time_iron: DEFAULT_AVAILABLE_TIME_IRON,
  iron_mastery: 5,
  frequency_iron: DEFAULT_FREQUENCY_IRON,
  cns_fatigue_score: 0,
  mesocycle_phase: 'maintenance',
  mesocycle_week: 1,
  mesocycle_goal: 'hypertrophy',
  preferred_split: DEFAULT_PREFERRED_SPLIT,
  clinical_exit_interview: null,
  current_body_fat_estimate: null,
  hormonal_transition: false,
};

export function withFixedBiologicalProfile(
  profile: Partial<BiologicalProfile> | null | undefined,
): BiologicalProfile {
  const trainingDays =
    profile?.training_days_per_week ?? profile?.frequency_iron ?? DEFAULT_TRAINING_DAYS_PER_WEEK;
  return {
    date_of_birth: FIXED_DATE_OF_BIRTH,
    weight_kg: profile?.weight_kg ?? initialBiologicalProfile.weight_kg,
    height_cm: FIXED_HEIGHT_CM,
    body_fat_percentage: profile?.body_fat_percentage ?? initialBiologicalProfile.body_fat_percentage,
    current_injuries: profile?.current_injuries ?? initialBiologicalProfile.current_injuries,
    baseline_stress_level:
      profile?.baseline_stress_level ?? initialBiologicalProfile.baseline_stress_level,
    goal_iron: FIXED_GOAL_IRON,
    nutrition_goal: FIXED_NUTRITION_GOAL,
    available_time_iron: profile?.available_time_iron ?? DEFAULT_AVAILABLE_TIME_IRON,
    training_days_per_week: trainingDays,
    frequency_iron: profile?.frequency_iron ?? trainingDays,
    experience_level: profile?.experience_level ?? initialBiologicalProfile.experience_level,
    iron_mastery: profile?.iron_mastery ?? initialBiologicalProfile.iron_mastery,
    cns_fatigue_score: profile?.cns_fatigue_score ?? initialBiologicalProfile.cns_fatigue_score,
    mesocycle_phase: profile?.mesocycle_phase ?? initialBiologicalProfile.mesocycle_phase,
    mesocycle_week: profile?.mesocycle_week ?? initialBiologicalProfile.mesocycle_week,
    mesocycle_goal: profile?.mesocycle_goal ?? initialBiologicalProfile.mesocycle_goal,
    preferred_split: profile?.preferred_split ?? DEFAULT_PREFERRED_SPLIT,
    clinical_exit_interview:
      profile?.clinical_exit_interview ?? initialBiologicalProfile.clinical_exit_interview,
    current_body_fat_estimate:
      profile?.current_body_fat_estimate ?? initialBiologicalProfile.current_body_fat_estimate,
    hormonal_transition: profile?.hormonal_transition ?? initialBiologicalProfile.hormonal_transition,
  };
}

/** Valid body fat % for passport and physics (0–60). */
export function clampBodyFatPercent(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value <= 0 || value > 60) return null;
  return Math.round(value * 10) / 10;
}

/** Single source of truth — prefers `body_fat_percentage`, falls back to legacy estimate. */
export function getBodyFatPercentage(profile: BiologicalProfile): number | null {
  const primary = clampBodyFatPercent(profile.body_fat_percentage);
  if (primary != null) return primary;
  return clampBodyFatPercent(profile.current_body_fat_estimate);
}

/** Keep legacy column in sync when persisting from the one UI field. */
export function normalizeBodyFatFields(
  profile: BiologicalProfile,
): Pick<BiologicalProfile, 'body_fat_percentage' | 'current_body_fat_estimate'> {
  const unified = getBodyFatPercentage(profile);
  return {
    body_fat_percentage: unified,
    current_body_fat_estimate: unified,
  };
}

export function clampCnsFatigueProfile(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

export function clampPillarTimeMinutes(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function clampTrainingDaysPerWeek(value: number): number {
  return Math.min(TRAINING_DAYS_MAX, Math.max(TRAINING_DAYS_MIN, Math.round(value)));
}

export function clampPillarFrequency(
  value: number | null | undefined,
  fallback: number = DEFAULT_FREQUENCY_IRON,
): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  return Math.min(PILLAR_FREQUENCY_MAX, Math.max(PILLAR_FREQUENCY_MIN, Math.round(value)));
}

/** Legacy `training_days_per_week` sync — active days = Iron frequency. */
export function deriveTrainingDaysFromFrequencies(profile: Pick<
  BiologicalProfile,
  'frequency_iron'
>): number {
  const frequency = clampPillarFrequency(profile.frequency_iron, 0);
  return frequency > 0 ? clampTrainingDaysPerWeek(frequency) : TRAINING_DAYS_MIN;
}

export function inferTimeBudgetPresetId(profile: BiologicalProfile): TimeBudgetPresetId {
  const iron = profile.available_time_iron ?? DEFAULT_AVAILABLE_TIME_IRON;
  const match = TIME_BUDGET_PRESETS.find((preset) => preset.iron === iron);
  return match?.id ?? '45';
}

export function timeBudgetFromPresetId(presetId: TimeBudgetPresetId): Pick<
  BiologicalProfile,
  'available_time_iron'
> {
  const preset = TIME_BUDGET_PRESETS.find((entry) => entry.id === presetId) ?? TIME_BUDGET_PRESETS[0];
  return {
    available_time_iron: preset.iron,
  };
}

export function formatTrainingDaysPerWeek(days: number | null): string {
  if (days == null) return '—';
  return days === 1 ? '1 day / week' : `${days} days / week`;
}

export function isBiologicalProfileComplete(profile: BiologicalProfile): boolean {
  return (
    Boolean(profile.date_of_birth) &&
    profile.weight_kg != null &&
    profile.weight_kg > 0 &&
    profile.height_cm != null &&
    profile.height_cm > 0 &&
    profile.baseline_stress_level != null &&
    profile.baseline_stress_level >= 1 &&
    profile.baseline_stress_level <= 10 &&
    profile.training_days_per_week != null &&
    profile.training_days_per_week >= TRAINING_DAYS_MIN &&
    profile.training_days_per_week <= TRAINING_DAYS_MAX
  );
}

/** Age in full years from ISO date string (YYYY-MM-DD) */
export function ageFromDateOfBirth(dateOfBirth: string | null): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;

  const born = new Date(`${dateOfBirth}T12:00:00`);
  if (Number.isNaN(born.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDelta = today.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < born.getDate())) {
    age -= 1;
  }

  return age >= 0 && age < 130 ? age : null;
}
