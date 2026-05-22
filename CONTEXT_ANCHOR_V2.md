# SOMMA — Context Anchor V2 (Session Checkpoint)
**Project:** SOMMA (The Longevity OS)  
**Stack:** Expo SDK 54 · TypeScript · Expo Router · NativeWind v4 · Zustand · Supabase · OpenRouter (Edge Functions)  
**Checkpoint date:** May 2026 (end of Day 1 session)  
**Spec source of truth:** `markdown.md` (SRS / SAD / FSD)  
**Prior anchor:** `CONTEXT_ANCHOR.md` (superseded for onboarding — use this file tomorrow)

---

## 0. Executive Summary (Day 1 Outcomes)

Day 1 closed the **auth → foundation → sanctuary → workout → ascension → sync** loop at an MVP level. The backend now has encyclopedia tables, biological passport columns, performance logging, and a **Multiple Experts** Edge Function that only arranges catalog IDs (no hallucinated exercises). The frontend has resilient web auth, smart routing guards, Daily Command UI, and graceful Ascension exit even when Supabase fails.

**Before coding tomorrow:** Run pending SQL in Supabase (migrations `005`, `006`, `seed.sql`) and redeploy `generate_daily_protocol`.

---

## 1. Current State — Repository & Modified Files

### 1.1 Folder structure (operational)

```
SOMMA/
├── app/
│   ├── _layout.tsx                    # ★ SplashGate + fonts + AuthProvider wrapper
│   ├── (auth)/
│   │   ├── index.tsx                  # ★ Auth routing + foundationComplete guard
│   │   └── foundation.tsx             # ★ 3-step scan: focus → biology → equipment
│   ├── (tabs)/
│   │   ├── _layout.tsx                # ★ FoundationGuard (smart redirect)
│   │   ├── home.tsx                   # ★ Daily Command (currentGameplan, glass cards)
│   │   ├── analytics.tsx              # ★ resetStore, sign out, reset profile
│   │   └── mastery.tsx                # Placeholder + Incoming alert button
│   └── (workout)/
│       ├── _layout.tsx                # ascension: gestureEnabled false
│       ├── iron.tsx                   # ★ finishBlock meta + Adapt alert
│       ├── combat.tsx                 # ★ finishBlock + RPE → ascension params
│       ├── spirit.tsx                 # ★ finishBlock → ascension
│       └── ascension.tsx              # ★ 3s exit timer, try/catch sync, simple gold glow
├── components/
│   ├── auth/                          # AuthGlassTile, EmailAuthPanel
│   ├── foundation/
│   │   ├── BiologicalPassportForm.tsx # ★ NEW — DOB, weight, height, stress, injuries
│   │   ├── FoundationProgress.tsx
│   │   └── SelectionTile.tsx
│   ├── routing/
│   │   └── FoundationGuard.tsx        # ★ NEW — tabs redirect if foundation incomplete
│   ├── sanctuary/
│   │   ├── GameplanBlockCard.tsx      # ★ Glassmorphism styling
│   │   └── AttunementOrbs.tsx         # (home uses placeholder orbs panel)
│   ├── iron/                          # ValueStepper, RestTimerOverlay
│   ├── combat/                        # ComboDisplay, RpeSelector
│   ├── spirit/                        # BreathOrbVisualizer, TempoSelector, BreathPhaseHud
│   └── workout/                       # WorkoutShell
├── constants/
│   ├── foundation.ts                  # ★ 3 steps + FOUNDATION_STEP_META
│   ├── iron-exercises.ts              # LOCAL stub library (not yet DB-driven)
│   ├── combat.ts                      # LOCAL combo rotation (not yet DB-driven)
│   └── breathwork.ts                  # LOCAL tempos (Edge Function also has hardcoded tempos)
├── hooks/
│   ├── useWorkoutNavigation.ts        # ★ finishBlock(meta), completionFromParams
│   ├── useRestTimer.ts
│   ├── useCombatInterval.ts
│   └── useBreathworkEngine.ts
├── lib/
│   ├── config.ts                      # EXPO_PUBLIC_SUPABASE_KEY alias
│   ├── supabase/
│   │   ├── client.ts                  # ★ Web localStorage adapter (async + try/catch)
│   │   ├── auth.ts
│   │   ├── session.ts
│   │   ├── profile.ts                 # ★ Biological fields sync/hydrate
│   │   └── performance.ts             # ★ NEW — performance_logs insert + Edge invoke
│   ├── gameplan/                      # fetchDailyGameplan, parseGameplan, stub
│   └── ux/
│       └── incomingFeature.ts         # ★ NEW — Alert for unfinished UI actions
├── providers/
│   └── AuthProvider.tsx               # ★ No async in onAuthStateChange; deferred hydrate
├── store/
│   └── useSommaStore.ts               # ★ currentGameplan, performanceQueue, completeWorkout, resetStore, user_biological
├── types/
│   ├── gameplan.ts
│   ├── performance.ts                 # ★ WorkoutCompletionInput, PerformanceQueueItem
│   └── biological.ts                # ★ NEW — BiologicalProfile helpers
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_daily_protocols.sql
│   │   ├── 003_rls_core_user_tables.sql
│   │   ├── 004_library_catalog.sql
│   │   ├── 005_performance_logs.sql
│   │   └── 006_profiles_biological_passport.sql
│   ├── seed.sql                       # ★ NEW — 15 iron, 10 combat, 5 flow/spirit + library_flow_spirit table
│   └── functions/
│       └── generate_daily_protocol/
│           └── index.ts               # ★ Multiple Experts + biological prompt + CORS
├── tailwind.config.js                 # ★ moss-900 token
├── markdown.md
├── CONTEXT_ANCHOR.md                  # V1 (historical)
└── CONTEXT_ANCHOR_V2.md                 # This file
```

★ = materially changed or created during Day 1 session.

### 1.2 Configuration & tooling

| Area | Status | Notes |
|------|--------|-------|
| Expo SDK 54 + TS | ✅ | `npx tsc --noEmit` passes |
| NativeWind v4 | ✅ | Obsidian `#0F1512`, matte-gold, moss-900 |
| Zustand persist | ✅ | Key `somma-offline-store`; includes `user_biological`, `performanceQueue` |
| Supabase client | ✅ | Web: `localStorage`; native: chunked SecureStore |
| Env | ✅ | `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` or `EXPO_PUBLIC_SUPABASE_KEY` |
| Edge Function | ⚠️ | Source ready; must **deploy** + set `OPENROUTER_API_KEY` secret |
| DB migrations | ⚠️ | SQL files in repo; apply manually in Dashboard (see §2) |

### 1.3 Screen status matrix

| Route | Screen | Status |
|-------|--------|--------|
| `/(auth)/index` | Welcome & Auth | **Functional** — OTP + Google; auto-route when session + foundation complete |
| `/(auth)/foundation` | Foundation Scan | **Functional** — 3 steps: pillar, biological passport, equipment |
| `/(tabs)/home` | Daily Command | **Functional** — `currentGameplan`, glass cards, Recalibrate, empty-state CTA |
| `/(tabs)/mastery` | Constellation | **Placeholder** |
| `/(tabs)/analytics` | Biological Passport UI | **Partial** — sign out / reset only; no biomarker charts yet |
| `/(workout)/iron` | Iron Mode | **MVP** — local `iron-exercises.ts`; NOT yet reading AI `iron.exercises[]` from gameplan |
| `/(workout)/combat` | Combat | **MVP** — local `constants/combat.ts` combos; NOT yet reading `combat.rounds[]` from gameplan |
| `/(workout)/spirit` | Spirit / breathwork | **MVP** — local tempos; NOT `library_flow_spirit` |
| `/(workout)/ascension` | Ascension Flare | **Functional** — always returns home @ 3s; background sync |

---

## 2. Database Integrity — Supabase Schema

### 2.1 Migration apply order (SQL Editor)

Run in order (paste **SQL only**, no `#` markdown lines):

| Order | File | Purpose |
|-------|------|---------|
| 1 | `001_initial_schema.sql` | `profiles`, `user_environment`, `user_stats`, signup trigger |
| 2 | `002_daily_protocols.sql` | `daily_protocols` + RLS |
| 3 | `003_rls_core_user_tables.sql` | Idempotent RLS + grants on core user tables |
| 4 | `004_library_catalog.sql` | `library_exercises`, `library_combat` + 3 sample rows each |
| 5 | `005_performance_logs.sql` | `performance_logs` + RLS insert/select |
| 6 | `006_profiles_biological_passport.sql` | Biological columns on `profiles` |
| 7 | `seed.sql` | **15 iron + 10 combat + 5 flow/spirit** (upsert by slug) |
| 8 | `008_iron_biomechanics.sql` | Iron encyclopedia: primary_muscle, CNS cost, joint stress, SCHP flag |
| 9 | `seed_hypertrophy.sql` | **49 elite hypertrophy exercises** with full biomechanics (run after 008) |

### 2.2 Table reference (implemented in repo)

#### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | FK → `auth.users` |
| `name` | text | optional |
| `focus_preference` | jsonb | `{ iron, combat, flow, spirit }` % |
| `date_of_birth` | date | ★ migration 006 |
| `weight_kg` | numeric | ★ |
| `height_cm` | numeric | ★ |
| `body_fat_percentage` | numeric | nullable ★ |
| `current_injuries` | text | nullable ★ |
| `baseline_stress_level` | int | 1–10 ★ |
| `created_at` | timestamptz | |

#### `user_environment`
| Column | Type |
|--------|------|
| `user_id` | uuid PK → profiles |
| `available_equipment` | text[] / jsonb array |
| `updated_at` | timestamptz |

#### `user_stats`
| Column | Type |
|--------|------|
| `user_id` | uuid PK |
| `body_essence`, `mind_essence`, `spirit_essence`, `combat_mastery` | int |

#### `daily_protocols`
| Column | Type |
|--------|------|
| `user_id`, `protocol_date` | unique pair |
| `blocks` | jsonb — gameplan blocks + nested `iron` / `combat` / `spirit` prescriptions |
| `source` | text — `ai`, `fallback`, `deterministic`, `stub` |
| `generated_at` | timestamptz |

#### `performance_logs` (005)
| Column | Type |
|--------|------|
| `id` | uuid PK |
| `user_id` | uuid FK |
| `pillar` | text — iron, combat, flow, spirit |
| `exercise_id` | uuid nullable → `library_exercises` |
| `block_id` | text |
| `weight_used`, `reps_completed`, `rpe_score`, `actual_rest_seconds`, `volume` | numeric/int |
| `payload` | jsonb — full session snapshot |
| `timestamp` | timestamptz |

#### `library_exercises` (004 + seed)
| Column | Type |
|--------|------|
| `slug` | unique |
| `name`, `biomechanical_instructions` | jsonb cues |
| `equipment_required` | text[] |
| `default_sets`, `default_reps` | int |
| `movement_pattern` | push, pull, hinge, squat, lunge, carry |

#### `library_combat` (004 + seed)
| Column | Type |
|--------|------|
| `slug` | unique |
| `combo_name`, `sequence` | jsonb string array |
| `complexity_level` | 1–10 |

#### `library_flow_spirit` (created in `seed.sql` only)
| Column | Type |
|--------|------|
| `slug` | unique |
| `pillar` | `flow` \| `spirit` |
| `session_name`, `description` | text |
| `duration_minutes`, `tempo_profile` | int / jsonb |
| `complexity_level` | 1–10 |

**Not migrated yet (per `markdown.md`):** `user_rituals`, `biomarkers`, `user_exams`, `user_achievements`, Storage buckets.

### 2.3 RLS summary

| Table | authenticated |
|-------|----------------|
| `profiles`, `user_environment`, `user_stats` | select/insert/update own row |
| `daily_protocols` | select/insert/update own |
| `performance_logs` | select/insert own |
| `library_*` | **select only** (read-only encyclopedia) |

### 2.4 Edge Function: `generate_daily_protocol`

**Input (POST body):**
```json
{ "focus_preference": { ... }, "available_equipment": ["dumbbells", ...] }
```

**Flow:**
1. Auth via `Authorization` header (user JWT).
2. Load `profiles` (biological passport), libraries, `user_stats`, `performance_logs`, last `daily_protocols`.
3. Lock iron routine exercise IDs (from yesterday's protocol or push/hinge/pull default).
4. LLM (**Multiple Experts**) — must only use allowlisted `exercise_id` / `combo_id` / `tempo_id`.
5. `sanitizeBlueprint()` strips hallucinated IDs.
6. Upsert `daily_protocols` for today; return blocks with `status: pending`.

**CORS:** OPTIONS → 204; all responses include `Access-Control-Allow-Origin: *` (redeploy required for web).

**Secrets:** `OPENROUTER_API_KEY` in Supabase Edge Function secrets.

---

## 3. Frontend Architecture — Key Behaviors

### 3.1 Auth & session (`providers/AuthProvider.tsx`, `lib/supabase/client.ts`)

- Bootstrap: `getSession()` in try/catch/finally → **`isLoading` always false**.
- `onAuthStateChange`: **sync only** `setSession` — no `getSession()` inside callback (fixes web deadlock).
- Remote hydrate: deferred `fetchRemoteUserSnapshot` after loading completes.
- Web storage: async `localStorage` get/set/remove with try/catch.

### 3.2 Foundation & routing

- **3 steps:** Attunement → Biological Passport → Equipment (`constants/foundation.ts`).
- `hasCompletedFoundationScan()` requires focus + equipment + **`isBiologicalProfileComplete()`**.
- `FoundationGuard` on tabs: incomplete → `/(auth)/foundation` (or `/(auth)` if configured but logged out).
- Home empty state: **Pressable** → `router.push('/(auth)/foundation')`.

### 3.3 Zustand (`store/useSommaStore.ts`)

| Slice / action | Role |
|----------------|------|
| `currentGameplan` / `daily_gameplan` | Today's blocks (kept in sync) |
| `user_biological` | Local biological passport |
| `performance_logs` | Local session history |
| `performanceQueue` | Pending Supabase sync items |
| `completeWorkout(input)` | Queue → `performance.ts` sync → optional AI recalibrate → update gameplan |
| `resetStore()` | Full reset + `persist.clearStorage()` |
| `gameplan_source` | `ai` \| `fallback` \| `stub` \| `deterministic` |

**Persisted keys:** environment, foundation, biological, gameplans, performance_logs, performanceQueue.

### 3.4 Workout completion pipeline

```
Workout screen → append*Session (local log)
              → finishBlock(blockId, { pillar, rpe, volume, ... })
              → /(workout)/ascension
              → completeWorkout (try/catch, non-blocking)
              → setTimeout 3s → /(tabs)/home (ALWAYS)
```

`lib/supabase/performance.ts`:
- Inserts `performance_logs` rows.
- Invokes `generate_daily_protocol`.
- Non-throwing on failure (graceful degradation).

### 3.5 Gameplan block shape (from Edge Function)

Blocks in `daily_protocols.blocks` may include:

```typescript
{
  id, pillar, title, subtitle, duration_minutes, order, status,
  iron?: { routine_id, exercises: [{ exercise_id, target_sets, target_reps, target_weight_kg, progression_note }] },
  combat?: { rounds: [{ round_index, combo_id, work_seconds, rest_seconds }] },
  spirit?: { mode, tempo_id, duration_minutes, prescribed_reason }
}
```

**Gap:** Workout screens do not yet read these nested payloads — they use local constants.

---

## 4. Known Issues & Operational Notes

| Issue | Mitigation |
|-------|------------|
| 404 on `performance_logs` | Run `005_performance_logs.sql` |
| CORS on Edge Function (web) | Redeploy function after CORS patch |
| Empty libraries in UI | Run `seed.sql` |
| Iron `exercise_id` in logs may be local string slug | `performance.ts` strips non-UUID before insert |
| `library_flow_spirit` not in migrations folder | Created by `seed.sql`; consider `007_library_flow_spirit.sql` |
| Legacy users after biological update | Routed back to Foundation step II |
| `expo-av` deprecated SDK 54 | Migrate to `expo-audio` later |
| Attunement Orbs | Placeholder on home; `AttunementOrbs.tsx` exists but not wired to Realtime |

---

## 5. Day 2 Sprint — Exact Technical Tasks

Priority: **Wire workout players to DB + AI gameplan payloads**, then **prove offline-first sync**.

### 5.1 Prerequisites (15 min)

- [ ] Confirm all migrations `001`–`006` + `seed.sql` applied in Supabase Dashboard.
- [ ] `supabase functions deploy generate_daily_protocol` + `OPENROUTER_API_KEY` set.
- [ ] Fresh Foundation Scan on test account (biological data filled).
- [ ] Home → Recalibrate → verify `daily_protocols.blocks` contains `iron` / `combat` / `spirit` nested objects in Table Editor.

### 5.2 Iron Mode — DB-driven player (P0)

| # | Task | Files |
|---|------|-------|
| 1 | Add `lib/catalog/library.ts` — `fetchLibraryExercises()`, `getExerciseById(id)` with Supabase + AsyncStorage cache fallback | new |
| 2 | Extend `GameplanBlock` type with optional `iron` prescription (`types/gameplan.ts`) | types |
| 3 | Pass active block from `openBlock()` via route params or Zustand `activeBlockId` + lookup in `currentGameplan` | `useWorkoutNavigation.ts`, store |
| 4 | Refactor `iron.tsx` to render **each exercise** in `block.iron.exercises[]` — name/cues from `library_exercises`, targets from AI | `iron.tsx` |
| 5 | Map `exercise_id` (UUID) through session log + `completeWorkout` (stop using local slug ids) | `iron.tsx`, `performance.ts` |
| 6 | Show `biomechanical_instructions` in collapsible cue card (Quiet Luxury typography) | `components/iron/` |
| 7 | Pre-fill `ValueStepper` weight/reps from `target_weight_kg` / `target_reps` | `iron.tsx` |

**Acceptance:** Starting Iron block from a Recalibrated AI protocol shows real seeded exercise names and AI-prescribed loads.

### 5.3 Combat Mode — DB-driven player (P0)

| # | Task | Files |
|---|------|-------|
| 1 | `fetchLibraryCombat()` + cache | `lib/catalog/library.ts` |
| 2 | Read `block.combat.rounds[]` — resolve `combo_id` → `library_combat.sequence` for `ComboDisplay` | `combat.tsx` |
| 3 | Drive `useCombatInterval` round count / work-rest from AI rounds (fallback to constants) | `hooks/useCombatInterval.ts` |
| 4 | Filter combos by `user_stats.combat_mastery` vs `complexity_level` when no gameplan combat payload | `combat.tsx` |

**Acceptance:** Combat session displays Jab–Cross–Hook sequences from DB, not only hardcoded rotation.

### 5.4 Spirit / Flow — catalog alignment (P1)

| # | Task | Files |
|---|------|-------|
| 1 | Add migration `007_library_flow_spirit.sql` (move DDL out of seed-only) | supabase/migrations |
| 2 | Load `library_flow_spirit` or match `block.spirit.tempo_id` to `constants/breathwork.ts` | `spirit.tsx` |
| 3 | Set session duration from `block.spirit.duration_minutes` | `spirit.tsx`, `useBreathworkEngine.ts` |

### 5.5 Offline-first Zustand sync tests (P0)

| # | Task | How to verify |
|---|------|----------------|
| 1 | Document test script in repo (`docs/OFFLINE_SYNC_TEST.md` or comment in store) | new |
| 2 | Complete workout **offline** (airplane mode) → log stays in `performance_logs` + `performanceQueue` | manual |
| 3 | Reconnect → add `flushPerformanceQueue()` on app resume / NetInfo listener | `AuthProvider` or `app/_layout.tsx` |
| 4 | Verify queue drains: rows in Supabase `performance_logs`, queue empty in persist | Table Editor |
| 5 | `resetStore()` → confirm tabs redirect to Foundation; no ghost gameplan | analytics |

### 5.6 Gameplan → UI enrichment (P1)

| # | Task | Files |
|---|------|-------|
| 1 | `GameplanBlockCard` subtitle: show first exercise or combo name from nested payload | `GameplanBlockCard.tsx` |
| 2 | `parseGameplan.ts` preserve `iron` / `combat` / `spirit` passthrough | `parseGameplan.ts` |
| 3 | Home: show biological snapshot snippet under Attunement placeholder (weight, stress) | `home.tsx` |

### 5.7 Biological Passport tab (P2) — ✅ Done

| # | Task | Files |
|---|------|-------|
| 1 | Analytics screen: edit biological fields + `profiles` upsert | `analytics.tsx`, `profile.ts` (`upsertBiologicalPassport`) |
| 2 | Display read-only biological summary on analytics | `components/analytics/BiologicalPassportSummary.tsx` |

### 5.8 Cleanup & spec alignment (P2) — ✅ Done

- [x] Removed legacy Expo template components (`Themed.tsx`, `EditScreenInfo.tsx`, `StyledText.tsx`, `useColorScheme*`, `constants/Colors.ts`).
- [x] `007_library_flow_spirit.sql` in migrations (Day 2).
- [x] `markdown.md` §5.1 `profiles` columns already match migration 006.

---

## 6. Quick Reference — Start Here Tomorrow

| Goal | Open first |
|------|------------|
| Iron reads AI exercises | `types/gameplan.ts` → `iron.tsx` → `supabase/functions/.../index.ts` (iron block shape) |
| Fetch catalog | `supabase/seed.sql` → new `lib/catalog/library.ts` |
| Sync / queue | `store/useSommaStore.ts` → `lib/supabase/performance.ts` |
| Auth / routing bugs | `providers/AuthProvider.tsx` → `components/routing/FoundationGuard.tsx` |
| DB truth | `supabase/migrations/` + Dashboard Table Editor |
| Product spec | `markdown.md` FSD §3 (workout modes) |

---

## 7. Deploy Checklist (copy-paste session)

```bash
# Edge Function (from project root, Supabase CLI linked)
supabase functions deploy generate_daily_protocol

# Local dev
npm start
# Hard-refresh web after .env changes; clear sb-* localStorage if auth stuck
```

**Supabase Dashboard:**
1. SQL Editor → run migrations 005, 006 if not done → run `seed.sql`
2. Edge Functions → Secrets → `OPENROUTER_API_KEY`
3. Authentication → redirect URL `somma://auth/callback`

---

*V2 reflects the codebase and session work as of end of Day 1. Verify live Supabase state (row counts, function deployment) independently before sprint execution.*
