import type { BreathTempo } from '@/constants/breathwork';
import { BREATH_TEMPOS } from '@/constants/breathwork';
import { EDGE_TEMPO_TO_SLUG } from '@/lib/breathwork/fromCatalog';

/** Map Edge Function tempo_id values to offline fallback constant ids */
const TEMPO_ID_MAP: Record<string, string> = {
  tempo_478: '4-7-8',
  tempo_box: 'box',
  tempo_relax: 'relax',
  tempo_nsdr: 'nsdr',
  recovery_478: '4-7-8',
  tempo_box_breathwork: 'box',
  relaxing_exhale: 'relax',
  nsdr_body_scan: 'nsdr',
  '4-7-8': '4-7-8',
  box: 'box',
  relax: 'relax',
  nsdr: 'nsdr',
};

export function resolveBreathTempoId(tempoId: string | undefined): string {
  if (!tempoId) return '4-7-8';
  const slug = EDGE_TEMPO_TO_SLUG[tempoId];
  if (slug) return slug;
  return TEMPO_ID_MAP[tempoId] ?? tempoId.replace(/^tempo_/, '');
}

/** Offline fallback when catalog has not loaded */
export function resolveBreathTempo(tempoId: string | undefined): BreathTempo {
  const localId = resolveBreathTempoId(tempoId);
  return (
    BREATH_TEMPOS.find((item) => item.id === localId) ??
    BREATH_TEMPOS.find((item) => item.id === TEMPO_ID_MAP[tempoId ?? '']) ??
    BREATH_TEMPOS[0]
  );
}

/** Estimate cycles to fill prescribed duration */
export function cyclesForDuration(tempo: BreathTempo, durationMinutes: number): number {
  const cycleSec =
    tempo.inhale + tempo.hold + tempo.exhale + tempo.holdEmpty;
  if (cycleSec <= 0) return tempo.defaultCycles;
  const target = Math.max(1, Math.round((durationMinutes * 60) / cycleSec));
  return Math.max(tempo.defaultCycles, target);
}
