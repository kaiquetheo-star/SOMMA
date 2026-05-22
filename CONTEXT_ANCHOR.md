# SOMMA — Context Anchor (Checkpoint)
**Project:** SOMMA (The Longevity OS)  
**Stack:** Expo SDK 54 · TypeScript · Expo Router · NativeWind v4 · Zustand · Supabase  
**Checkpoint date:** May 2026  
**Spec source of truth:** `markdown.md` (SRS / SAD / FSD)

---

## 1. What Has Been Done (Current State)

### 1.1 Repository layout (operational)

```
SOMMA/
├── app/                          # Expo Router (file-based)
│   ├── _layout.tsx               # Root: fonts, AuthProvider, nav groups
│   ├── (auth)/                   # Onboarding & auth flow
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Welcome + Supabase auth tiles
│   │   └── foundation.tsx        # Foundation Scan (2-step)
│   ├── (tabs)/                   # Main sanctuary tabs
│   │   ├── _layout.tsx           # Bottom tabs: home, mastery, analytics
│   │   ├── home.tsx              # Daily Command + gameplan cards
│   │   ├── mastery.tsx           # PLACEHOLDER only
│   │   └── analytics.tsx         # Session controls (sign out / reset)
│   └── (workout)/                # Workout execution stack
│       ├── _layout.tsx
│       ├── iron.tsx              # Rep/weight logging + rest timer
│       ├── combat.tsx            # Interval engine + RPE
│       ├── spirit.tsx            # Breathwork tempos + orb visualizer
│       └── ascension.tsx         # 3s completion flare → home
├── components/
│   ├── auth/                     # AuthGlassTile, EmailAuthPanel
│   ├── foundation/               # SelectionTile, FoundationProgress
│   ├── sanctuary/                # AttunementOrbs, GameplanBlockCard
│   ├── iron/                     # ValueStepper, RestTimerOverlay
│   ├── combat/                   # ComboDisplay, RpeSelector
│   ├── spirit/                   # BreathOrbVisualizer, TempoSelector, BreathPhaseHud
│   └── workout/                  # WorkoutShell (shared layout)
├── constants/                    # theme, typography, foundation, workout, iron-exercises, combat, breathwork
├── hooks/                        # useRestTimer, useCombatInterval, useBreathworkEngine, useWorkoutNavigation
├── lib/
│   ├── config.ts                 # Supabase env detection (ANON_KEY or KEY alias)
│   ├── haptics.ts
│   ├── audio/workoutCues.ts      # expo-av phase cues (network URL)
│   ├── gameplan/                 # stub generator, AI fetch, parser
│   └── supabase/                 # client, auth, session, profile sync
├── providers/AuthProvider.tsx    # Session, deep links, remote hydrate
├── store/useSommaStore.ts        # Zustand + AsyncStorage persist
├── types/                        # gameplan.ts, performance.ts
├── supabase/
│   ├── migrations/001_initial_schema.sql
│   ├── migrations/002_daily_protocols.sql
│   └── functions/generate_daily_protocol/index.ts
├── global.css                    # NativeWind Tailwind directives
├── tailwind.config.js            # darkMode: 'class', Obsidian tokens
├── babel.config.js               # NativeWind + unstable_transformImportMeta
├── metro.config.js               # NativeWind + resolver conditions
├── nativewind-env.d.ts
├── .env.example
└── markdown.md                   # Original SRS / SAD / FSD
```

### 1.2 Configuration (fully wired)

| Area | Status | Notes |
|------|--------|-------|
| **Expo + TypeScript** | ✅ | `expo-router/entry`, strict TS, `npx tsc --noEmit` passes |
| **Expo Router** | ✅ | Groups: `(auth)`, `(tabs)`, `(workout)`; typed routes |
| **NativeWind v4** | ✅ | `global.css`, preset, `className` on screens |
| **Tailwind** | ✅ | `darkMode: 'class'`, custom colors (obsidian, matte-gold, etc.) |
| **Fonts** | ✅ | Playfair Display + Inter via `@expo-google-fonts/*` in root layout |
| **Reanimated** | ✅ | Ascension flare, breath orb animations |
| **Zustand persist** | ✅ | AsyncStorage key `somma-offline-store` |
| **import.meta fix** | ✅ | `unstable_transformImportMeta` (Zustand web bundle) |
| **Supabase client** | ✅ | SecureStore session adapter, optional if `.env` missing |
| **Env vars** | ✅ | `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` **or** `EXPO_PUBLIC_SUPABASE_KEY` |

### 1.3 UI screens — functional vs placeholder

| Route | Screen | Status |
|-------|--------|--------|
| `/(auth)/index` | Welcome & Auth | **Functional** — Email OTP + Google OAuth; offline fallback if no env |
| `/(auth)/foundation` | Foundation Scan | **Functional** — Pillar focus + equipment; syncs Supabase; triggers AI gameplan fetch |
| `/(tabs)/home` | Daily Command | **Functional** — Attunement orbs, gameplan cards, navigation to workouts, Recalibrate |
| `/(tabs)/mastery` | Unified Constellation | **Placeholder** — static text only |
| `/(tabs)/analytics` | Biological Passport | **Partial** — sign out + reset local state only |
| `/(workout)/iron` | Iron Mode | **Functional (MVP)** — steppers, set log, auto rest timer, Adapt swap (local library) |
| `/(workout)/combat` | Blood & Bone | **Functional (MVP)** — work/rest intervals, combo rotation, RPE, haptics + remote audio |
| `/(workout)/spirit` | Spirit & Flow | **Functional (MVP)** — 4 tempo presets, phase engine, Reanimated orb |
| `/(workout)/ascension` | Ascension Flare | **Partial** — 3s animation + route home; no background Supabase sync |

### 1.4 State management (`store/useSommaStore.ts`)

**Persisted slices:**
- `user_environment` — equipment tags
- `user_foundation` — `focus_preference`, `foundation_completed_at`
- `user_stats` — essence scores (seeded from focus %, not live RPG logic)
- `daily_gameplan` — blocks with `pending | active | completed`
- `performance_logs` — iron / combat / spirit session logs (local only)

**Actions implemented:**
- Foundation: `completeFoundationScan`, `hasCompletedFoundationScan()`
- Gameplan: `ensureDailyGameplan`, `fetchDailyGameplanAsync`, `regenerateDailyGameplan`, `setBlockStatus`, `completeBlock`
- Workout logs: `appendIronSession`, `appendCombatSession`, `appendSpiritSession`
- `resetSommaState` (dev/testing)

### 1.5 Supabase integration (client-side code present)

| Feature | Code | Deployed? |
|---------|------|-----------|
| Auth (email OTP, Google) | `lib/supabase/auth.ts` | Requires Dashboard redirect `somma://auth/callback` |
| Session + deep links | `providers/AuthProvider.tsx`, `lib/supabase/session.ts` | Client-ready |
| Profile / environment / stats upsert | `lib/supabase/profile.ts` | Needs migration `001` applied |
| Foundation sync on scan complete | `foundation.tsx` | Client-ready |
| Remote hydrate on login | `AuthProvider` | Client-ready |
| Daily AI protocol | `fetchDailyGameplan.ts` → Edge Function | Needs migration `002` + function deploy + `OPENROUTER_API_KEY` secret |
| Edge Function source | `supabase/functions/generate_daily_protocol/` | **Not auto-deployed** — manual `supabase functions deploy` |

### 1.6 Workout engines (MVP level)

| Pillar | Engine | Implemented |
|--------|--------|-------------|
| **Iron** | Rep/weight steppers, 4-set flow, rest overlay w/ haptics, Adapt (local `iron-exercises.ts`) | ✅ MVP |
| **Combat** | 3×3min work / 1min rest, combo display, pause/resume, post-session RPE 1–10 | ✅ MVP |
| **Spirit** | 4-7-8, Box, Relax, NSDR tempos; inhale/hold/exhale/hold_empty phases; orb scale sync | ✅ MVP |
| **Ascension** | Radial Reanimated flare, non-interactive timer, return to home | ✅ Partial |

### 1.7 Gameplan system

1. **Stub generator** — `lib/gameplan/generateStubGameplan.ts` (deterministic from focus + equipment)
2. **AI path** — `lib/gameplan/fetchDailyGameplan.ts` → Supabase `daily_protocols` table or `generate_daily_protocol` Edge Function (Llama 3.3 via OpenRouter)
3. **UI** — `GameplanBlockCard` → `useWorkoutNavigation` → workout routes with `blockId` + `title` params

---

## 2. Current Implementation Gaps (Partial / Placeholder)

### 2.1 Frontend gaps in built areas

| Gap | Location | Detail |
|-----|----------|--------|
| **Offline-first auth path** | `(auth)/index` | "Begin Awakening" still shown when Supabase env missing; correct by design but can confuse if `.env` key names wrong |
| **Env variable naming** | `.env` vs `lib/config.ts` | User may have `EXPO_PUBLIC_SUPABASE_KEY` only — now aliased; must restart Metro after `.env` changes |
| **Google OAuth** | Auth | Requires Supabase provider + redirect URL configured; untested in repo |
| **AI gameplan source label** | `home.tsx` | Shows AI/fallback/stub label but no error toast if Edge Function fails silently |
| **Recalibrate** | `home.tsx` | Forces Edge invoke; falls back to stub without user-visible error |
| **Iron AI weights** | `iron.tsx` | Static template weights (`72.5 kg` etc.), not historical / AI progressive overload |
| **Iron RPE** | — | Not collected (SRS REQ-4.1) |
| **Iron Adapt** | `iron.tsx` | Local library swap only; not AI / equipment-aware query |
| **Combat audio** | `workoutCues.ts` | Remote Google sound URL; fails offline; `expo-av` deprecated in SDK 54 |
| **Combat combos** | `constants/combat.ts` | Fixed rotation, not from `library_combat` DB |
| **Spirit Flow / Yoga** | `spirit.tsx` | Breathwork only; no asana video/animation (FSD §3.3) |
| **Attunement Orbs** | `AttunementOrbs.tsx` | Visual only from local `user_stats`; no Realtime / streak logic |
| **user_stats seeding** | `completeFoundationScan` | Sets stats = focus percentages, not progression |
| **performance_logs** | Zustand only | Never synced to Supabase `performance_logs` table (table not migrated) |
| **Ascension sync** | `ascension.tsx` | No `performance_logs` upload, no `generate_next_protocol` webhook (SAD) |
| **Mastery tab** | `mastery.tsx` | Placeholder |
| **Analytics tab** | `analytics.tsx` | No charts, biomarkers, or exam upload |
| **Legacy Expo template files** | `components/Themed.tsx`, `EditScreenInfo.tsx`, `constants/Colors.ts` | Unused boilerplate remains |

### 2.2 Supabase / backend gaps

| Gap | Detail |
|-----|--------|
| **Migrations not in repo CI** | SQL files exist; apply manually in Supabase SQL Editor |
| **No `supabase/config.toml`** | Local CLI project config absent |
| **Edge Function deploy** | Source written; requires `supabase link`, secrets, deploy |
| **Missing SAD tables** | No migrations for: `user_rituals`, `performance_logs`, `biomarkers`, `user_exams`, `library_exercises`, `library_combat`, `user_achievements` |
| **SAD function name** | Spec says `generate_next_protocol`; implemented as `generate_daily_protocol` |
| **No DB webhook** | Post-workout AI recalibration loop not wired |
| **No Storage** | Exam / posture photo uploads not implemented |
| **No Realtime** | `user_stats` subscriptions for Attunement Orbs not implemented |
| **Apple Sign-In** | Not implemented |

### 2.3 Known runtime / tooling notes

- **Web vs native:** `import.meta` fix applied for Zustand; prefer Expo Go / dev build for auth deep links.
- **Package version drift:** `devDependencies` lists `babel-preset-expo@^55` while `dependencies` has `~54.0.10` — run `npx expo install --fix` if bundler issues return.
- **`.env` not committed** (correct); user must copy `.env.example`.

---

## 3. What Is Missing (Next Steps vs SRS / SAD / FSD)

### 3.1 Priority A — Infrastructure & data loop

1. Apply Supabase migrations `001` + `002` in production project.
2. Deploy Edge Function `generate_daily_protocol` + set `OPENROUTER_API_KEY` secret.
3. Configure Auth: Email + Google, redirect `somma://auth/callback`.
4. Add migration for `performance_logs` + client sync on Ascension complete.
5. Implement `generate_next_protocol` (or rename) triggered after workout completion (webhook or client invoke).
6. Sync `performance_logs` from Zustand → Supabase; hydrate history on login.

### 3.2 Priority B — Sanctuary (tabs)

| REQ / FSD | Missing work |
|-----------|----------------|
| REQ-2.1 Daily Command AI blocks | Edge Function live + block content tied to real exercise/combo IDs |
| REQ-2.2 Attunement Orbs | Streaks, Realtime `user_stats`, animated glow from real data |
| REQ-2.3 Recalibrate environment | UI on home to update equipment + re-invoke Edge Function (partial: Recalibrate regenerates only) |
| Unified Constellation | Gesture Handler pan/pinch star map, achievements, copper/gold nodes |
| Biological Passport | react-native-svg charts, biomarker tiles, camera/gallery → Supabase Storage |

### 3.3 Priority C — Workout engines (full spec)

| Mode | Missing |
|------|---------|
| **Iron** | AI-suggested weights from history, auto rest from AI, RPE input, full `performance_logs` fields (`weight_used`, `rpe_score`, `actual_rest_seconds`) |
| **Combat** | Local `library_combat` combos, reliable offline audio (expo-audio migration), round config from AI gameplan |
| **Spirit/Flow** | Yoga asana loop + progress bar; separate Flow route or mode flag |
| **Ascension** | 3s non-interruptible lock (partial), background sync, AI recalibration trigger |

### 3.4 Priority D — Database & encyclopedia (SAD §4)

Tables / seeds not created:
- `user_rituals` (streaks)
- `library_exercises`, `library_combat` (read-only AI context + Adapt fallback)
- `biomarkers`, `user_exams`
- `user_achievements` (constellation nodes)

### 3.5 Priority E — Polish & non-functional requirements

- **Quiet Luxury polish:** consistent glassmorphism, no template leftovers, Playfair on all hero titles.
- **REQ-PERF-1/2:** Workout timer state isolated to avoid full-screen re-renders (partially addressed).
- **Offline-first:** Queue failed Supabase syncs for retry on reconnect.
- **Security:** RLS policies exist for core tables only; extend for new tables.
- **Testing:** Only legacy `StyledText-test.js`; no workout/store tests.
- **EAS / production:** No `eas.json`, app store config, or CI pipeline.

---

## 4. Quick Reference — Key Files for Next Session

| Task | Start here |
|------|------------|
| Fix auth / env | `lib/config.ts`, `.env`, `(auth)/index.tsx` |
| AI gameplans | `lib/gameplan/fetchDailyGameplan.ts`, `supabase/functions/generate_daily_protocol/` |
| Daily Command UI | `app/(tabs)/home.tsx`, `store/useSommaStore.ts` |
| Iron workout | `app/(workout)/iron.tsx`, `constants/iron-exercises.ts` |
| Combat workout | `app/(workout)/combat.tsx`, `hooks/useCombatInterval.ts` |
| Spirit breathwork | `app/(workout)/spirit.tsx`, `hooks/useBreathworkEngine.ts` |
| Post-workout sync | `app/(workout)/ascension.tsx`, new `lib/supabase/performance.ts` |
| Constellation | `app/(tabs)/mastery.tsx` (greenfield) |
| Spec | `markdown.md` |

---

## 5. Suggested Next Sprint Order

1. **Stabilize Supabase** — migrations applied, Edge Function deployed, auth flow verified on device.
2. **Close the data loop** — `performance_logs` migration + Ascension upload + post-workout AI protocol refresh.
3. **Sanctuary depth** — real Attunement Orbs + Recalibrate environment UI.
4. **Mastery + Analytics** — constellation map + biomarker passport.
5. **Iron/Combat polish** — AI weights, local library DB, offline audio, Flow/yoga mode.

---

*This document reflects the codebase as scanned in-repo. Verify deployed Supabase state separately (migrations applied, secrets set, function live).*
