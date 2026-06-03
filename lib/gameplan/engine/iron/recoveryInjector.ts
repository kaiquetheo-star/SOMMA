import type { UserBiological } from '@/types/biological';
import type { GameplanBlock, MicrocycleDay } from '@/types/gameplan';
import type { TrainingLoadSnapshot } from '@/lib/physics/loadTelemetry';

const HEALER_REASON = 'High systemic fatigue detected. Downregulate CNS.';

function resolveAcwr(telemetry: TrainingLoadSnapshot): number | null {
  return telemetry.acwr ?? telemetry.pillars.iron.acwr ?? null;
}

function nextOrder(day: MicrocycleDay): number {
  return day.blocks.reduce((max, block) => Math.max(max, block.order), -1) + 1;
}

function createSpiritBlock(day: MicrocycleDay): GameplanBlock {
  return {
    id: `block-d${day.day_index}-spirit-recovery`,
    pillar: 'spirit',
    title: 'Healer Zone',
    subtitle: '4-7-8 breathwork · downshift CNS',
    duration_minutes: 12,
    order: nextOrder(day),
    status: 'pending',
    spirit: {
      mode: 'breathwork',
      tempo_id: 'tempo_478',
      duration_minutes: 12,
      prescribed_reason: HEALER_REASON,
    },
  };
}

function cloneBlockWithDeload(block: GameplanBlock, shouldDeload: boolean): GameplanBlock {
  if (!shouldDeload || !block.iron) return { ...block };

  // Regra 5.4: automatic deload preserves the movement pattern while halving volume and reducing load.
  return {
    ...block,
    iron: {
      ...block.iron,
      exercises: block.iron.exercises.map((exercise) => ({
        ...exercise,
        target_sets: Math.max(2, Math.floor(exercise.target_sets * 0.5)),
        target_weight_kg:
          exercise.target_weight_kg != null
            ? Math.round(exercise.target_weight_kg * 0.85 * 10) / 10
            : null,
      })),
    },
  };
}

function shouldInjectHealerZone(
  telemetry: TrainingLoadSnapshot,
  biological: UserBiological,
): boolean {
  const acwr = resolveAcwr(telemetry);
  // Regra 5.2: high stress or ACWR elevation triggers parasympathetic recovery.
  return (biological.baseline_stress_level ?? 0) >= 7 || (acwr != null && acwr > 1.4);
}

export function injectRecoveryProtocols(
  microcycle: MicrocycleDay[],
  telemetry: TrainingLoadSnapshot,
  biological: UserBiological,
): MicrocycleDay[] {
  const shouldDeload = telemetry.is_deload_week === true;
  const needsHealer = shouldInjectHealerZone(telemetry, biological);

  const cloned = microcycle.map((day) => ({
    ...day,
    blocks: day.blocks.map((block) => cloneBlockWithDeload(block, shouldDeload)),
  }));

  if (!needsHealer) return cloned;

  const restDayIndexes = cloned
    .map((day, index) => (day.is_rest_day ? index : -1))
    .filter((index) => index >= 0);
  const targetIndexes = restDayIndexes.length > 0 ? restDayIndexes : [cloned.length - 1];

  return cloned.map((day, index) => {
    if (!targetIndexes.includes(index)) return day;
    const hasRecoveryBlock = day.blocks.some((block) => block.spirit?.tempo_id === 'tempo_478');
    if (hasRecoveryBlock) return day;

    return {
      ...day,
      blocks: [...day.blocks, createSpiritBlock(day)],
    };
  });
}
