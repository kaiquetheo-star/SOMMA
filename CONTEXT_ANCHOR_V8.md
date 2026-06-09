# SOMMA — Context Anchor V8

**Paste or `@CONTEXT_ANCHOR_V8.md` at the start of every new session.** This file supersedes V7 and all prior anchors on conflict. Spec detail: `markdown.md` · `AGENTS.md` (Expo v54 docs).

| Meta | Value |
|------|--------|
| **Product** | SOMMA — Iron + Nutrition OS |
| **Scope** | **Musculacao (Iron) + Nutricao only** |
| **Checkpoint** | Jun 2026 — **Total Cleanup complete** · old pillars removed from active code · **100% local-first PWA** · **$0 on-device Head Coach** |
| **Prior anchors** | V1–V7 — historical only |
| **Last commit** | *(uncommitted session work — verify with `git log -1`)* |
| **Deploy gate** | `npx tsc --noEmit` · `npm run build` (web export) |

---

## 1. Product Scope

SOMMA is now focused exclusively on:

| Pillar | Status | Purpose |
|--------|--------|---------|
| **Iron** | Active | Musculacao, hypertrophy, strength, progressive overload, load telemetry |
| **Nutrition** | Placeholder / next pillar | Nutrition goals, recovery direction, future analytics surface |

Removed from active code:

- Blood & Bone / Combat
- Flow
- Spirit
- Mastery / Constellation
- Attunement Orbs
- Combat and breathwork audio/timer/catalog surfaces

**Hard rule:** New code must not reintroduce `combat`, `spirit`, `flow`, `mastery`, `library_combat`, or `library_flow_spirit` into active app code unless explicitly requested as a new product decision.

---

## 2. Architecture

| Layer | Stack | Role |
|-------|--------|------|
| **Client** | **Expo SDK 54** · RN 0.81 · React 19 · **Expo Router** v6 | `(auth)` · `(tabs)` · `(workout)` |
| **Styling** | **NativeWind v4** + Tailwind 3 | Obsidian `#0F1512` / `#0A0E0C` · Matte Gold `#BFA06A` |
| **State** | **Zustand** + `AsyncStorage` (`somma-offline-store`) | Source of truth for passport, microcycle, logs, queue |
| **Head Coach** | `lib/gameplan/engine/*` | Deterministic Iron microcycle from catalog + passport + logs |
| **Iron engine** | `lib/gameplan/engine/iron/*` | ConstraintSolver, CoherenceValidator, PPL split, prescription mapping |
| **Recalibrate** | `lib/local/recalibrate.ts` | Queue flush → local fetch → merge microcycle |
| **Catalog** | `lib/catalog/bundledCatalog.ts` | Bundled `library_exercises` only |
| **Load telemetry** | `lib/physics/loadTelemetry.ts` | Iron ACWR · sRPE · RPE sigma · poor recovery signal |
| **Backend** | Optional / disabled locally | `lib/supabase/*` retained for auth/profile reference; local-first path is primary |
| **Deploy** | Vercel web SPA | `npm run build` → `dist/` |

### Vercel / Web Export

| File | Contract |
|------|----------|
| `package.json` | `"build": "npx expo export --platform web"` · `"web": "expo start --web"` |
| `app.json` | `"platforms": ["web"]` only · `"web": { "bundler": "metro", "output": "single" }` · plugins: `expo-router` only |
| `vercel.json` | `buildCommand` + `outputDirectory: dist` + SPA rewrite → `index.html` |
| `metro.config.js` | NativeWind v4 / Metro web pipeline |

**Do not** add iOS/Android build assumptions or native config plugins for CI unless native ship returns.

---

## 3. Active Routing

```text
app/
├── index.tsx                 # → /(tabs)/home
├── (auth)/
│   ├── index.tsx             # email access
│   └── foundation.tsx        # foundation scan
├── (tabs)/
│   ├── _layout.tsx           # Home · Nutrition · Command
│   ├── home.tsx              # Daily Command: Iron block + Nutrition placeholder
│   ├── analytics.tsx         # Nutrition/Consistency/Passport surface
│   └── profile.tsx           # Command Center
└── (workout)/
    ├── _layout.tsx
    ├── daily_scan.tsx        # readiness gate
    ├── iron.tsx              # Iron execution
    ├── ascension.tsx         # completion sync/return
    └── summary.tsx           # Iron session summary
```

Deleted active routes:

- `app/(workout)/combat.tsx`
- `app/(workout)/spirit.tsx`
- `app/(tabs)/mastery.tsx`

---

## 4. Zustand Contract

| Field | Purpose |
|-------|---------|
| `weeklyMicrocycle` | 7-day `MicrocycleDay[]` (Mon–Sun) |
| `selectedDayIndex` | Active strip day (1–7) |
| `performance_logs` / `performanceQueue` | Local Iron history and pending sync |
| `user_biological` | Biological passport + Iron frequency/time + nutrition placeholder |
| `gameplan_source` | `'local'` \| `'deterministic'` \| `'stub'` \| `'fallback'` |
| `gameplan_error` | Local Head Coach failure surface |
| `fetchDailyGameplanAsync` | Sole owner of `weeklyMicrocycle` generation |
| `logIronSet` | Writes Iron set logs with reported RIR |

### Canonical Types

| Type | Current shape |
|------|---------------|
| `WorkoutPillar` | `'iron' \| 'nutrition'` |
| `WorkoutPillarLog` | `'iron' \| 'nutrition'` |
| `BiologicalProfile` | `goal_iron`, `nutrition_goal`, `frequency_iron`, `available_time_iron`, Iron telemetry fields |
| `GameplanBlock` | `iron?: IronBlockPrescription`, `nutrition?: NutritionBlockPrescription` |
| `UserStats` | `iron_sessions_completed`, `nutrition_checkins_completed` |

Removed fields from active types/store:

- `frequency_combat`, `frequency_spirit`
- `available_time_combat`, `available_time_spirit`
- `goal_combat`, `goal_flow`, `goal_spirit`
- `body_essence`, `mind_essence`, `spirit_essence`, `combat_mastery`

---

## 5. Head Coach Data Path

```text
app/index.tsx → /(tabs)/home
LocalBootstrap → seed default athlete → fetchDailyGameplanAsync
fetchDailyGameplanAsync
  → fetchDailyGameplan (lib/gameplan/fetchDailyGameplan.ts)
      → generateDeterministicGameplan (lib/gameplan/engine/)
          → fetchLibraryExercises()
          → user_biological + performance_logs + user_stats
          → Iron engine / legacy Iron builder
      → finalize gameplan ordering
  → weeklyMicrocycle in Zustand
  → Home strip → Iron workout
```

Post-workout:

```text
Iron set log → reported RIR → performance_logs
completeWorkout / flushPerformanceQueue
  → lib/local/recalibrate.ts
  → fetchDailyGameplan({ forceRefresh: true })
  → merge block statuses + refreshed microcycle
```

---

## 6. Deterministic Iron Engine

Hardcoded periodization in `lib/gameplan/engine/` — **no LLM for standard generation**.

| Rule domain | Implementation |
|-------------|----------------|
| **Weekly layout** | `spreadPillarDayIndices(frequency_iron)` only |
| **Active days** | 0–7 Iron days per microcycle from `frequency_iron` |
| **Catalog** | `library_exercises` only via `fetchLibraryExercises()` |
| **Iron splits** | Push / Pull / Legs / Upper / Lower / Full Body focus rotation |
| **Heuristic 6x engine** | `generateIronMicrocycle()` using `ConstraintSolver`, `CoherenceValidator`, PPL split |
| **Other frequencies** | Existing Iron block builder path remains in `prescription.ts` |
| **Hypertrophy volume** | `targetIronExerciseCount(minutes, goal_iron)` |
| **Mesocycle / load** | 21d logs → Epley E1RM, reported RIR → RPE, MEV/MRV caps |
| **Autoregulation** | stress, CNS score, yesterday RPE, load telemetry poor recovery |
| **Validation** | Iron block count must match `frequency_iron` or throw `DEGENERATE_MICROCYCLE` |

Do not break these files without running tests/typecheck:

- `lib/gameplan/engine/iron/ConstraintSolver.ts`
- `lib/gameplan/engine/iron/CoherenceValidator.ts`
- `lib/gameplan/engine/iron/generateIronMicrocycle.ts`
- `lib/gameplan/engine/iron/loadPrescriptionMapper.ts`
- `lib/gameplan/engine/iron/splits/pplSplit.ts`
- `lib/gameplan/engine/iron/types.ts`

---

## 7. Catalog

Active catalog:

| Table / source | Purpose |
|----------------|---------|
| `library_exercises` | Iron exercise encyclopedia and biomechanical instructions |
| `lib/catalog/bundledCatalog.ts` | Local bundled Iron fallback |
| `lib/catalog/library.ts` | `fetchLibraryExercises()`, `prefetchLibraryCatalogs()`, `resolveBlockPreviewLabel()` |

Deprecated catalogs are ignored by active code:

- `library_combat`
- `library_flow_spirit`

**Seed rule:** Never `ON CONFLICT DO UPDATE SET id = excluded.id` for exercise seeds; it can break `performance_logs.exercise_id`.

---

## 8. UI Surfaces

| Surface | File | Current responsibility |
|---------|------|------------------------|
| Daily Command | `app/(tabs)/home.tsx` | Weekly strip, Iron block cards, Nutrition placeholder, clinical review |
| Nutrition | `app/(tabs)/analytics.tsx` | Passport, consistency, Iron telemetry detail, future nutrition surface |
| Command | `app/(tabs)/profile.tsx` | Iron frequency, Iron time budget, Nutrition placeholder controls |
| Iron workout | `app/(workout)/iron.tsx` | Exercise execution, target load, RIR gate, set logging |
| Readiness | `app/(workout)/daily_scan.tsx` | Subjective readiness; low score reduces Iron loads |
| Ascension | `app/(workout)/ascension.tsx` | Completion sync, graceful return |
| Summary | `app/(workout)/summary.tsx` | Iron volume, CNS fatigue, E1RM unlocks |

### Iron Load UX

| State | UI |
|-------|-----|
| E1RM / logged history | Target load banner with kg and optional RIR-derived hint |
| No history | Calibrate first set (`target_weight_kg: null`) |
| Set completion | `RirSelector` captures reported RIR (0–4) |

### Load Telemetry

| Metric | Window | Use |
|--------|--------|-----|
| **ACWR** | 7d acute / 28d chronic sRPE | Autoregulation and UI highlight |
| **RPE mean / sigma** | 14d Iron sessions | Detect chronic high effort / low variation |
| **Global RPE** | Iron only | Clinical Exit Interview prefill |

**Do not** add LLM, wearable APIs, or external services for load telemetry. Extend `lib/physics/loadTelemetry.ts`.

---

## 9. Cleanup Status

The active codebase was cleaned to remove old pillars from:

- routing
- tabs
- Home UI
- Zustand store
- `types/biological.ts`
- `types/gameplan.ts`
- `types/performance.ts`
- deterministic gameplan engine
- catalog layer
- parser/stub gameplan
- load telemetry
- workout summary
- old component folders
- old hooks/constants/audio/breathwork helpers

Verification already run after cleanup:

```powershell
npx tsc --noEmit
```

Result: passed.

Lints in edited directories: no linter errors found.

Search verification in active directories:

```text
app, components, constants, hooks, lib, store, types
```

No active matches for removed pillar terms/fields:

- old pillar names
- `library_combat`
- `library_flow_spirit`
- removed biological/store fields

Allowed residuals:

- historical docs / migrations / edge functions may still mention old schema
- `iron_mastery` remains valid because it belongs to the Iron engine

---

## 10. Known Debt

| Area | Status |
|------|--------|
| Edge functions | May still contain historical multi-pillar logic; client does not depend on Edge for local generation |
| Supabase migrations | Historical schema still includes removed columns; local-first app no longer requires them |
| Nutrition | Placeholder only; needs future data model and UI |
| Catalog import | Iron `setup` phase keys may still need regeneration where `merged_steps` is empty |
| Build gate | Run `npm run build` before deploy |

---

## 11. Fresh-Session Checklist

1. Read **§1 Product Scope** first: SOMMA is Iron + Nutrition only.
2. Do not reintroduce old pillars or old catalogs in active code.
3. Preserve the Iron engine under `lib/gameplan/engine/iron/*`.
4. For generation, use `frequency_iron` and `available_time_iron` only.
5. For catalog work, use `library_exercises` only.
6. For telemetry, use Iron logs/RIR only.
7. Run `npx tsc --noEmit` after substantive changes.
8. Run `npm run build` before Vercel deploy.

---

*End of Context Anchor V8.*
