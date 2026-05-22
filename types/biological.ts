/** Biological Passport — maps to `profiles` anthropometric columns */
export interface BiologicalProfile {
  date_of_birth: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_percentage: number | null;
  current_injuries: string | null;
  baseline_stress_level: number | null;
  /** Per-pillar training goals — injected into each AI coach's CoT step */
  goal_iron: IronGoal | null;
  goal_combat: CombatGoal | null;
  goal_flow: FlowGoal | null;
  goal_spirit: SpiritGoal | null;
}

export type IronGoal = 'Hypertrophy' | 'Strength' | 'Endurance' | 'Recomposition';
export type CombatGoal =
  | 'Cardio Conditioning'
  | 'Technical Mastery'
  | 'Power Development'
  | 'Self-Defence';
export type FlowGoal = 'Mobility' | 'Recovery' | 'Flexibility' | 'Stress Relief';
export type SpiritGoal = 'Breathwork' | 'Meditation' | 'Recovery' | 'Pre-Session Prime';

export const IRON_GOALS: IronGoal[] = ['Hypertrophy', 'Strength', 'Endurance', 'Recomposition'];
export const COMBAT_GOALS: CombatGoal[] = [
  'Cardio Conditioning',
  'Technical Mastery',
  'Power Development',
  'Self-Defence',
];
export const FLOW_GOALS: FlowGoal[] = ['Mobility', 'Recovery', 'Flexibility', 'Stress Relief'];
export const SPIRIT_GOALS: SpiritGoal[] = [
  'Breathwork',
  'Meditation',
  'Recovery',
  'Pre-Session Prime',
];

export const initialBiologicalProfile: BiologicalProfile = {
  date_of_birth: null,
  weight_kg: null,
  height_cm: null,
  body_fat_percentage: null,
  current_injuries: null,
  baseline_stress_level: null,
  goal_iron: null,
  goal_combat: null,
  goal_flow: null,
  goal_spirit: null,
};

export function isBiologicalProfileComplete(profile: BiologicalProfile): boolean {
  return (
    Boolean(profile.date_of_birth) &&
    profile.weight_kg != null &&
    profile.weight_kg > 0 &&
    profile.height_cm != null &&
    profile.height_cm > 0 &&
    profile.baseline_stress_level != null &&
    profile.baseline_stress_level >= 1 &&
    profile.baseline_stress_level <= 10
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
