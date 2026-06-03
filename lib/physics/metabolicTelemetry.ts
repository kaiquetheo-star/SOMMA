import type { UserBiological } from '@/types/biological';
import type { NutritionTarget } from '@/types/gameplan';

export type { HydrationFocus, NutritionTarget } from '@/types/gameplan';

const PROTEIN_G_PER_KG = 2.2;
const PERI_WORKOUT_CARB_RATIO = 0.65;
const DEFAULT_BODY_WEIGHT_KG = 70;

function resolveWeightKg(biological: UserBiological): number {
  const weight = biological.weight_kg;
  return weight != null && Number.isFinite(weight) && weight > 0
    ? weight
    : DEFAULT_BODY_WEIGHT_KG;
}

function maintenanceCalories(weightKg: number): number {
  // Deterministic local-first baseline when sex/activity fields are unavailable.
  return Math.round(weightKg * 33);
}

function normalizeFocus(dayFocus: string): string {
  return dayFocus.toLowerCase().trim();
}

function resolveCarbCycling(dayFocus: string): {
  calorieDelta: number;
  carbsPerKg: number;
  fatPerKg: number;
} {
  const focus = normalizeFocus(dayFocus);

  // Regra 3.1: Legs/HIIT days get high-carb surplus for glycogen-demanding work.
  if (focus.includes('legs') || focus.includes('hiit')) {
    return { calorieDelta: 250, carbsPerKg: 4.5, fatPerKg: 0.8 };
  }

  // Regra 3.1: Push/Pull days stay at maintenance with moderate carbohydrates.
  if (focus.includes('push') || focus.includes('pull')) {
    return { calorieDelta: 0, carbsPerKg: 3.0, fatPerKg: 1.2 };
  }

  // Regra 3.1: Rest/Flow days use a light deficit and low carbohydrates.
  if (focus === 'rest' || focus === 'flow' || focus.includes('rest')) {
    return { calorieDelta: -200, carbsPerKg: 1.5, fatPerKg: 1.5 };
  }

  return { calorieDelta: 0, carbsPerKg: 3.0, fatPerKg: 1.2 };
}

export function computeNutritionSnapshot(
  biological: UserBiological,
  dayFocus: string,
  duration_minutes: number,
): NutritionTarget {
  const weightKg = resolveWeightKg(biological);
  const carbCycling = resolveCarbCycling(dayFocus);

  const protein_g = Math.round(weightKg * PROTEIN_G_PER_KG);
  const carbs_g = Math.round(weightKg * carbCycling.carbsPerKg);
  const fat_g = Math.round(weightKg * carbCycling.fatPerKg);
  const duration = Number.isFinite(duration_minutes) ? Math.max(0, duration_minutes) : 0;

  return {
    total_calories: maintenanceCalories(weightKg) + carbCycling.calorieDelta,
    protein_g,
    carbs_g,
    fat_g,
    // Regra 3.3: base water + training duration demand.
    water_ml: Math.round(weightKg * 50 + duration * 15),
    peri_workout_carb_ratio: PERI_WORKOUT_CARB_RATIO,
    hydration_focus: biological.hormonal_transition === true ? 'flush_sodium' : 'standard',
  };
}
