import {
  ageFromDateOfBirth,
  getBodyFatPercentage,
  type BiologicalProfile,
} from '@/types/biological';

export interface NaturalTargetTimeline {
  label: string;
  target_timeline_weeks: number;
  summary: string;
}

const SUSTAINABLE_HYPERTROPHY_TARGET_BF = 13;

/**
 * McDonald/Aragon model: max monthly muscle gain (kg) by training experience.
 * Year 1: ~0.9 kg/month, Year 2: ~0.45 kg/month, Year 3+: ~0.22 kg/month.
 * We estimate experience from training_days_per_week and age heuristic.
 */
function estimateMonthlyMuscleGainKg(trainingYears: number): number {
  if (trainingYears < 1) return 0.9;
  if (trainingYears < 2) return 0.45;
  if (trainingYears < 3) return 0.22;
  return 0.11;
}

/**
 * Safe fat-loss rate: 0.5%–1.0% of body weight per week.
 * Conservative estimate: 0.7% BW/week for sustainability.
 */
const FAT_LOSS_RATE_PERCENT_BW_PER_WEEK = 0.007;

/**
 * Heuristic: estimate training experience years from age + training frequency.
 * A younger person with high frequency is likely early in their training career.
 * This is a rough proxy; better data would come from performance logs.
 */
function estimateTrainingYears(age: number | null, trainingDaysPerWeek: number | null): number {
  if (age == null) return 1;
  const freq = trainingDaysPerWeek ?? 3;
  if (age < 22) return freq >= 5 ? 1.5 : 0.5;
  if (age < 30) return freq >= 5 ? 3 : 1.5;
  if (age < 40) return freq >= 5 ? 5 : 2.5;
  return freq >= 5 ? 7 : 3;
}

/**
 * Pure deterministic calculator for the fixed SOMMA objective:
 * sustainable functional hypertrophy with X-Frame bias.
 */
export function calculateNaturalTargetTimeline(
  profile: BiologicalProfile,
): NaturalTargetTimeline | null {
  const { weight_kg, height_cm, date_of_birth, training_days_per_week } = profile;

  if (weight_kg == null || weight_kg <= 0) return null;

  const currentBf = getBodyFatPercentage(profile);
  if (currentBf == null || currentBf <= 0 || currentBf > 60) return null;

  const age = ageFromDateOfBirth(date_of_birth);
  const trainingYears = estimateTrainingYears(age, training_days_per_week);
  const monthlyMuscleKg = estimateMonthlyMuscleGainKg(trainingYears);
  const bfDelta = currentBf - SUSTAINABLE_HYPERTROPHY_TARGET_BF;
  const muscleWeeks = Math.ceil(2 / monthlyMuscleKg * 4.33);
  const fatLossWeeks =
    bfDelta > 0
      ? Math.ceil((weight_kg * (bfDelta / 100)) / (weight_kg * FAT_LOSS_RATE_PERCENT_BW_PER_WEEK))
      : 0;
  let weeks = Math.max(12, fatLossWeeks + Math.ceil(muscleWeeks * 0.5));

  // Clamp to realistic bounds
  weeks = Math.min(104, Math.max(8, weeks));

  return {
    label: 'Functional Sustainable Hypertrophy',
    target_timeline_weeks: weeks,
    summary: `Natural Target: Functional Sustainable Hypertrophy · ${weeks}-Week Realistic Window`,
  };
}

/**
 * Fat-Free Mass Index — normalized lean mass indicator.
 * FFMI = lean_mass_kg / height_m^2
 * Natural ceiling ≈ 25 (non-enhanced athletes).
 */
function computeFFMI(weightKg: number, heightCm: number | null, bodyFatPercent: number): number {
  const heightM = (heightCm ?? 175) / 100;
  const leanMass = weightKg * (1 - bodyFatPercent / 100);
  return leanMass / (heightM * heightM);
}

export { computeFFMI };
