/** Bundled combat cues — offline-safe for gym airplane mode */
export const COMBAT_AUDIO_ASSETS = {
  roundBell: require('../../assets/audio/combat/round-bell.wav'),
  tenSecondWarning: require('../../assets/audio/combat/ten-second-warning.wav'),
} as const;

export type CombatCueKey = keyof typeof COMBAT_AUDIO_ASSETS;
