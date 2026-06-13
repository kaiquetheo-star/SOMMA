import type { MesocyclePhase, UserBiological } from '@/types/biological';

export interface HormonalVolumeBudget {
  minExercisesPerDay: number;
  maxExercisesPerDay: number;
  targetSetsPerSession: number;
}

export function getHormonalRecoveryMultiplier(biological: UserBiological): number {
  if (!biological.hormonal_protocol) {
    return 1.0;
  }

  const protocol = biological.hormonal_protocol;

  if (protocol.type === 'trt') {
    // Therapeutic TRT range: better recovery without full-cycle volume tolerance.
    if (protocol.weekly_dose_mg && protocol.weekly_dose_mg <= 200) {
      return 1.5;
    }

    return 2.0;
  }

  if (protocol.type === 'enhanced_cycle') {
    return 2.5;
  }

  return 1.0;
}

export function getVolumeBudgetForHormonalProfile(
  biological: UserBiological,
  mesocyclePhase: MesocyclePhase,
): HormonalVolumeBudget {
  const multiplier = getHormonalRecoveryMultiplier(biological);

  if (mesocyclePhase === 'deload') {
    return {
      minExercisesPerDay: 4,
      maxExercisesPerDay: 5,
      targetSetsPerSession: Math.round(12 * multiplier),
    };
  }

  if (mesocyclePhase === 'maintenance') {
    return {
      minExercisesPerDay: 5,
      maxExercisesPerDay: 7,
      targetSetsPerSession: Math.round(18 * multiplier),
    };
  }

  return {
    minExercisesPerDay: 6,
    maxExercisesPerDay: 8,
    targetSetsPerSession: Math.round(22 * multiplier),
  };
}
