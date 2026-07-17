/**
 * Dev-only motor telemetry — never fires in production builds.
 */
import type { DeloadSource } from '@/lib/gameplan/engine/iron/volumePeriodization';
import type { AdaptationLogEntry } from '@/lib/gameplan/engine/adaptiveStateMachine';
import type { IronDayBlock } from '@/lib/gameplan/engine/iron/generateIronMicrocycle';
import type { MicrocycleDay } from '@/types/gameplan';

const isMotorTelemetryEnabled =
  (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.NODE_ENV !== 'production';

export interface MotorTelemetrySnapshot {
  deload_source: DeloadSource | 'none';
  mvp_fallbacks_triggered: boolean;
  mvp_fallback_count: number;
  coherence_failures: number;
}

export interface MotorTelemetryInput {
  deloadSource?: DeloadSource | null;
  microcycle?: readonly MicrocycleDay[];
  ironDayBlocks?: readonly IronDayBlock[];
  adaptationLogs?: readonly AdaptationLogEntry[];
}

function collectMvpFallbackCount(
  microcycle: readonly MicrocycleDay[] | undefined,
  ironDayBlocks: readonly IronDayBlock[] | undefined,
): number {
  let count = 0;
  if (ironDayBlocks) {
    for (const block of ironDayBlocks) {
      for (const pick of block.picks) {
        const reason = pick.diagnostic_reason ?? '';
        if (
          reason.includes('minimum_viable') ||
          reason.includes('volume_floor_fallback') ||
          reason.includes('partial_rescue')
        ) {
          count += 1;
        }
      }
    }
  }
  if (microcycle) {
    for (const day of microcycle) {
      for (const block of day.blocks ?? []) {
        if (block.pillar !== 'iron' || !block.iron) continue;
        for (const exercise of block.iron.exercises ?? []) {
          const reason = exercise.diagnostic_reason ?? '';
          if (
            reason.includes('minimum_viable') ||
            reason.includes('volume_floor_fallback') ||
            reason.includes('partial_rescue')
          ) {
            count += 1;
          }
        }
      }
    }
  }
  return count;
}

function collectCoherenceFailures(ironDayBlocks: readonly IronDayBlock[] | undefined): number {
  if (!ironDayBlocks) return 0;
  return ironDayBlocks.filter((block) => block.coherenceValidated === false).length;
}

export function collectMotorTelemetry(input: MotorTelemetryInput): MotorTelemetrySnapshot {
  const mvp_fallback_count = collectMvpFallbackCount(input.microcycle, input.ironDayBlocks);

  return {
    deload_source: input.deloadSource ?? 'none',
    mvp_fallbacks_triggered: mvp_fallback_count > 0,
    mvp_fallback_count,
    coherence_failures: collectCoherenceFailures(input.ironDayBlocks),
  };
}

/** Elegant console summary — no-op outside __DEV__. */
export function logMotorTelemetry(snapshot: MotorTelemetrySnapshot): void {
  if (!isMotorTelemetryEnabled) return;

  const deload = snapshot.deload_source === null ? 'none' : snapshot.deload_source;
  const mvp = snapshot.mvp_fallbacks_triggered
    ? `true (${snapshot.mvp_fallback_count})`
    : 'false';
  const coherence =
    snapshot.coherence_failures > 0 ? ` | Coherence fails: ${snapshot.coherence_failures}` : '';

  // eslint-disable-next-line no-console
  console.log(
    `[SOMMA MOTOR] 🧠 Prescrição gerada | Deload: ${deload} | MVP: ${mvp}${coherence}`,
  );
}

export function emitMotorTelemetry(input: MotorTelemetryInput): MotorTelemetrySnapshot {
  const snapshot = collectMotorTelemetry(input);
  logMotorTelemetry(snapshot);
  return snapshot;
}
