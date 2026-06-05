import type { NutritionTarget, WorkoutBlock } from '@/types/gameplan';

export const DAMAGE_CONTROL_NOTE = 'Protocolo de Recuperação Metabólica Ativo';

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

function recalculateCalories(proteinG: number, carbsG: number, fatG: number): number {
  return Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
}

export function applyDamageControl(target: NutritionTarget): NutritionTarget {
  if (target.note?.includes(DAMAGE_CONTROL_NOTE)) return target;

  const protein_g = clampNonNegative(target.protein_g);
  const carbs_g = Math.round(clampNonNegative(target.carbs_g) * 0.6);
  const fat_g = Math.round(clampNonNegative(target.fat_g) * 0.6);
  const water_ml = Math.round(clampNonNegative(target.water_ml) + 1000);

  return {
    ...target,
    protein_g,
    carbs_g,
    fat_g,
    water_ml,
    total_calories: recalculateCalories(protein_g, carbs_g, fat_g),
    hydration_focus: 'flush_sodium',
    note: target.note ? `${target.note} · ${DAMAGE_CONTROL_NOTE}` : DAMAGE_CONTROL_NOTE,
  };
}

export function restoreDamageControlTarget(target: NutritionTarget): NutritionTarget {
  if (!target.note?.includes(DAMAGE_CONTROL_NOTE)) return target;

  const protein_g = clampNonNegative(target.protein_g);
  const carbs_g = Math.round(clampNonNegative(target.carbs_g) / 0.6);
  const fat_g = Math.round(clampNonNegative(target.fat_g) / 0.6);
  const water_ml = Math.round(Math.max(0, clampNonNegative(target.water_ml) - 1000));
  const note = target.note
    .split(' · ')
    .filter((part) => part !== DAMAGE_CONTROL_NOTE)
    .join(' · ');

  return {
    ...target,
    protein_g,
    carbs_g,
    fat_g,
    water_ml,
    total_calories: recalculateCalories(protein_g, carbs_g, fat_g),
    hydration_focus: target.hydration_focus === 'flush_sodium' ? 'standard' : target.hydration_focus,
    note: note || undefined,
  };
}

export function injectMetabolicFlushBlock(dayIndex: number): WorkoutBlock {
  return {
    id: `block-d${dayIndex}-metabolic-flush`,
    pillar: 'spirit',
    title: 'Metabolic Flush (Zona 2)',
    subtitle: '15 min Caminhada Inclinada ou Bicicleta Leve',
    duration_minutes: 15,
    order: 0,
    status: 'pending',
    spirit: {
      mode: 'active_recovery',
      tempo_id: 'zone2_steady',
      duration_minutes: 15,
      prescribed_reason:
        'Oxidação de substratos e suporte hepático pós-deslize alimentar.',
    },
  };
}
