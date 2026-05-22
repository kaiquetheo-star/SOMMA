/**
 * Generates short combat cue WAV files (no network).
 * Run: node scripts/generateCombatCues.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'assets', 'audio', 'combat');

function writeWav(filePath, { freqs, durationMs, sampleRate = 44100, gain = 0.55 }) {
  const samples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const attack = Math.min(1, i / (sampleRate * 0.008));
    const release = Math.exp(-t * 4.5);
    const env = attack * release;
    let sample = 0;
    for (const freq of freqs) {
      sample += Math.sin(2 * Math.PI * freq * t);
    }
    sample = (sample / freqs.length) * env * gain;
    const clamped = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.floor(clamped * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

fs.mkdirSync(outDir, { recursive: true });

writeWav(path.join(outDir, 'round-bell.wav'), {
  freqs: [523.25, 659.25, 783.99],
  durationMs: 720,
  gain: 0.5,
});

writeWav(path.join(outDir, 'ten-second-warning.wav'), {
  freqs: [1046.5],
  durationMs: 110,
  gain: 0.42,
});

console.log('Wrote combat cues to', outDir);
