import type { UserBiological } from '@/types/biological';
import type { GameplanBlock, MicrocycleDay } from '@/types/gameplan';
import type { TrainingLoadSnapshot } from '@/lib/physics/loadTelemetry';

const HEALER_REASON = 'High systemic fatigue detected. Downregulate CNS.';
const CLINICAL_EXTREME_FATIGUE = 9;

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

/**
 * Deload pass for Injector: load −15% only.
 * Set-volume cut is owned by recoveryComposition (additive policy).
 */
function cloneBlockWithDeload(
  block: GameplanBlock,
  diagnosticReason: string | null,
): GameplanBlock {
  const shouldDeload = diagnosticReason != null;
  if (!shouldDeload || !block.iron) return { ...block };

  return {
    ...block,
    iron: {
      ...block.iron,
      exercises: block.iron.exercises.map((exercise) => ({
        ...exercise,
        target_weight_kg:
          exercise.target_weight_kg != null
            ? Math.round(exercise.target_weight_kg * 0.85 * 10) / 10
            : null,
        diagnostic_reason: diagnosticReason,
      })),
    },
  };
}

export function isInjectorDeloadActive(
  telemetry: TrainingLoadSnapshot,
  biological: UserBiological,
): boolean {
  if (telemetry.is_deload_week === true) return true;
  if ((biological.clinical_exit_interview?.perceived_fatigue ?? 0) >= CLINICAL_EXTREME_FATIGUE) {
    return true;
  }
  return false;
}

function deloadDiagnosticReason(
  telemetry: TrainingLoadSnapshot,
  biological: UserBiological,
): string | null {
  if (telemetry.is_deload_week === true) {
    const source = telemetry.deload_source;
    if (source === 'phase_budget') return 'deload_phase_budget';
    if (source === 'both') return 'deload_phase_budget_and_clinical';
    return 'deload_mesocycle_week_4';
  }
  if ((biological.clinical_exit_interview?.perceived_fatigue ?? 0) >= CLINICAL_EXTREME_FATIGUE) {
    return 'deload_clinical_exit_interview';
  }
  return null;
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
  const deloadReason = deloadDiagnosticReason(telemetry, biological);
  const needsHealer = shouldInjectHealerZone(telemetry, biological);

  const cloned = microcycle.map((day) => ({
    ...day,
    blocks: day.blocks.map((block) => cloneBlockWithDeload(block, deloadReason)),
  }));

  if (!needsHealer) return cloned;

  const restDayIndexes = cloned
    .map((day, index) => (day.is_rest_day ? index : -1))
    .filter((index) => index >= 0);
  const targetIndexes = restDayIndexes.length > 0 ? restDayIndexes : [cloned.length - 1];

  return cloned.map((day, index) => {
    if (!targetIndexes.includes(index)) return day;
    return {
      ...day,
      blocks: [...day.blocks, createSpiritBlock(day)],
    };
  });
}
