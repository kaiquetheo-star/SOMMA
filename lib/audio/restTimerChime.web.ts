let audioContext: AudioContext | null = null;

function getOrCreateContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new Ctx();
  }
  return audioContext;
}

/** Call on user gesture (e.g. Start Rest) to satisfy mobile autoplay policy */
export function unlockRestTimerAudio(): void {
  const ctx = getOrCreateContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
}

function playTone(frequencyHz: number, durationMs: number, gainPeak = 0.12): void {
  const ctx = getOrCreateContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequencyHz;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(gainPeak, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + durationMs / 1000 + 0.05);
}

/** Short athletic chime at 10s remaining on rest timer */
export function playRestTenSecondChime(): void {
  const ctx = getOrCreateContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().then(() => {
      playTone(880, 120, 0.1);
      window.setTimeout(() => playTone(1174.66, 140, 0.08), 90);
    });
    return;
  }
  playTone(880, 120, 0.1);
  window.setTimeout(() => playTone(1174.66, 140, 0.08), 90);
}
