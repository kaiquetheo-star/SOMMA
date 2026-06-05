# SOMMA — Offline Performance Sync Test

Manual verification for offline-first queue drain and Elite Coach catalog integrity (migrations `001`–`010`).

## Prerequisites

- Migrations `001`–`010` applied in Supabase (see §Migration checklist)
- Seeds in order: `seed.sql` → `seed_hypertrophy.sql` → `seed_combat_tactical.sql` → `seed_flow_spirit_healer.sql`
- `generate_daily_protocol` deployed with `OPENROUTER_API_KEY`
- Test account with completed Foundation Scan
- Device or simulator with network toggle (airplane mode)

### Migration checklist

| Order | File | Verify |
|-------|------|--------|
| 1–7 | `001`–`007` | Core schema, catalogs, flow/spirit DDL |
| 8 | `008_iron_biomechanics.sql` | `library_exercises.primary_muscle`, `cns_fatigue_cost` |
| 9 | `009_library_combat_tactical.sql` | `library_combat.tactical_focus` |
| 10 | `010_library_flow_spirit_healer.sql` | `target_recovery_zones`, `complexity_tier` |

### Catalog row counts (SQL Editor)

```sql
select count(*) filter (where primary_muscle is not null) as iron_biomech
from library_exercises;
-- expect >= 49

select count(*) filter (where tactical_focus is not null) as combat_tactical
from library_combat;
-- expect >= 25

select count(*) filter (where target_recovery_zones is not null) as flow_healer
from library_flow_spirit;
-- expect >= 22
```

## Test 1 — Offline workout completion

1. Sign in and open **Daily Command** with a loaded protocol.
2. Enable **airplane mode** (or disable Wi‑Fi).
3. Start any block (Iron, Combat, or Spirit) and complete through **Ascension**.
4. Return to **Daily Command** — block should show completed locally.
5. **Attunement Orbs** should brighten the matching pillar channel (Iron → Body, Combat → Combat, Spirit → Spirit).
6. In dev tools / React Native debugger, inspect Zustand persist key `somma-offline-store`:
   - `performance_logs` contains the session
   - `performanceQueue` has one pending item

**Expected:** App does not crash; home still renders; no Supabase errors block navigation.

## Test 2 — Queue drain on reconnect

1. With pending items in `performanceQueue`, disable airplane mode.
2. Background the app, then foreground it (or cold restart).
3. `PerformanceSyncBridge` calls `flushPerformanceQueue()` on `AppState` → `active`.

**Expected:**

- `performance_syncing` briefly true on home
- Supabase **Table Editor → performance_logs** shows new row(s)
- `performanceQueue` empty after successful sync
- Optional: gameplan refreshes if Edge Function returns blocks

## Test 3 — resetStore integrity

1. Open **Analytics** tab → reset profile / sign out flow that calls `resetStore()`.
2. Confirm redirect to Foundation Scan.
3. No ghost blocks on home after re-onboarding.

## Test 4 — DB-driven Iron (online)

1. **Recalibrate** on home with network on.
2. In Supabase, verify `daily_protocols.blocks` includes `iron.exercises[]` with UUID `exercise_id`s.
3. Inspect Elite Coach fields: `target_rep_range`, `target_rir`, `rest_seconds`, `alternative_exercise_id`.
4. Start Iron block — exercise name should match `library_exercises` (hypertrophy seed), not local slug fallback only.
5. **Adapt** swaps to `alternative_exercise_id` without network.
6. Rest timer uses `prescription.rest_seconds` from CNS (60–180s range).

## Test 5 — Tactical Combat (online)

1. Recalibrate; verify `combat.rounds_structure[]` and per-round `tactical_focus` in `daily_protocols`.
2. Start Combat — full-screen arena, adaptive combo callouts, **bundled** bell at round transitions (works in airplane mode).
3. Complete session → Ascension → `performance_logs` with `pillar: combat`.

## Test 6 — Flow / Spirit Healer (online)

1. Complete Iron or Combat within 48h (or use test logs), then **Recalibrate**.
2. Spirit block should have `mode: "flow"`, `asanas[]` with `hold_seconds`, `recovery_focus_zones`.
3. Spirit screen: Deep Obsidian `#0A0E0C`, gesture nav, auto-Ascension on last pose.
4. `performance_logs` row with `pillar: flow` or `spirit` as logged by client.

## Test 7 — user_stats Realtime (optional)

1. With app on **Daily Command** and network on, update `user_stats` in Supabase Table Editor (e.g. bump `body_essence`).
2. Orbs should reflect new essence without app restart (`useUserStatsRealtime`).

**Note:** Requires Realtime enabled for `user_stats` in Supabase Dashboard → Database → Replication.

## Failure signals

| Symptom | Likely cause |
|---------|----------------|
| 404 on insert | Run `005_performance_logs.sql` |
| Empty exercise names | Run `seed.sql` + `seed_hypertrophy.sql` |
| No `tactical_focus` on combat | Run `009` + `seed_combat_tactical.sql` |
| Flow block has no `asanas` | Run `010` + `seed_flow_spirit_healer.sql`; redeploy Edge Function |
| Queue never drains | Not signed in, or `flushPerformanceQueue` not firing — check `PerformanceSyncBridge` |
| CORS on recalibrate | Redeploy Edge Function |
| No combat bell offline | Ensure `assets/audio/combat/*.wav` present; rebuild app after adding cues |
| Orbs never update from server | Enable Realtime on `user_stats` or rely on local completion glow only |
