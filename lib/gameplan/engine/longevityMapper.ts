import type { LongevityBlockPrescription } from '@/types/gameplan';

const DEFAULT_ADDON: Omit<LongevityBlockPrescription, 'pillar' | 'title' | 'duration_minutes'> = {
  mobility_focus: 'Mobilidade Global e Respiração',
  mobility_cues: [
    'Respiração nasal em decúbito (2 min)',
    'Mobilidade articular leve de coluna e quadril',
  ],
  core_exercise: 'Deadbug com respiração diafragmática (3x 8/side)',
  cardio_prescription: '10 min Caminhada leve em Zona 2',
};

function addon(
  prescription: Omit<LongevityBlockPrescription, 'pillar' | 'title' | 'duration_minutes'>,
): LongevityBlockPrescription {
  return {
    pillar: 'longevity',
    title: 'Manutenção Biológica',
    duration_minutes: 12,
    ...prescription,
  };
}

export function generateLongevityAddon(
  dayIndex: number,
  ironFocusLabel: string,
): LongevityBlockPrescription {
  const focus = ironFocusLabel.toLowerCase();

  if (focus.includes('push')) {
    return addon({
      mobility_focus: 'Mobilidade Torácica e Descompressão de Ombro',
      mobility_cues: [
        'Rotação torácica deitado de lado (8/side)',
        'Alongamento de peitoral no batente da porta (30s)',
      ],
      core_exercise: 'Deadbug com respiração diafragmática (3x 8/side)',
      cardio_prescription: '10 min Esteira Inclinada (Zona 2, conversa possível)',
    });
  }

  if (focus.includes('pull')) {
    return addon({
      mobility_focus: 'Descompressão de Latíssimos e Trapézio',
      mobility_cues: ['Dead Hang na barra (3x 30s)', 'Rotação externa de ombro com elástico'],
      core_exercise: 'Bird-Dog com pausa isométrica (3x 8/side)',
      cardio_prescription: '10 min Bicicleta Ergométrica leve (cadência 80-90 RPM)',
    });
  }

  if (focus.includes('legs')) {
    return addon({
      mobility_focus: 'Mobilidade de Quadril e Tornozelo',
      mobility_cues: ['90/90 Hip Switch (10/side)', 'Dorsiflexão de tornozelo ajoelhado na parede'],
      core_exercise: 'Pallof Press isométrico (ou Prancha com foco em glúteo)',
      cardio_prescription: '10 min Caminhada leve no plano (flush metabólico)',
    });
  }

  return addon({
    ...DEFAULT_ADDON,
    mobility_cues: [...DEFAULT_ADDON.mobility_cues, `Fallback determinístico do dia ${dayIndex}`],
  });
}
