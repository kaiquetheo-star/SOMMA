# SOMMA — Context Anchor V3 (Architecture Checkpoint)
**Project:** SOMMA (The Longevity OS)  
**Stack:** Expo SDK 54 · TypeScript · Expo Router · NativeWind v4 · Zustand · Supabase · OpenRouter (Edge Functions)  
**Checkpoint date:** May 2026 (post architectural sprint — Elite Coach system)  
**Spec source of truth:** `markdown.md` (SRS / SAD / FSD)  
**Prior anchors:** `CONTEXT_ANCHOR.md` (V1) · `CONTEXT_ANCHOR_V2.md` (Day 1–2) — **use this file for new threads**

---

## 0. Executive Summary — Evolution to Elite Coach

SOMMA began as a premium Expo tracker with local stubs and template screens. Across the sprint it became a **closed-loop Longevity OS**:

| Phase | Capability |
|-------|------------|
| **Foundation** | Auth (web-safe) → 3-step Foundation Scan (pillar %, biological passport, equipment) → smart routing guards |
| **Sanctuary** | Daily Command with AI/deterministic gameplans, glass ritual cards, **wired Attunement Orbs** (Reanimated pulse from `user_stats`) |
| **Iron** | MuscleWiki-level encyclopedia (`008` + `seed_hypertrophy.sql`), **Elite Hypertrophy Coach** Edge logic: 21d mesocycle, RIR, MEV/MRV weekly volume, dynamic rest, CNS/injury autoregulation, `alternative_exercise_id` for instant Adapt |
| **Combat** | DB-driven combo rounds via `library_combat`, `useCombatInterval` work/rest engine, mastery gating, phase audio + haptics |
| **Spirit / Flow** | Breathwork visualizer (Reanimated orb), AI `spirit` blocks with tempo + duration; recovery prescription from **yesterday main-workout RPE** + biological stress (48h cross-pillar healer — **next sprint**) |
| **Sync** | Offline `performanceQueue`, Ascension 3s ritual, `flushPerformanceQueue` on foreground, `performance_logs` + Edge recalibration |

**Chess Master rule (unchanged):** The LLM arranges **catalog IDs only** — never invents exercise names, combos, or tempos.

**Before any new feature work:** Confirm Supabase state (migrations + seeds + deployed Edge Function + `OPENROUTER_API_KEY`).

---

## 1. Repository Map (Operational)

```
SOMMA/
├── app/
│   ├── _layout.tsx                         # SplashGate, AuthProvider, PerformanceSyncBridge
│   ├── +not-found.tsx                      # SOMMA-styled 404
│   ├── (auth)/
│   │   ├── index.tsx                       # OTP + Google; foundationComplete routing
│   │   └── foundation.tsx                  # 3-step Foundation Scan
│   ├── (tabs)/
│   │   ├── _layout.tsx                     # FoundationGuard
│   │   ├── home.tsx                        # Daily Command + AttunementOrbsPanel
│   │   ├── analytics.tsx                   # Biological passport edit + biomarker placeholders
│   │   └── mastery.tsx                     # Placeholder constellation
│   └── (workout)/
│       ├── _layout.tsx                     # ascension: gestureEnabled false
│       ├── iron.tsx                        # DB prescriptions, dynamic rest, Adapt swap
│       ├── combat.tsx                      # AI rounds + catalog combos
│       ├── spirit.tsx                      # Reanimated breathwork
│       └── ascension.tsx                   # 3s flare + completeWorkout
├── components/
│   ├── analytics/                          # BiologicalPassportSummary, BiomarkerPlaceholderGrid
│   ├── auth/, foundation/, iron/, combat/, spirit/, sanctuary/, workout/, routing/
├── constants/                              # foundation, breathwork, combat, biomarkers, iron-exercises (fallback)
├── hooks/
│   ├── useWorkoutNavigation.ts             # openBlock, finishBlock, completionFromParams
│   ├── useActiveGameplanBlock.ts           # block lookup from currentGameplan
│   ├── useCombatInterval.ts                # work/rest round scheduler
│   ├── useBreathworkEngine.ts              # phase machine + cycles
│   └── useRestTimer.ts                     # iron inter-set countdown
├── lib/
│   ├── catalog/library.ts                  # exercises, combat, flow_spirit + cache v2
│   ├── iron/resolveExercise.ts             # prescription → UI view (rest, adapt id)
│   ├── breathwork/tempoMap.ts              # tempo_478 → local tempo ids
│   ├── gameplan/                           # fetch, parse, stub
│   ├── supabase/                           # client, auth, profile, performance
│   └── audio/workoutCues.ts                # expo-av phase beeps (combat)
├── providers/AuthProvider.tsx
├── store/useSommaStore.ts                    # persist: somma-offline-store
├── types/                                  # gameplan, catalog, biological, performance
├── supabase/
│   ├── migrations/ 001–008
│   ├── seed.sql, seed_hypertrophy.sql
│   └── functions/generate_daily_protocol/index.ts  # ~1600 lines — Elite Coach brain
├── docs/OFFLINE_SYNC_TEST.md
├── markdown.md
├── CONTEXT_ANCHOR_V2.md
└── CONTEXT_ANCHOR_V3.md                    # This file
```

**Tooling:** `npx tsc --noEmit` passes · NativeWind Quiet Luxury (`#0F1512`, matte-gold, moss-900) · Legacy Expo template files removed (`Themed`, `EditScreenInfo`, `Colors`, etc.)

---

## 2. Iron Pillar State (Elite Hypertrophy Coach)

### 2.1 Database — MuscleWiki-level biomechanics

**Migration:** `supabase/migrations/008_iron_biomechanics.sql`

| Column | Type | Purpose |
|--------|------|---------|
| `primary_muscle` | text | Main hypertrophy target (e.g. `quadriceps`, `hamstrings`, `upper_chest`) |
| `synergist_muscles` | text[] | Secondary contributors |
| `cns_fatigue_cost` | int 1–5 | CNS drain (1 = isolation, 5 = heavy axial compound) |
| `joint_stress_profile` | text | Injury-aware tags: `high_knee_shear`, `lumbar_shear`, `rotator_cuff_heavy`, `shoulder_impingement_risk`, `spinal_axial_load`, `low_impact`, etc. |
| `stretch_mediated_hypertrophy` | boolean | SCHP bias — peak tension in lengthened position |

**Seed:** `supabase/seed_hypertrophy.sql` — **49 curated exercises** (deficit BSS, hack squat, RDL variants, iliac lat pulldown, incline DB 30°, Bayesian curl, etc.) with full biomechanics. Upserts on `slug`.

**Base seed:** `supabase/seed.sql` still has 15 legacy iron rows; hypertrophy seed is authoritative for biomechanics columns.

### 2.2 Edge Function — Iron expert pipeline

File: `supabase/functions/generate_daily_protocol/index.ts`

**Server-side (deterministic, runs before LLM):**

1. `mapLibraryExerciseRow` — loads all biomechanics columns via explicit `LIBRARY_EXERCISE_SELECT`.
2. `resolveIronRoutineIds` — locked routine from yesterday's protocol or push/hinge/pull defaults.
3. `detectIronAutoregulation` — stress **> 7**, poor recovery (yesterday RPE ≥ 8), injury → `blocked_joint_profiles`.
4. `applyIronRoutineAutoregulation` — **injury swaps** + **CNS swaps** (cost ≥ 4 → alternative ≤ 2, same `primary_muscle`).
5. `buildMesocycleSummaries` — **21-day** iron logs per `exercise_id`: load / volume / deload / maintain from RPE + rep hit rate.
6. `buildWeeklyVolumeByMuscle` — **7-day** working sets per `primary_muscle` from `performance_logs.payload.iron.sets[]`.
7. `applyWeeklyVolumeSetCap` — if approaching MRV (≥18 sets) or at MRV (≥20) + high stress → cut sets today.
8. `prescribeIronExercise` — deterministic prescription including RIR, rest, alternative id.
9. LLM refines within `routine_exercise_ids` only; `sanitizeBlueprint` validates + enforces caps.

**Mesocycle rules (21d):**

- RPE ≤ 8 + hit reps → **load progression** (~+2.5% weight or +1 rep).
- RPE ≥ 9 → **deload** (~−5% load, higher RIR).
- No logs → baseline @ 2 RIR from catalog defaults.

**Weekly volume (MEV/MRV) — 7 days:**

| Band | Sets / muscle / 7d | Action |
|------|-------------------|--------|
| Below MEV | < 10 | May add volume if recovery allows |
| Optimal | 10–20 | Standard hypertrophy |
| Approaching MRV | ≥ 18 | Cut sets if stress high |
| At MRV | ≥ 20 | Must not add sets |

Constants: `HYPERTROPHY_MEV_SETS = 10`, `MRV_SOFT = 18`, `MRV_HARD = 20`.

**RIR (mandatory in JSON):**

- `target_rep_range`: string e.g. `"8-10 @ 2 RIR"`.
- `target_reps`: integer top of range (logging).
- `target_rir`: 0–4.

**Dynamic rest (`rest_seconds`):**

| CNS cost | Prescribed rest |
|----------|----------------|
| 1 | 60s |
| 2 | 75s |
| 3 | 105s |
| 4 | 150s |
| 5 | 180s |

Mirrored client-side: `computeRestSecondsFromCns()` in `types/catalog.ts`.

**Execution techniques:** `Standard` | `Myo-Reps` | `Rest-Pause` | `Slow Eccentric (4s)` | `Drop Set` | `Cluster Sets` — gated by stress and CNS in prompt + `pickExecutionTechnique()`.

**Smart substitution:** `alternative_exercise_id` — same `primary_muscle`, ≤ CNS cost (prefer lower). Filled server-side via `findAlternativeExerciseId()`.

### 2.3 Iron prescription shape (gameplan JSON)

```typescript
// types/gameplan.ts — IronExercisePrescription
{
  exercise_id: string;              // UUID from library_exercises
  target_sets: number;
  target_reps: number;            // top of rep range
  target_weight_kg: number | null;
  target_rep_range?: string;        // "8-10 @ 2 RIR"
  target_rir?: number;
  rest_seconds?: number;          // dynamic from CNS
  alternative_exercise_id?: string | null;
  progression_note?: string;
  execution_technique?: IronExecutionTechnique;
}
```

`lib/gameplan/parseGameplan.ts` preserves all fields. `lib/iron/resolveExercise.ts` maps to workout UI.

### 2.4 Frontend — `app/(workout)/iron.tsx`

- Loads block via `useActiveGameplanBlock(blockId)`.
- Prefetches `fetchLibraryExercises()` (cache key `somma-cache-library-exercises-v2`).
- Multi-exercise queue from `block.iron.exercises[]`.
- **Rest timer** uses `prescription.rest_seconds` (not static template rest).
- **Adapt button** swaps to `alternative_exercise_id` locally (`adaptedOverrideByIndex`) — **no network call**.
- `ExerciseCueCard` shows biomechanics strip (primary muscle, CNS, joint stress, stretch-biased badge).
- Falls back to `constants/iron-exercises.ts` only when no gameplan iron payload.

### 2.5 Iron-related lib files

| File | Role |
|------|------|
| `lib/catalog/library.ts` | Fetch/cache encyclopedia; `resolveBlockPreviewLabel` for cards |
| `types/catalog.ts` | `LibraryExercise`, `IronExerciseBiomechanics`, rest + MEV/MRV constants |
| `components/iron/ExerciseCueCard.tsx` | Collapsible cues + biomechanics |
| `components/iron/RestTimerOverlay.tsx` | Countdown UI |
| `hooks/useRestTimer.ts` | 1s tick, onComplete callback |

---

## 3. Combat Pillar State

### 3.1 What is implemented (production path)

**Database:** `library_combat` — `slug`, `combo_name`, `sequence` (jsonb string array), `complexity_level` (1–10). Seeded in `seed.sql` (10 combos) + samples in `004`.

**Edge Function — Expert 2:**

- Filters combos by `user_stats.combat_mastery` vs `complexity_level`.
- Builds 3–4 rounds with `combo_id`, `work_seconds` (default 180), `rest_seconds` (default 60).
- LLM shuffles allowed combo IDs only.

**Gameplan shape:**

```typescript
combat?: {
  rounds: {
    round_index: number;
    combo_id: string;      // UUID → library_combat
    work_seconds: number;
    rest_seconds: number;
  }[];
}
```

### 3.2 `useCombatInterval` — Tactical round engine

File: `hooks/useCombatInterval.ts`

| Feature | Implementation |
|---------|----------------|
| **Phases** | `idle` → `work` → `rest` → … → `finished` |
| **Tactical rounds** | Optional `rounds: CombatRoundConfig[]` from AI — each round has its own combo + work/rest duration |
| **Fallback** | Rotates `COMBAT_COMBOS` from `constants/combat.ts` with `COMBAT_DEFAULTS` (3×180s work / 60s rest) |
| **Per-round logging** | `CombatRoundLog[]` with combo_name, work_seconds, rest_seconds |
| **Transitions** | On timer hit 0: work→rest or rest→next work; advances `comboIndex` through schedule |
| **Controls** | `start`, `pause`, `resume`, `reset` |

Exported: `comboFromLibrary()` maps DB row → `{ id, name, sequence }`.

### 3.3 Frontend — `app/(workout)/combat.tsx`

- Fetches `fetchLibraryCombat()` on mount.
- Builds `roundSchedule` from `activeBlock.combat.rounds[]` + catalog + `filterCombatByMastery(catalog, combatMastery)`.
- `ComboDisplay` — large combo sequence text, copper/blood accent.
- `prepareWorkoutAudio()` on mount.
- Post-session **RPE 1–10 required** before Ascension (`RpeSelector`).
- `finishBlock` passes volume = sum of work seconds.

### 3.4 Audio immersive engine (MVP)

File: `lib/audio/workoutCues.ts`

- `expo-av` session prep (`playsInSilentModeIOS`).
- `playPhaseCue()` on work↔rest transitions (remote beep URL).
- **Primary feedback:** `hapticPhaseChange`, `hapticRoundEnd` from `lib/haptics.ts`.
- Not yet: bundled assets, round-index voice, defensive callouts, adaptive tempo audio.

### 3.5 Combat — Roadmap vs implemented (honest)

| Concept | Status |
|---------|--------|
| Tactical rounds from AI | ✅ Implemented |
| Per-round work/rest from protocol | ✅ Implemented |
| Mastery-based combo pool | ✅ Implemented |
| Adaptive cadence / burnout phases | ⚠️ Stub copy only (`generateStubGameplan` subtitle mentions burnout); **not in Edge/player** |
| Defensive cues overlay | ❌ Not implemented |
| Full immersive audio suite | ⚠️ Phase beep + haptics only |

---

## 4. Flow / Spirit Pillar State

### 4.1 Database

**Table:** `library_flow_spirit` — created in `seed.sql` + formalized in `007_library_flow_spirit.sql`

| Column | Type |
|--------|------|
| `slug` | unique |
| `pillar` | `flow` \| `spirit` |
| `session_name`, `description` | text |
| `duration_minutes` | int |
| `tempo_profile` | jsonb |
| `complexity_level` | 1–10 |

**Seed:** 5 flow/spirit sessions in `seed.sql`. Client can fetch via `fetchLibraryFlowSpirit()` but Spirit screen primarily uses hardcoded tempos.

### 4.2 Recovery prescription (Spirit expert)

**Implemented today:**

- Edge `buildSpiritBlockFromRpe(yesterdayMainRpe)` — uses **prior main pillar workout RPE** (first log among iron/combat/spirit/flow).
- `baseline_stress_level` from biological passport influences fallback RPE estimate.
- LLM Spirit expert: tempo_id from allowlist (`tempo_478`, `tempo_box`, `tempo_relax`), duration 10–22 min based on RPE bands.

**Biomechanical Healer (48h Iron + Combat load) — NOT yet coded:**

- No dedicated aggregation of last 48h iron/combat volume/CNS in Edge Function.
- **Next sprint:** add `recovery_debt_score` from 48h `performance_logs` to drive Spirit duration/tempo automatically.

### 4.3 Frontend — Deep Obsidian UI + Reanimated visualizer

| Asset | Details |
|-------|---------|
| **Shell** | `WorkoutShell` accent `spirit`; screen bg `#0D1210` |
| **`BreathOrbVisualizer`** | Reanimated `scale` + `glow` on inhale/hold/exhale/hold_empty; phase-synced duration |
| **`useBreathworkEngine`** | Phase machine; `targetCycles` from `block.spirit.duration_minutes` via `cyclesForDuration()` |
| **`BreathPhaseHud`** | Phase label, seconds left, cycle index |
| **`TempoSelector`** | Idle-state tempo pick from `BREATH_TEMPOS` |
| **`lib/breathwork/tempoMap.ts`** | Maps Edge ids (`tempo_box`) → local ids (`box`) |

**Gameplan spirit block:**

```typescript
spirit?: {
  mode: 'flow' | 'breathwork';
  tempo_id: string;
  duration_minutes: number;
  prescribed_reason?: string;
}
```

---

## 5. Cross-Cutting Architecture

### 5.1 Zustand — `store/useSommaStore.ts`

**Persist key:** `somma-offline-store` (AsyncStorage)

| Slice | Purpose |
|-------|---------|
| `user_foundation`, `user_environment`, `user_biological` | Foundation Scan + passport |
| `user_stats` | Maps to essence % + `combat_mastery` |
| `currentGameplan` / `daily_gameplan` | Today's blocks (kept in sync) |
| `performance_logs` | Local session history |
| `performanceQueue` | Pending Supabase sync items |
| `gameplan_source` | `ai` \| `fallback` \| `stub` \| `deterministic` |

**Key actions:**

- `fetchDailyGameplanAsync` / `regenerateDailyGameplan` → `lib/gameplan/fetchDailyGameplan.ts`.
- `completeWorkout` → queue + `syncPerformanceQueueAndRecalibrate` (non-blocking).
- `flushPerformanceQueue` → drain queue on reconnect (also triggered by `PerformanceSyncBridge`).
- `completeFoundationScan` → stub gameplan + local state.
- `resetStore` → full wipe + `persist.clearStorage()`.

### 5.2 Workout completion pipeline

```
Workout screen → append*Session (local performance_logs)
            → finishBlock(meta) → /(workout)/ascension
            → completeWorkout (queue + try sync + optional new gameplan)
            → setTimeout 3s → /(tabs)/home (ALWAYS)
```

`lib/supabase/performance.ts` — inserts `performance_logs`, invokes Edge Function; strips non-UUID `exercise_id` before insert.

### 5.3 Auth & routing

- `AuthProvider` — no async in `onAuthStateChange`; deferred profile hydrate.
- `FoundationGuard` — tabs require completed foundation.
- Web: Supabase `localStorage` adapter in `lib/supabase/client.ts`.

### 5.4 Sanctuary / Daily Command

- `GameplanBlockCard` — async preview labels from catalog (`resolveBlockPreviewLabel`).
- `AttunementOrbsPanel` + `AttunementOrbs` — Reanimated concentric rings; glow from essence %; biological snippet.
- Recalibrate → `regenerateDailyGameplan()`.

### 5.5 Analytics tab

- `BiologicalPassportSummary` — read-only snapshot.
- `BiologicalPassportForm` — edit + `upsertBiologicalPassport()`.
- `BiomarkerPlaceholderGrid` — 6 placeholder tiles + upload CTA (`constants/biomarkers.ts`); **no `biomarkers` table yet**.

---

## 6. Database Integrity — Full Migration & Seed Order

Run in Supabase SQL Editor (**SQL only**, no `#` lines):

| Order | File | Purpose |
|-------|------|---------|
| 1 | `001_initial_schema.sql` | `profiles`, `user_environment`, `user_stats`, signup trigger |
| 2 | `002_daily_protocols.sql` | `daily_protocols` + RLS |
| 3 | `003_rls_core_user_tables.sql` | Idempotent RLS on core tables |
| 4 | `004_library_catalog.sql` | `library_exercises`, `library_combat` + sample rows |
| 5 | `005_performance_logs.sql` | `performance_logs` + RLS |
| 6 | `006_profiles_biological_passport.sql` | Biological columns on `profiles` |
| 7 | `007_library_flow_spirit.sql` | Formal DDL for flow/spirit catalog |
| 8 | `008_iron_biomechanics.sql` | Iron biomechanics columns + indexes |
| 9 | `seed.sql` | 15 iron + 10 combat + 5 flow/spirit (+ creates flow table if needed) |
| 10 | `seed_hypertrophy.sql` | **49** elite iron exercises (upsert all biomechanics) |

### 6.1 `library_exercises` — complete column reference

| Column | Source |
|--------|--------|
| `id`, `slug`, `name`, `pillar` | 004 |
| `biomechanical_instructions` | jsonb — setup/eccentric/concentric/safety |
| `equipment_required` | text[] |
| `default_sets`, `default_reps`, `movement_pattern` | 004 |
| `primary_muscle`, `synergist_muscles` | **008** |
| `cns_fatigue_cost` | **008** (1–5) |
| `joint_stress_profile` | **008** |
| `stretch_mediated_hypertrophy` | **008** |

### 6.2 `library_combat`

| Column | Notes |
|--------|-------|
| `slug`, `combo_name` | unique |
| `sequence` | jsonb `["Jab","Cross",...]` |
| `complexity_level` | 1–10; filtered by `combat_mastery` |

### 6.3 `library_flow_spirit`

| Column | Notes |
|--------|-------|
| `pillar` | `flow` \| `spirit` |
| `session_name`, `description`, `duration_minutes`, `tempo_profile`, `complexity_level` | |

### 6.4 `performance_logs`

| Column | Notes |
|--------|-------|
| `pillar`, `exercise_id`, `block_id` | |
| `weight_used`, `reps_completed`, `rpe_score`, `volume`, `actual_rest_seconds` | |
| `payload` | jsonb — full `IronSessionLog` / `CombatSessionLog` / `SpiritSessionLog` for MEV/MRV set counting |
| `timestamp` | Used for 7d volume + 21d mesocycle windows |

### 6.5 Edge Function secrets & deploy

```bash
supabase functions deploy generate_daily_protocol
# Secret: OPENROUTER_API_KEY
# Model: meta-llama/llama-3.3-70b-instruct, temperature 0.2, JSON mode
```

**CORS:** OPTIONS → 204; `Access-Control-Allow-Origin: *` on all responses.

**Performance query:** Last 21 days, up to 200 rows, includes `payload` for weekly volume.

### 6.6 Tables not yet migrated

Per `markdown.md`: `user_rituals`, `biomarkers`, `user_exams`, `user_achievements`, Storage buckets.

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
  iron?: {
    routine_id?: string;
    exercises: IronExercisePrescription[];
  };
  combat?: { rounds: CombatRoundPrescription[] };
  spirit?: SpiritBlockPrescription;
}
```

Edge upserts `daily_protocols` with `source`: `ai` | `fallback` | `deterministic`.

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

**Cache note:** After schema changes, catalog cache key `somma-cache-library-exercises-v2` auto-refreshes after TTL (12h) or reinstall.

---

## 9. Known Gaps (Accurate)

| Area | Gap |
|------|-----|
| Iron | Local `iron-exercises.ts` still exists as offline fallback only |
| Combat | Burnout phases, defensive cues, adaptive cadence — not in Edge/player |
| Spirit | 48h Iron/Combat-driven healer logic — roadmap |
| Spirit | `library_flow_spirit` not yet driving UI (hardcoded tempos) |
| Mastery | Constellation map placeholder |
| Biomarkers | UI placeholders only — no DB/API |
| Realtime | Attunement orbs use local stats, not Supabase Realtime |
| Audio | `expo-av` deprecated in SDK 54 — migrate to `expo-audio` later |
| Tests | No automated E2E; manual `docs/OFFLINE_SYNC_TEST.md` |

---

## 10. Next Sprint Priority (Fresh Thread)

Execute in this order:

### P0 — Validation & E2E

1. **Supabase verify** — All migrations `001`–`008`, `seed.sql`, `seed_hypertrophy.sql` applied; row counts on `library_exercises` ≥ 49 with biomechanics filled.
2. **Deploy Edge Function** — Confirm `OPENROUTER_API_KEY`; hard-refresh web after deploy.
3. **Daily Gameplan E2E** — Foundation → Recalibrate → inspect `daily_protocols.blocks` for:
   - `iron.exercises[]` with `target_rep_range`, `target_rir`, `rest_seconds`, `alternative_exercise_id`, `execution_technique`
   - `combat.rounds[]` with valid `combo_id` UUIDs
   - `spirit` with `tempo_id` + `duration_minutes`
4. **Iron session E2E** — Confirm dynamic rest countdown matches prescription; Adapt swaps exercise instantly; logs use UUID `exercise_id`.
5. **Offline sync** — Follow `docs/OFFLINE_SYNC_TEST.md` (airplane mode → reconnect → queue drain).

### P1 — Product depth

6. **Biomechanical Healer (48h)** — Edge: aggregate 48h iron+combat logs (volume, CNS, RPE); drive Spirit block duration/tempo/de-load copy; surface `prescribed_reason` on home/spirit UI.
7. **Biomarkers** — Migration `009_biomarkers.sql` + Storage bucket + wire `BiomarkerPlaceholderGrid` to real CRUD (or ingest pipeline).
8. **Combat phase 2** — Burnout rounds + defensive cue layer in `ComboDisplay`; optional adaptive work/rest shortening when RPE high.

### P2 — Polish

9. **Attunement Orbs++** — Realtime `user_stats` subscription; animate orb intensity from today's completed pillars.
10. **`library_flow_spirit` in Spirit screen** — Load sessions from DB when `block.spirit.mode === 'flow'`.
11. **Mastery constellation** — Replace `mastery.tsx` placeholder.
12. **expo-audio migration** — Replace `expo-av` in `workoutCues.ts`.

---

## 11. Quick Reference — Open First in New Thread

| Goal | Open first |
|------|------------|
| Iron coach logic | `supabase/functions/generate_daily_protocol/index.ts` (search `prescribeIronExercise`, `buildWeeklyVolumeByMuscle`) |
| Iron UI | `app/(workout)/iron.tsx`, `lib/iron/resolveExercise.ts`, `types/gameplan.ts` |
| Combat timer | `hooks/useCombatInterval.ts`, `app/(workout)/combat.tsx` |
| Spirit breath | `hooks/useBreathworkEngine.ts`, `components/spirit/BreathOrbVisualizer.tsx` |
| Gameplan types/parse | `types/gameplan.ts`, `lib/gameplan/parseGameplan.ts` |
| Store / sync | `store/useSommaStore.ts`, `lib/supabase/performance.ts`, `components/routing/PerformanceSyncBridge.tsx` |
| DB | `supabase/migrations/`, `seed_hypertrophy.sql` |
| Product spec | `markdown.md` |

---

*V3 reflects the codebase after the Elite Coach architectural sprint. Verify live Supabase (migrations applied, function deployed, catalog row counts) before building new features.*
