const PHASE_KEYS = ['setup', 'eccentric', 'concentric', 'safety', 'regression'] as const;

export type InstructionPhaseKey = (typeof PHASE_KEYS)[number];

export const INSTRUCTION_PHASE_LABELS: Record<InstructionPhaseKey, string> = {
  setup: 'Setup',
  eccentric: 'Eccentric',
  concentric: 'Concentric',
  safety: 'Safety',
  regression: 'Regression',
};

function pickString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function firstMergedStep(record: Record<string, unknown>): string | null {
  const merged = record.merged_steps;
  if (!Array.isArray(merged)) return null;
  for (const step of merged) {
    if (typeof step === 'string' && step.trim()) return step.trim();
  }
  return null;
}

/** Primary always-visible cue — prefers `setup`, then catalog fallbacks. */
export function resolvePrimaryInstruction(
  instructions: Record<string, unknown> | null | undefined,
): { key: string; label: string; text: string } | null {
  if (!instructions) return null;

  const setup = pickString(instructions, 'setup');
  if (setup) {
    return { key: 'setup', label: INSTRUCTION_PHASE_LABELS.setup, text: setup };
  }

  const summary = pickString(instructions, 'summary');
  if (summary) {
    return { key: 'summary', label: 'Coach cue', text: summary };
  }

  const cues = pickString(instructions, 'cues');
  if (cues) {
    return { key: 'cues', label: 'Cues', text: cues };
  }

  const mergedFirst = firstMergedStep(instructions);
  if (mergedFirst) {
    return { key: 'merged_steps', label: INSTRUCTION_PHASE_LABELS.setup, text: mergedFirst };
  }

  for (const phaseKey of PHASE_KEYS) {
    if (phaseKey === 'setup') continue;
    const text = pickString(instructions, phaseKey);
    if (text) {
      return {
        key: phaseKey,
        label: INSTRUCTION_PHASE_LABELS[phaseKey],
        text,
      };
    }
  }

  for (const [key, value] of Object.entries(instructions)) {
    if (key === 'sources' || key === 'merged_steps') continue;
    const text = typeof value === 'string' ? value.trim() : '';
    if (text) {
      return { key, label: key.replace(/_/g, ' '), text };
    }
  }

  return null;
}

export function resolvePhaseInstruction(
  instructions: Record<string, unknown> | null | undefined,
  phase: InstructionPhaseKey,
): string | null {
  if (!instructions) return null;
  return pickString(instructions, phase);
}

export function instructionKeysForDeepDive(
  instructions: Record<string, unknown>,
  excludeKeys: string[] = [],
): string[] {
  const excluded = new Set(excludeKeys);
  return [
    ...PHASE_KEYS.filter((key) => !excluded.has(key) && pickString(instructions, key)),
    ...Object.keys(instructions).filter((key) => {
      if (excluded.has(key)) return false;
      if (PHASE_KEYS.includes(key as InstructionPhaseKey)) return false;
      if (key === 'sources' || key === 'merged_steps') return false;
      return Boolean(pickString(instructions, key));
    }),
  ];
}
