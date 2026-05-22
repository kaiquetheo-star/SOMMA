# Combat audio cues

Bundled WAV files for offline Blood & Bone sessions:

| File | Use |
|------|-----|
| `round-bell.wav` | Round start / end |
| `ten-second-warning.wav` | 10s work-round warning (double beep) |

Regenerate tones (no network):

```bash
node scripts/generateCombatCues.mjs
```

Wired in `lib/audio/combatAudio.ts` via `lib/audio/combatAudioAssets.ts`.
