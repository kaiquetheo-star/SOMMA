# SOMMA — Context Anchor V4 (Architecture Checkpoint)
**Project:** SOMMA (The Longevity OS)  
**Stack:** Expo SDK 54 · TypeScript · Expo Router · NativeWind v4 · Zustand · Supabase · OpenRouter (Edge Functions)  
**Checkpoint date:** May 2026 (post full Elite Coach sprint — all three workout pillars + Healer)  
**Spec source of truth:** `markdown.md` (SRS / SAD / FSD)  
**Prior anchors:** `CONTEXT_ANCHOR.md` (V1) · `CONTEXT_ANCHOR_V2.md` · `CONTEXT_ANCHOR_V3.md` — **use this file for new threads**

---

## 0. Executive Summary — Evolution to Elite Coach

SOMMA began as a premium Expo template with local stubs. It is now a **closed-loop Longevity OS** where deterministic coaching engines run **before** the LLM, and the UI executes prescriptions from `daily_protocols` + offline catalogs.

| Phase | Capability |
|-------|------------|
| **Foundation** | Auth (OTP + Google, web-safe Supabase storage) → 3-step Foundation Scan (pillar %, biological passport, equipment) → `FoundationGuard` on tabs |
| **Sanctuary (Home)** | Daily Command, AI/deterministic gameplans, glass ritual cards, `AttunementOrbsPanel` (Reanimated rings from local `user_stats` — not Realtime yet) |
| **Iron** | MuscleWiki-level encyclopedia (`008` + `seed_hypertrophy.sql`), Elite Hypertrophy Coach in Edge: 21d mesocycle, **RIR**, **MEV/MRV** weekly volume, **dynamic rest** from CNS, injury/CNS autoregulation, `alternative_exercise_id` instant Adapt |
| **Combat (Blood & Bone)** | `library_combat` + **tactical_focus**, `rounds_structure` narrative, `useCombatInterval` adaptive cadence + **expo-audio** immersive cues, full-screen copper/obsidian arena |
| **Flow / Spirit** | **Biomechanical Healer** (48h Iron+Combat log analysis → recovery zones), flow `asanas[]` prescriptions, **Deep Obsidian** sanctuary UI, Reanimated breath orb, half-screen gesture navigation, auto-Ascension |
| **Sync** | Offline `performanceQueue`, 3s Ascension flare, `PerformanceSyncBridge` foreground drain, `performance_logs` + optional gameplan refresh |

**Chess Master rule (unchanged):** The LLM arranges **catalog IDs only** — never invents exercise names, combo strings, asana names, or breath tempos.

**Before any new feature work:** Confirm Supabase migrations `001`–`010`, all seeds, deployed `generate_daily_protocol`, and `OPENROUTER_API_KEY`.

---

## 1. Repository Map (Operational)

```
SOMMA/
├── app/
│   ├── _layout.tsx                         # RNGH import, SplashGate, AuthProvider, PerformanceSyncBridge
│   ├── +not-found.tsx
│   ├── (auth)/
│   │   ├── index.tsx                       # OTP + Google; routes by foundationComplete
│   │   └── foundation.tsx                  # 3-step Foundation Scan
│   ├── (tabs)/
│   │   ├── _layout.tsx                     # FoundationGuard
│   │   ├── home.tsx                        # Daily Command + AttunementOrbsPanel + Recalibrate
│   │   ├── analytics.tsx                   # Biological passport + biomarker placeholders (no DB)
│   │   └── mastery.tsx                     # Placeholder constellation
│   └── (workout)/
│       ├── _layout.tsx                     # ascension: gestureEnabled false; spirit bg #0A0E0C
│       ├── iron.tsx                        # Multi-exercise queue, dynamic rest, Adapt swap
│       ├── combat.tsx                      # Full-screen arena; no WorkoutShell
│       ├── spirit.tsx                      # Deep Obsidian sanctuary; flow + breathwork modes
│       └── ascension.tsx                   # 3s flare → completeWorkout → home (always)
├── components/
│   ├── analytics/                          # BiologicalPassportSummary, BiomarkerPlaceholderGrid
│   ├── auth/, foundation/, iron/, combat/, spirit/, sanctuary/, workout/, routing/
│   ├── combat/CombatIntervalClock.tsx      # Reanimated monospaced timer (no flicker)
│   ├── spirit/SanctuaryBreathOrb.tsx       # Layered glow orb; inhale/exhale loop
│   ├── spirit/FlowGestureZones.tsx         # Left/right half-screen tap zones (RNGH)
│   └── iron/ExerciseCueCard.tsx, RestTimerOverlay.tsx, ValueStepper.tsx
├── constants/
│   ├── combat.ts                           # Arena colors, adaptive cadence ms, combo callouts
│   ├── spirit.ts                           # SPIRIT_SANCTUARY #0A0E0C, flow breath cadence
│   ├── breathwork.ts, foundation.ts, biomarkers.ts, iron-exercises.ts (fallback)
│   └── theme.ts, typography.ts, workout.ts
├── hooks/
│   ├── useWorkoutNavigation.ts             # openBlock, finishBlock → ascension params
│   ├── useActiveGameplanBlock.ts           # block lookup from currentGameplan
│   ├── useCombatInterval.ts                # Work/rest + adaptive combo caller + audio hooks
│   ├── useFlowAsanaSession.ts              # Ordered asanas, hold timers, auto-complete
│   ├── useBreathworkEngine.ts              # Phase machine for breathwork mode
│   └── useRestTimer.ts                     # Iron inter-set countdown
├── lib/
│   ├── catalog/library.ts                  # exercises v2, combat v2, flow_spirit v2 caches
│   ├── iron/resolveExercise.ts
│   ├── breathwork/tempoMap.ts
│   ├── gameplan/                           # fetchDailyGameplan, parseGameplan, generateStubGameplan
│   ├── supabase/                           # client, auth, profile, performance, session
│   └── audio/combatAudio.ts                # expo-audio: bell + 10s warning (expo-av removed)
├── providers/AuthProvider.tsx
├── store/useSommaStore.ts                    # persist: somma-offline-store
├── types/                                  # gameplan, catalog, biological, performance
├── supabase/
│   ├── migrations/ 001–010
│   ├── seed.sql, seed_hypertrophy.sql, seed_combat_tactical.sql, seed_flow_spirit_healer.sql
│   └── functions/generate_daily_protocol/index.ts  # ~2360 lines — Elite Coach + Healer
├── docs/OFFLINE_SYNC_TEST.md
├── markdown.md
├── CONTEXT_ANCHOR_V3.md
└── CONTEXT_ANCHOR_V4.md                    # This file
```

**Dependencies (workout-critical):** `react-native-reanimated` ~4.1 · `react-native-gesture-handler` ~2.28 · `expo-audio` ~1.1 · `expo-haptics` · `zustand` + persist · `@supabase/supabase-js`

**Tooling:** `npx tsc --noEmit` passes · NativeWind Quiet Luxury (`#0F1512` default; combat copper `#4A1C15`; spirit deep `#0A0E0C`)

---

## 2. Iron Pillar State (Elite Hypertrophy Coach)

### 2.1 Database — MuscleWiki-level biomechanics

**Migration:** `supabase/migrations/008_iron_biomechanics.sql`

| Column | Type | Purpose |
|--------|------|---------|
| `primary_muscle` | text | Main hypertrophy target (`quadriceps`, `hamstrings`, `upper_chest`, …) |
| `synergist_muscles` | text[] | Secondary contributors |
| `cns_fatigue_cost` | int 1–5 | CNS drain (1 = isolation, 5 = heavy axial compound) |
| `joint_stress_profile` | text | Injury tags: `high_knee_shear`, `lumbar_shear`, `rotator_cuff_heavy`, `shoulder_impingement_risk`, `spinal_axial_load`, `low_impact`, … |
| `stretch_mediated_hypertrophy` | boolean | SCHP bias — lengthened-position tension |

**Seed:** `supabase/seed_hypertrophy.sql` — **49 curated exercises** with full biomechanics (upsert on `slug`). Authoritative for hypertrophy columns.

**Legacy:** `supabase/seed.sql` — 15 iron rows without biomechanics until hypertrophy seed runs.

### 2.2 Client types & rest math

**File:** `types/catalog.ts`

- `IronExerciseBiomechanics`, `LibraryExercise`, `JointStressProfile`, `MovementPattern`
- `computeRestSecondsFromCns(cns)` — mirrors Edge: CNS 1→60s, 2→75s, 3→105s, 4→150s, 5→180s
- `HYPERTROPHY_MEV_SETS = 10`, `HYPERTROPHY_MRV_SOFT = 18`, `HYPERTROPHY_MRV_HARD = 20`

### 2.3 Edge Function — Iron expert pipeline

**File:** `supabase/functions/generate_daily_protocol/index.ts`

**Deterministic (pre-LLM):**

1. `mapLibraryExerciseRow` — `LIBRARY_EXERCISE_SELECT` includes all biomechanics columns.
2. `resolveIronRoutineIds` — yesterday protocol or push/hinge/pull defaults.
3. `detectIronAutoregulation` — stress > 7, yesterday RPE ≥ 8, injuries → `blocked_joint_profiles`.
4. `applyIronRoutineAutoregulation` — injury swaps + CNS swaps (cost ≥ 4 → alternative ≤ 2, same `primary_muscle`).
5. `buildMesocycleSummaries` — **21-day** window per `exercise_id` (load / deload / maintain from RPE + rep hit rate).
6. `buildWeeklyVolumeByMuscle` — **7-day** working sets per `primary_muscle` from `performance_logs.payload.iron.sets[]`.
7. `applyWeeklyVolumeSetCap` — approaching MRV (≥18) or at MRV (≥20) + stress → cut sets today.
8. `prescribeIronExercise` — RIR, `target_rep_range`, `rest_seconds`, `alternative_exercise_id`, `execution_technique`.
9. LLM refines within `routine_exercise_ids` only; `sanitizeBlueprint` validates.

**Mesocycle (21d):**

- RPE ≤ 8 + hit reps → load progression (~+2.5% or +1 rep).
- RPE ≥ 9 → deload (~−5%, higher RIR).
- No logs → baseline @ 2 RIR from catalog defaults.

**Weekly volume (MEV/MRV) — 7 days:**

| Band | Sets / muscle / 7d | Action |
|------|-------------------|--------|
| Below MEV | < 10 | May add volume if recovery allows |
| Optimal | 10–20 | Standard hypertrophy |
| Approaching MRV | ≥ 18 | Cut sets if stress high |
| At MRV | ≥ 20 | Must not add sets |

### 2.4 Gameplan JSON — Iron

```typescript
// types/gameplan.ts — IronExercisePrescription
{
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  target_rep_range?: string;        // "8-10 @ 2 RIR"
  target_rir?: number;
  rest_seconds?: number;            // from CNS
  alternative_exercise_id?: string | null;
  progression_note?: string;
  execution_technique?: IronExecutionTechnique;
}
```

### 2.5 Frontend — `app/(workout)/iron.tsx`

- `useActiveGameplanBlock(blockId)` → `block.iron.exercises[]`
- `fetchLibraryExercises()` — cache `somma-cache-library-exercises-v2`
- `resolveIronExerciseView()` — prescription + catalog + Adapt override map
- **Rest timer** uses `prescription.rest_seconds` via `useRestTimer` + `RestTimerOverlay`
- **Adapt** — local swap to `alternative_exercise_id` (no network)
- `ExerciseCueCard` — biomechanics strip (primary muscle, CNS, joint stress, stretch-biased badge)
- Fallback: `constants/iron-exercises.ts` when no gameplan iron payload

---

## 3. Combat Pillar State (Blood & Bone — Elite Striking Coach)

### 3.1 Database — Tactical catalog

**Migration:** `supabase/migrations/009_library_combat_tactical.sql`

| Column | Type | Values / purpose |
|--------|------|------------------|
| `tactical_focus` | text (check) | `footwork_range` · `power_inside` · `defense_counter` · `burnout` |

**Seed:** `supabase/seed_combat_tactical.sql` — **25 combos** (10 legacy updated + 15 new). Sequences include defensive cues: `Slip Left`, `Roll Right`, `Check Kick`, `Parry`, `Sprawl`, `High Guard`, etc. Upsert on `slug`.

**Base:** `supabase/seed.sql` — 10 combat rows (run `009` + tactical seed after).

### 3.2 Gameplan JSON — Combat

```typescript
// types/gameplan.ts
combat?: {
  rounds_structure: CombatRoundStructureEntry[];  // narrative arc
  rounds: CombatRoundPrescription[];
}

CombatRoundStructureEntry {
  round_start: number;      // 1-based inclusive
  round_end: number;
  tactical_focus: CombatTacticalFocus;
  coach_intent?: string;
}

CombatRoundPrescription {
  round_index: number;
  combo_id: string;         // library_combat UUID
  work_seconds: number;
  rest_seconds: number;
  tactical_focus: CombatTacticalFocus;
}
```

**UI labels:** `COMBAT_TACTICAL_FOCUS_LABELS`, `COMBAT_TACTICAL_FOCUS_DISPLAY` (e.g. `FOCUS: DEFENSE & COUNTER`).

### 3.3 Edge Function — Combat expert

- `buildTacticalRoundPlan(highFatigue)` — e.g. R1 `footwork_range`, R2–3 `power_inside`, R4 `defense_counter` (or 3-round recovery arc if high stress/RPE).
- `pickComboForRound` — filters by `tactical_focus` + `combat_mastery` complexity cap.
- `sanitizeBlueprint` — validates `rounds_structure`, per-round `tactical_focus`, combo IDs.
- **`spirit_expert`-style context:** `combat_expert.tactical_focus_catalog`, `catalog_by_tactical_focus`, `allowed_combo_ids`.

**System prompt (Expert 2):** Mandates `rounds_structure` + per-round `tactical_focus`; burnout rounds use shorter work/rest when prescribed.

### 3.4 `useCombatInterval` — Tactical round engine

**File:** `hooks/useCombatInterval.ts`

| Feature | Implementation |
|---------|----------------|
| **Phases** | `idle` → `work` ↔ `rest` → `finished` |
| **Schedule** | `CombatRoundConfig[]` from `activeBlock.combat.rounds` + `comboFromLibrary()` |
| **Deadline timing** | `phaseEndsAtMs` + 200ms tick (smooth vs 1s React-only) |
| **Adaptive combo caller** | `comboCalloutDelayMs(timeRemaining, workSeconds)` in `constants/combat.ts` |
| **Build phase** | First half of work round: new callout every **6–8s** |
| **Burnout window** | Final **30s** of work: callouts every **3–4s** (`isWorkBurnoutPhase`) |
| **Callouts** | `pickRandomComboCallout(sequence)` — random 2–4 contiguous strikes from catalog sequence |
| **Audio** | `playRoundBell()` on round start/end; `playTenSecondWarning()` at 10s left in work |
| **Haptics** | `hapticPhaseChange`, `hapticRoundEnd` |
| **Exports** | `currentRound`, `timeRemaining`, `isResting`, `isBurnoutCadence`, `comboCallout`, `endSession`, … |

### 3.5 Audio Immersive Engine

**File:** `lib/audio/combatAudio.ts` (**expo-audio**, `expo-av` removed)

- `prepareCombatAudio()` / `releaseCombatAudio()` — preloaded players, `player.release()` on unmount.
- `playRoundBell()` — round transitions.
- `playTenSecondWarning()` — double beep at 10s remaining in work round.
- `setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' })`.
- Bundled WAV in `assets/audio/combat/` (`round-bell.wav`, `ten-second-warning.wav`); regenerate via `node scripts/generateCombatCues.mjs`.

### 3.6 Frontend — `app/(workout)/combat.tsx`

- **No WorkoutShell** — full-screen `SafeAreaView`.
- **Background:** Reanimated interpolate `#0F1512` ↔ `#4A1C15` (work vs rest) — `COMBAT_ARENA`.
- **Timer:** `CombatIntervalClock` — Reanimated `TextInput` + `useFrameCallback` (monospace 88px, no flicker).
- **Center:** Uppercase combo callout (Inter); `FOCUS: …` from `COMBAT_TACTICAL_FOCUS_DISPLAY` during work.
- **Coach intent** from `rounds_structure` when present.
- **End Session & Sync** → `appendCombatSession` + `finishBlock` → Ascension (optional RPE gate / default 7).
- Catalog: `fetchLibraryCombat()` + `filterCombatByMastery` + `filterCombatByTacticalFocus` for round resolution.

---

## 4. Flow / Spirit Pillar State (Biomechanical Healer + Sanctuary)

### 4.1 Database — Yoga / mobility catalog

**Migration:** `supabase/migrations/010_library_flow_spirit_healer.sql`

| Column | Type | Purpose |
|--------|------|---------|
| `target_recovery_zones` | text[] | e.g. `lower_back`, `hips`, `glutes`, `hamstrings`, `shoulders`, `thoracic_spine`, `neck`, `ankles`, `wrists` |
| `complexity_tier` | int 1–3 | Gated by `spirit_essence` on `user_stats` |
| `is_dynamic_flow` | boolean | Breath-linked movement vs static hold |
| `default_hold_seconds` | int | Per-asana hold default |

**Seed:** `supabase/seed_flow_spirit_healer.sql` — **22 rows** (17 asana/mobility flows + 5 legacy spirit/breath sessions updated). Examples: Pigeon Pose (`hips`, `glutes`, tier 2), Child's Pose, Cat–Cow, Couch Stretch, World's Greatest Stretch, etc.

**Base:** `007_library_flow_spirit.sql` + `seed.sql` (5 flow/spirit sessions).

### 4.2 Biomechanical Healer — Edge Function

**File:** `supabase/functions/generate_daily_protocol/index.ts`

**Constants:**

- `HEALER_WINDOW_HOURS = 48`
- `SPIRIT_BEGINNER_ESSENCE_MAX = 33` → `max_complexity_tier: 1` only

**`analyzeHealerRecovery48h(logs, exerciseCatalog, spiritEssence)`:**

| Input | Logic |
|-------|--------|
| **Iron logs (48h)** | Map `exercise_id` / `payload.iron` → catalog; `isLowerBodyIronExercise()` via `primary_muscle`, `movement_pattern` (squat/hinge/lunge), slug hints (squat, deadlift, rdl, lunge, …) |
| **Lower-body heavy rule** | If true → **must** prescribe flow rows where `target_recovery_zones` overlaps `lower_back` OR `hips` |
| **Combat logs (48h)** | RPE ≥ 6 or volume ≥ 480s → add `hips`, `lower_back`, `ankles` |
| **Push/pull** | Adds `shoulders`, `thoracic_spine` |
| **Default** | If no signals → `hips` + `thoracic_spine` |

**`buildFlowBlockFromHealer()`:**

- `mode: 'flow'`, `asanas[]` (5–7 items), `recovery_focus_zones`, `prescribed_reason`
- `filterFlowCatalogForHealer()` — tier cap + strict lower-body filter when required
- Fallback morning/main blocks use Healer when `focus.flow` / spirit pillar wins

**`spirit_expert` context for LLM:**

- `healer_48h`, `allowed_flow_ids`, `flow_catalog`, `flow_catalog_by_zone`, `max_complexity_tier`, `spirit_essence`
- Breathwork still uses `SPIRIT_TEMPO_CATALOG` (`tempo_478`, `tempo_box`, `tempo_relax`) when mode is `breathwork`

### 4.3 Gameplan JSON — Spirit / Flow

```typescript
// types/gameplan.ts — SpiritBlockPrescription
{
  mode: 'flow' | 'breathwork';
  tempo_id?: string;              // breathwork only
  duration_minutes: number;
  prescribed_reason?: string;
  recovery_focus_zones?: RecoveryZone[];
  asanas?: FlowAsanaPrescription[];
}

FlowAsanaPrescription {
  asana_id: string;
  slug: string;
  name: string;
  order: number;
  hold_seconds: number;
  target_recovery_zones: RecoveryZone[];
  is_dynamic_flow: boolean;
}
```

**Parser:** `lib/gameplan/parseGameplan.ts` — `parseSpiritPrescription()` requires `asanas[]` for flow mode; derives `rounds_structure`-aligned `tactical_focus` on combat side only.

### 4.4 Frontend — Sanctuary UI

**File:** `app/(workout)/spirit.tsx`

| Requirement | Implementation |
|-------------|----------------|
| **Deep Obsidian** | `#0A0E0C` (`SPIRIT_SANCTUARY.deepObsidian`) — no header, no WorkoutShell |
| **Breath orb** | `SanctuaryBreathOrb` — layered halos, Reanimated scale/glow; loop inhale→exhale |
| **Flow breath cadence** | Static: 4s inhale / 6s exhale; dynamic asanas: 3s / 5s (`FLOW_BREATH_STATIC` / `FLOW_BREATH_DYNAMIC`) |
| **Gesture nav** | `FlowGestureZones` (RNGH) — left half = previous pose, right half = next/skip |
| **Bottom HUD** | Asana name, large hold countdown (`formatSpiritTimer`), pose index, subtle tap hint |
| **Ascension** | `useFlowAsanaSession` → on last pose timer complete → `appendSpiritSession` + `finishBlock` automatically |
| **Breathwork mode** | When `spirit.mode !== 'flow'` or no `asanas` — `useBreathworkEngine` + same orb; auto-Ascension on cycles complete |

**Hook:** `hooks/useFlowAsanaSession.ts` — `idle` | `active` | `complete`; per-pose `hold_seconds`; `goPrev` / `goNext`.

**Catalog:** `fetchLibraryFlowSpirit()` — cache `somma-cache-library-flow-spirit-v2`; `mapFlowSpiritRow` includes healer columns.

**Root:** `import 'react-native-gesture-handler'` in `app/_layout.tsx`; `GestureHandlerRootView` wraps spirit screen.

---

## 5. Cross-Cutting Architecture

### 5.1 Zustand — `store/useSommaStore.ts`

**Persist key:** `somma-offline-store`

| Slice | Purpose |
|-------|---------|
| `user_foundation`, `user_environment`, `user_biological` | Foundation Scan + passport |
| `user_stats` | `iron_essence`, `combat_mastery`, `spirit_essence`, `flow_essence` |
| `currentGameplan` / `daily_gameplan` | Today's blocks (kept in sync) |
| `performance_logs` | Local session history |
| `performanceQueue` | Pending Supabase sync |
| `gameplan_source` | `ai` \| `fallback` \| `stub` \| `deterministic` |

**Key actions:** `fetchDailyGameplanAsync`, `regenerateDailyGameplan`, `completeWorkout`, `flushPerformanceQueue`, `appendIronSession`, `appendCombatSession`, `appendSpiritSession`, `resetStore`.

### 5.2 Workout completion pipeline

```
Workout screen → append*Session (local performance_logs)
            → finishBlock(meta) → /(workout)/ascension
            → completeWorkout (queue + sync + optional new gameplan)
            → setTimeout 3s → /(tabs)/home (ALWAYS)
```

**Files:** `hooks/useWorkoutNavigation.ts`, `app/(workout)/ascension.tsx`, `lib/supabase/performance.ts`, `components/routing/PerformanceSyncBridge.tsx`.

### 5.3 Catalog client — `lib/catalog/library.ts`

| Cache key | Table | Notes |
|-----------|-------|-------|
| `somma-cache-library-exercises-v2` | `library_exercises` | Biomechanics from 008 |
| `somma-cache-library-combat-v2` | `library_combat` | `tactical_focus` from 009 |
| `somma-cache-library-flow-spirit-v2` | `library_flow_spirit` | Healer columns from 010 |

TTL: 12 hours. `resolveBlockPreviewLabel()` — iron names, combat `rounds_structure` summary, flow asana + zones.

### 5.4 Auth & routing

- `AuthProvider` — deferred profile hydrate; no async in `onAuthStateChange` handler body.
- `FoundationGuard` — tabs require completed foundation.
- Web: Supabase `localStorage` in `lib/supabase/client.ts`.

---

## 6. Database Integrity — Migrations & Seeds

### 6.1 Migration order (SQL Editor — no `#` lines)

| Order | File | Purpose |
|-------|------|---------|
| 1 | `001_initial_schema.sql` | `profiles`, `user_environment`, `user_stats`, signup trigger |
| 2 | `002_daily_protocols.sql` | `daily_protocols` + RLS |
| 3 | `003_rls_core_user_tables.sql` | Idempotent RLS on core tables |
| 4 | `004_library_catalog.sql` | `library_exercises`, `library_combat` + samples |
| 5 | `005_performance_logs.sql` | `performance_logs` + RLS |
| 6 | `006_profiles_biological_passport.sql` | Biological columns on `profiles` |
| 7 | `007_library_flow_spirit.sql` | Formal `library_flow_spirit` DDL |
| 8 | `008_iron_biomechanics.sql` | Iron biomechanics columns + indexes |
| 9 | `009_library_combat_tactical.sql` | `library_combat.tactical_focus` |
| 10 | `010_library_flow_spirit_healer.sql` | Healer columns on `library_flow_spirit` |

### 6.2 Seed order (after migrations)

| Order | File | Purpose |
|-------|------|---------|
| 1 | `seed.sql` | 15 iron + 10 combat + 5 flow/spirit (legacy) |
| 2 | `seed_hypertrophy.sql` | **49** iron exercises with full biomechanics |
| 3 | `seed_combat_tactical.sql` | **25** combat combos + defensive sequences + `tactical_focus` |
| 4 | `seed_flow_spirit_healer.sql` | **22** flow/spirit rows with recovery zones + tiers |

### 6.3 Column reference — `library_exercises`

| Column | Source |
|--------|--------|
| `id`, `slug`, `name`, `pillar`, `biomechanical_instructions`, `equipment_required`, `default_sets`, `default_reps`, `movement_pattern` | 004 |
| `primary_muscle`, `synergist_muscles`, `cns_fatigue_cost`, `joint_stress_profile`, `stretch_mediated_hypertrophy` | **008** |

### 6.4 Column reference — `library_combat`

| Column | Source |
|--------|--------|
| `slug`, `combo_name`, `sequence` (jsonb string array), `complexity_level` | 004 |
| `tactical_focus` | **009** |

### 6.5 Column reference — `library_flow_spirit`

| Column | Source |
|--------|--------|
| `slug`, `pillar` (`flow` \| `spirit`), `session_name`, `description`, `duration_minutes`, `tempo_profile`, `complexity_level` | 007 / seed |
| `target_recovery_zones`, `complexity_tier`, `is_dynamic_flow`, `default_hold_seconds` | **010** |

### 6.6 `performance_logs`

| Column | Notes |
|--------|-------|
| `pillar` | `iron` \| `combat` \| `flow` \| `spirit` |
| `payload` | jsonb — full session objects for MEV/MRV + Healer |
| `timestamp` | 7d volume, 21d mesocycle, **48h Healer** windows |

### 6.7 Edge Function deploy

```bash
supabase functions deploy generate_daily_protocol
# Secret: OPENROUTER_API_KEY
# Model: meta-llama/llama-3.3-70b-instruct, temperature 0.2, JSON mode
```

---

## 7. Gameplan Block JSON (Full Reference)

```typescript
{
  id: string;
  pillar: 'iron' | 'combat' | 'spirit';
  title: string;
  subtitle: string;
  duration_minutes: number;
  order: number;
  status: 'pending' | 'active' | 'completed';  // client-only
  iron?: { routine_id?: string; exercises: IronExercisePrescription[] };
  combat?: { rounds_structure: CombatRoundStructureEntry[]; rounds: CombatRoundPrescription[] };
  spirit?: SpiritBlockPrescription;
}
```

---

## 8. Environment & Commands

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_KEY` | Anon key |

```bash
npm start
npx tsc --noEmit
supabase functions deploy generate_daily_protocol
```

---

## 9. Known Gaps (Honest — May 2026)

| Area | Gap |
|------|-----|
| Iron | `constants/iron-exercises.ts` offline fallback only |
| Combat | Bundled WAV cues (`assets/audio/combat/`); no voice callouts |
| Spirit | `library_flow_spirit` not yet driving breathwork tempo picker (hardcoded `BREATH_TEMPOS`) |
| Spirit | Flow session logs use `tempo_id: 'flow-healer'` — no dedicated payload schema in DB |
| Mastery | `mastery.tsx` placeholder |
| Biomarkers | UI placeholders only — **no `biomarkers` table / Storage** |
| Realtime | Attunement orbs use local stats, not Supabase Realtime |
| Tests | Manual `docs/OFFLINE_SYNC_TEST.md` only (update for migrations 008–010) |
| OFFLINE_SYNC_TEST.md | Still references migrations `001`–`007` only |

---

## 10. Next Sprint Priority (Fresh Thread)

Execute in this order:

### P0 — Validation & E2E (do first)

1. **Supabase verify** — Apply migrations `001`–`010` if missing; run seeds in order (§6.2); confirm counts:
   - `library_exercises` ≥ 49 with `primary_muscle` + `cns_fatigue_cost` populated
   - `library_combat` ≥ 25 with `tactical_focus`
   - `library_flow_spirit` ≥ 22 with `target_recovery_zones` + `complexity_tier`
2. **Deploy Edge Function** — `OPENROUTER_API_KEY`; hard-refresh after deploy.
3. **Daily Gameplan E2E** — Foundation → Recalibrate → inspect `daily_protocols.blocks`:
   - Iron: `target_rep_range`, `target_rir`, `rest_seconds`, `alternative_exercise_id`
   - Combat: `rounds_structure` + per-round `tactical_focus` + valid `combo_id` UUIDs
   - Spirit **flow**: `mode: "flow"`, `asanas[]` with `hold_seconds`, `recovery_focus_zones` tied to recent Iron/Combat
4. **Pillar session E2E** — Iron (Adapt + dynamic rest) → Combat (adaptive callouts + bell) → Spirit flow (gesture nav + auto Ascension).
5. **Offline sync** — Update `docs/OFFLINE_SYNC_TEST.md` for `001`–`010`; run airplane-mode test (`docs/OFFLINE_SYNC_TEST.md`).

### P1 — Product depth

6. **Attunement Orbs++** — Animate home orbs from today's completed pillars + optional Realtime `user_stats` subscription.
7. **Biomarkers** — Migration `009_biomarkers.sql` (or next number), Storage bucket, wire `BiomarkerPlaceholderGrid` to CRUD or ingest.
8. **Spirit breathwork from DB** — Map `library_flow_spirit` spirit rows to tempo profiles instead of only `BREATH_TEMPOS` constants.
9. ~~**Combat audio** — Bundle local bell/warning assets~~ ✓ `assets/audio/combat/*.wav`

### P2 — Polish

10. **Mastery constellation** — Replace `mastery.tsx` placeholder with pillar progression UI.
11. **Performance payload v2** — Typed `payload.flow` / `payload.combat.rounds` for analytics dashboards.
12. **CONTEXT_ANCHOR hygiene** — Archive V2/V3 or add single “start here” line in README pointing to V4.

---

## 11. Quick Reference — Open First in New Thread

| Goal | Open first |
|------|------------|
| Iron coach logic | `supabase/functions/generate_daily_protocol/index.ts` (`prescribeIronExercise`, `buildWeeklyVolumeByMuscle`) |
| Iron UI | `app/(workout)/iron.tsx`, `lib/iron/resolveExercise.ts` |
| Combat timer + cadence | `hooks/useCombatInterval.ts`, `constants/combat.ts`, `app/(workout)/combat.tsx` |
| Combat audio | `lib/audio/combatAudio.ts` |
| Healer / flow prescriptions | `analyzeHealerRecovery48h`, `buildFlowBlockFromHealer` in Edge Function |
| Spirit sanctuary UI | `app/(workout)/spirit.tsx`, `hooks/useFlowAsanaSession.ts`, `components/spirit/SanctuaryBreathOrb.tsx` |
| Gameplan types/parse | `types/gameplan.ts`, `lib/gameplan/parseGameplan.ts` |
| Store / sync | `store/useSommaStore.ts`, `lib/supabase/performance.ts` |
| DB | `supabase/migrations/`, seeds in §6.2 |
| Product spec | `markdown.md` |

---

*V4 reflects the codebase after the full Elite Coach sprint: Iron biomechanics + MEV/MRV, Combat tactical rounds + adaptive cadence + expo-audio, Flow/Spirit Biomechanical Healer + Deep Obsidian sanctuary. Verify live Supabase before building new features.*
