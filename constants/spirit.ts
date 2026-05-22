/** Flow / Spirit sanctuary — Deep Obsidian (95% black-green) */
export const SPIRIT_SANCTUARY = {
  deepObsidian: '#0A0E0C',
  textPrimary: 'rgba(232, 228, 220, 0.88)',
  textMuted: 'rgba(107, 117, 104, 0.9)',
  orbCore: 'rgba(191, 160, 106, 0.12)',
  orbGlow: 'rgba(74, 93, 68, 0.22)',
  orbHalo: 'rgba(74, 93, 68, 0.08)',
} as const;

/** Default breath cadence while holding a static asana */
export const FLOW_BREATH_STATIC = {
  inhaleSeconds: 4,
  exhaleSeconds: 6,
} as const;

/** Slightly quicker breath for dynamic mobility flows */
export const FLOW_BREATH_DYNAMIC = {
  inhaleSeconds: 3,
  exhaleSeconds: 5,
} as const;

export function formatSpiritTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m <= 0) return `0:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
