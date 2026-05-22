export type BreathPhaseKind = 'inhale' | 'hold' | 'exhale' | 'hold_empty';

export interface BreathTempo {
  id: string;
  name: string;
  subtitle: string;
  inhale: number;
  hold: number;
  exhale: number;
  holdEmpty: number;
  defaultCycles: number;
}

export const BREATH_TEMPOS: BreathTempo[] = [
  {
    id: '4-7-8',
    name: '4 · 7 · 8',
    subtitle: 'Downregulation · vagal tone',
    inhale: 4,
    hold: 7,
    exhale: 8,
    holdEmpty: 0,
    defaultCycles: 4,
  },
  {
    id: 'box',
    name: 'Box',
    subtitle: '4 · 4 · 4 · 4 · equanimity',
    inhale: 4,
    hold: 4,
    exhale: 4,
    holdEmpty: 4,
    defaultCycles: 6,
  },
  {
    id: 'relax',
    name: 'Relax',
    subtitle: '4 · 0 · 6 · gentle exhale',
    inhale: 4,
    hold: 0,
    exhale: 6,
    holdEmpty: 0,
    defaultCycles: 5,
  },
  {
    id: 'nsdr',
    name: 'NSDR',
    subtitle: '4 · 2 · 8 · nervous system',
    inhale: 4,
    hold: 2,
    exhale: 8,
    holdEmpty: 0,
    defaultCycles: 4,
  },
];

export const BREATH_PHASE_LABELS: Record<BreathPhaseKind, string> = {
  inhale: 'Inhale',
  hold: 'Retain',
  exhale: 'Exhale',
  hold_empty: 'Suspend',
};

export function getPhaseDuration(tempo: BreathTempo, phase: BreathPhaseKind): number {
  switch (phase) {
    case 'inhale':
      return tempo.inhale;
    case 'hold':
      return tempo.hold;
    case 'exhale':
      return tempo.exhale;
    case 'hold_empty':
      return tempo.holdEmpty;
    default:
      return 0;
  }
}

export function getNextPhase(
  tempo: BreathTempo,
  current: BreathPhaseKind,
): BreathPhaseKind | 'cycle_complete' {
  if (current === 'inhale') {
    return tempo.hold > 0 ? 'hold' : 'exhale';
  }
  if (current === 'hold') {
    return 'exhale';
  }
  if (current === 'exhale') {
    return tempo.holdEmpty > 0 ? 'hold_empty' : 'cycle_complete';
  }
  return 'cycle_complete';
}

export function cycleDurationSeconds(tempo: BreathTempo): number {
  return tempo.inhale + tempo.hold + tempo.exhale + tempo.holdEmpty;
}
