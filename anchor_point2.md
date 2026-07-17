# SOMMA — Anchor Point 2 (Auditoria Completa)

**Data:** 2026-07-16  
**Escopo:** codebase local-first (Expo SDK 54 / web), pós-lobotomia do motor Iron (remoção recovery/ACWR/readiness volume cuts).  
**Verificação automática:** `npx tsc --noEmit` ✅ · `npx vitest run` → **31 files / 117 tests** ✅  

Este documento substitui o papel de “estado atual do motor” do `anchor_point.md` (2026-06-03), que **está desatualizado** em vários pontos (ainda descreve ACWR, recovery mode, e cortes de volume).

> **Atualização — Sprints B/C/D concluídos:** flags e shells de recovery removidos;
> readiness e ACWR retirados da UI; fallback Iron legado apagado; Edge Function
> arquivada/desativada; `cns_fatigue_score` removido do modelo ativo. Semanas 4
> e 6 são a única descarga automática, sempre por `phase_budget`.

---

## 1. Veredito executivo

| Área | Estado | Notas |
|------|--------|-------|
| TypeScript strict | Saudável | Zero erros |
| Suite Iron + catalog | Saudável | 117/117 |
| Motor linear (path ABCDE×5 / PPL×6 / ABCDEF×6) | Saudável | Sem composeRecovery; double progression pura |
| Leftovers de fadiga | **Aberto** | Autoreg legado + readiness UI ainda podem punir |
| Código morto / stubs | **Alto** | Recovery shell, flags órfãs, cloud stack |
| Documentação | **Dívida** | `anchor_point.md` contradiz o código atual |

**Conclusão:** o núcleo Iron pós-lobotomia está coerente e testado, mas a lobotomia **não foi 100% end-to-end**. Ainda existem vias paralelas (legado `prescription.ts`, Clinical Law II, recalibrate CNS, Edge Function) que implementam punição por fadiga/stress/ACWR. Em splits/frequências fora do motor heurístico, o usuário ainda pode cair no path legado.

---

## 2. Arquitetura atual do motor (pós-lobotomia)

### 2.1 Path principal (heurístico)

```
generateDeterministicGameplan
  → generateIronMicrocycle (ConstraintSolver + WeeklyVolumeTracker)
  → buildIronGameplanBlock / loadPrescriptionMapper (double progression)
  → pruneIronBlocksInMicrocycle (time budget)
  → injectMinimumViableIronWorkouts
  → injectRecoveryProtocols (NO-OP)
  → applyIntensityStrategies
  → adaptGameplan (ASM — volume cuts de readiness/RPE já são no-op)
  → sanitizeMicrocycleIronVolume
  → enforceWeeklyAuthority (MRV_HARD→SOFT, maxSetsSession, floor 2 sets)
```

### 2.2 Gate do motor heurístico

`usesHeuristicIronEngine` em `generateDeterministicGameplan.ts`:

| Split | Frequência exigida | Senão |
|-------|-------------------|--------|
| `abcde` | **exatamente 5** | cai no legado `buildIronBlock` |
| `ppl_x2` | **exatamente 6** | legado |
| `abcdef` (e outros) | **exatamente 6** | legado |

**Risco P1:** usuário com ABCDE e `frequency_iron ≠ 5` (ou PPL ≠ 6) recebe o motor **legado**, que ainda aplica `detectIronAutoregulation` / `poor_recovery` (swap CNS alto, −1 set, RIR↑, técnica alterada). Isso pode parecer “treino quebrado” mesmo após a lobotomia.

### 2.3 O que foi removido de verdade

- `lib/gameplan/engine/iron/recoveryComposition.ts` — **apagado**
- ACWR / `isRecoveryMode` do `WeeklyVolumeTracker`
- `applyRecoveryVolumeMultiplier` (0.7×)
- Cortes de volume por readiness/RPE na `enforceWeeklyAuthority`
- Healer Zone / deload de carga no `recoveryInjector` (agora no-op)
- Gate `needsDailyReadinessScan()` → sempre `false`
- `reduceVolumeForHighCnsFatigue` em `volumePeriodization`
- Hard block recovery/CNS session budget no `ConstraintSolver` (CNS só penaliza score)

### 2.4 Modifiers hormonais (único boost de volume de matriz)

`resolveVolumeLimitsForSplit(split, biological)`:

- `hormonal_protocol.type === 'trt'` **ou** `hormonal_transition === true`
  - `MRV_SOFT × 1.2`
  - `MRV_HARD × 1.15`

Cobertura de teste: `__tests__/gameplan/iron/linearProgression.test.ts` + `volumeMatrix.test.ts`.

---

## 3. Lógica ainda quebrada / inconsistente (prioridade)

> **Atualização 2026-07-16:** os itens P0 abaixo foram **resolvidos no Sprint A** (ver §8). Mantidos como registro histórico da auditoria.

### P0 — Ainda pune fadiga (fuga da lobotomia) — ✅ RESOLVIDO

1. **`detectIronAutoregulation` + `applyIronRoutineAutoregulation`** (`lib/gameplan/engine/prescription.ts`)  
   - Dispara `poor_recovery` com: `cns_fatigue_score ≥ limiar`, stress ≥ 7, RPE ontem ≥ 8, **`telemetrySuggestsPoorRecovery` (ACWR spike / RPE crônico)**.  
   - Em poor recovery: **troca exercícios de CNS alto** e, no builder legado, **reduz sets** e sobe RIR.  
   - Ainda chamado em **todo** `generateDeterministicGameplan` (mesmo no path heurístico, para `baseRoutine` / MVP inject / blocked joints).

2. **`applyReadinessAutoregulationToMicrocycle`** (`clinicalLaws.ts`)  
   - Continua aplicando **−15% de carga** se o usuário submeter readiness via `daily_scan` / `applySubjectiveReadiness`.  
   - Gate de obrigatoriedade foi desligado, mas a **ação voluntária ainda pune**.

3. **`recalibrateFromPerformanceQueue` / sync**  
   - Continua incrementando `user_biological.cns_fatigue_score`.  
   - Esse score alimenta `detectIronAutoregulation` → poor_recovery → swaps/cortes no path legado.

4. **ASM logs mentirosos** (`adaptiveStateMachine.ts`)  
   - `applyHighRpeVolumeReduction` / `applyReadinessScanAdaptation` não cortam volume, mas ainda empurram `adaptation_logs` com `action_taken: 'defer_volume_to_recovery_composition'` e `volume_penalty` — **recovery composition não existe mais**. Logs mentem para debug/UI.

### P1 — Paths dual / edge cases

5. **Dual engine (heurístico vs legado)** — ver §2.2. Comentário em `ironPrescriptionLegacy.ts` ainda diz “until Phase 5”; na prática é fallback silencioso.

6. **`buildIronBlock` legado** ainda usa RPE da sessão anterior para −5% / +2.5% (`prescription.ts` ~L279–289), enquanto o mapper Iron já é double progression sem RPE. Dois modelos de progressão convivem.

7. **Deload de mesocycle** (`volumePeriodization` + `computeTrainingLoadSnapshot.is_deload_week`)  
   - Continua ativo via phase budget week 4/6. Isso é **calendário**, não fadiga subjetiva — OK se intencional; mas `injectRecoveryProtocols` não aplica mais o −15% de carga no deload. Deload agora depende só de budgets/`sanitizeMicrocycleIronVolume`. **Comportamento mudou** sem doc clara.

8. **`applyCyclePhaseVolumeMultiplier` (ASM)**  
   - Semanas 5–8: **+15% sets** com mensagem “Durateston phase support”. Hardcoded hormonal fantasy — pode inflar volume independentemente do passport hormonal.

### P2 — Código morto / shells vazios

9. **`isRecoveryMode`** permanece em `SolverState` / `types.ts`, sempre `false`. Flags `ignoreRecoveryMode` / `ignoreCnsBudget` ainda passadas em dezenas de call sites sem efeito real no budget CNS (filtro CNS session removido).

10. **`lastReportedRpe`** em `loadPrescriptionMapper.ts` — função **definida e nunca chamada** (morta pós-lobotomia).

11. **`recoveryInjector.ts`** — API preservada (`injectRecoveryProtocols`, `isInjectorDeloadActive`) mas corpo no-op. Call sites ainda passam telemetry/deload.

12. **`detectReadinessVolumeLever` / `detectHighRpeVolumeLever`** — sempre `false`, `@deprecated`, ainda exportados.

13. **`motorTelemetry`** — ainda modela `recovery_levers_fired` / `RecoveryLeverId`; emit sem levers → sempre `"none"`. Ruído de telemetria.

14. **`generateStubGameplan.ts`** — nome mentiroso; só exporta `isProtocolDateStale`. Stub de gameplan inexistente.

15. **`lib/supabase/**` + Edge `generate_daily_protocol`**  
   - `LOCAL_FIRST_MODE = true` / `isSupabaseConfigured = false`.  
   - Stack cloud (~auth, sync, cnsFatigue, edge function monólito) é **peso morto no runtime web**, mas ainda empacotável. Edge function é um **segundo Head Coach** desatualizado (ainda fala em cns/autoreg clássico).

16. **UI readiness**  
   - `app/(workout)/daily_scan.tsx`, modal na Home, `useRequireDailyScan`, `LoadTelemetryStrip` (ACWR na analytics/profile).  
   - Gate desligado → deep-link scan nunca força; mas UI/docs ainda vendem “Clinical Law II”.

17. **`adaptationLogs` no Zustand** — populados; pouco consumo de UI aparente; poluídos por logs fantasma (§3.4).

---

## 4. Inventário de código morto / legado (por pasta)

### Motor Iron
| Item | Tipo | Ação sugerida |
|------|------|----------------|
| `recoveryInjector.ts` no-op | Shell | Remover call site ou renomear `passthroughMicrocycle` |
| `isRecoveryMode` + `ignoreRecoveryMode` | Dead field/flag | Remover do tipo e call sites |
| `ignoreCnsBudget` (sem filtro CNS) | Dead flag | Remover |
| `lastReportedRpe` | Dead fn | Apagar |
| `detect*VolumeLever` | Dead exports | Apagar |
| Comentários “recoveryComposition” no ASM | Stale | Limpar / remover passes no-op |
| `motorTelemetry` levers | Stale model | Simplificar para deload/MVP/coherence only |

### Prescription / legacy
| Item | Tipo | Ação sugerida |
|------|------|----------------|
| `ironPrescriptionLegacy.ts` | Re-export thin | Manter só se fallback for explícito |
| `exercisePoolSelection` / `ironBlueprints` | Usado no legado + edge | Isolar atrás de feature flag ou deletar path legado |
| Autoreg `poor_recovery` set cut | **Lógica viva indesejada** | Neutralizar alinhado à lobotomia |

### Clinical / store
| Item | Tipo | Ação sugerida |
|------|------|----------------|
| `applyReadinessAutoregulationToMicrocycle` | Viva se scan manual | Remover ou tornar no-op |
| `needsDailyReadinessScan` always false | Stub | Remover hook + rota ou marcar “optional future” |
| `cns_fatigue_score` updates | Vivo | Parar de mutar se não há consumidor de volume |
| `showReadinessModal` / Home card | UI viva | Decisão produto: esconder vs opcional |

### Cloud
| Item | Tipo | Ação sugerida |
|------|------|----------------|
| `lib/supabase/*` | Dead no local-first | Quarentena / tree-shake / delete phase |
| `supabase/functions/generate_daily_protocol` | Fork antigo do motor | Arquivar ou reescrever a partir do client engine |
| `AuthProvider` + auth screens | Semi-morto | Local-first bypass; limpar copy “check .env” |

### Docs / scripts
| Item | Tipo | Ação sugerida |
|------|------|----------------|
| `anchor_point.md` | Desatualizado | Marcar deprecated → apontar para este arquivo |
| `SOMMA - REGRAS .md` (ACWR healer) | Desatualizado | Revisar |
| `scripts/simulateTwoMonths.ts` | Ainda modela fadiga CNS | Atualizar cenários |

---

## 5. O que NÃO está quebrado (manter)

- **WeeklyVolumeTracker** — ledger slug-first, MEV/MRV matrix, cap 8 sets/log anomaly.
- **enforceWeeklyAuthority** — MRV overflow + session cap + floor 2.
- **Double progression** no mapper Iron (+2.5% / hold reps).
- **X-Frame bias**, anti-duplicata, equipment filter, waist blacklist.
- **DUP / ABCDE / ABCDEF / PPL splits** cobertos por testes.
- **Hormonal MRV boost** (TRT / transition).
- **Time pruning** (`volumePruning`) — orçamento de tempo, não fadiga.
- **Damage Control** — só nutrição, fora do Iron.
- **Offline-first** (`LOCAL_FIRST_MODE`) — gameplan local sem Supabase.
- **Testes de regressão linear** — `linearProgression.test.ts` (TRT, logs pesados, double progression, sem readiness).

---

## 6. Inconsistências de produto / UX

1. Home ainda mostra **“Registrar Readiness”** e sugere Clinical Law II, mas o motor **não exige** scan e (idealmente) não deveria cortar volume. Se o usuário registrar score baixo via `daily_scan`, **ainda perde 15% de carga** no dia selecionado.
2. Analytics/Profile mostram **ACWR strip** (`LoadTelemetryStrip`) — telemetria informativa OK, mas sem doc de que **não governa mais volume**.
3. Rest days ABCDE ainda injetam **Healer Zone / Spirit** como protocolo padrão de calendário (não via injector de fadiga) — alinhado ao pedido “Spirit padrão”, mas copy ainda fala “CNS downshift”.
4. Mensagens ASM “Durateston” e “defer_volume_to_recovery_composition” são **ruído clínico** se vazarem para UI futura.

---

## 7. Determinismo e higiene

| Check | Resultado |
|-------|-----------|
| `Math.random` no engine Iron | Não encontrado |
| `Date.now()` em filters de logs / ASM cutoffs | Presente — OK para janelas relativas; testes usam timestamps fixos |
| `seed_hypertrophy.sql` | Não alterado pela lobotomia |
| Strict TS | Passa |

---

## 8. Plano de limpeza recomendado (ordem)

### Sprint A — Fechar a lobotomia (P0) ✅ CONCLUÍDO (2026-07-16)
1. ✅ `detectIronAutoregulation` neutralizado — `poor_recovery`/`high_stress_mode` sempre `false`; só `blocked_joint_profiles` (lesão) sobrevive.
2. ✅ `applyReadinessAutoregulationToMicrocycle` é no-op — readiness scan é informativo, nunca corta carga.
3. ✅ `recalibrateFromPerformanceQueue` retorna `cns_fatigue_score: null` sempre — score nunca mais é acumulado/persistido pelo fluxo local.
4. ✅ ASM limpo — `applyHighRpeVolumeReduction`, `applyReadinessScanAdaptation`, `hasHighRpeSpike` e levers deprecated removidos; zero logs `defer_volume_to_recovery_composition`.
5. ✅ `usesHeuristicIronEngine` — splits conhecidos (abcde/abcdef/ppl_x2) sempre usam o motor Iron; path legado `buildIronBlock` nunca mais é fallback silencioso (freq ≠ canônica cai em rotação PPL do próprio motor heurístico).
6. ✅ Testes de barreira: `__tests__/gameplan/iron/lobotomyBarriers.test.ts` (5 testes) — fadiga máxima não ativa autoreg; freq 4 + abcde gera semana completa via Iron engine; readiness 1 não altera `target_weight_kg`; ACWR spike não troca compostos; swap por lesão preservado.

### Sprint B — Dead code (P2) ✅ CONCLUÍDO
6. ✅ `lastReportedRpe`, flags recovery/CNS e levers removidos.
7. ✅ `motorTelemetry` reduzida a deload/MVP/coherence; injector apagado.
8. ✅ `generateStubGameplan.ts` renomeado para `protocolFreshness.ts`.
9. ✅ UI e gate de readiness removidos; dado histórico não altera carga.

### Sprint C — Cloud / docs ✅ CONCLUÍDO
10. ✅ `anchor_point.md` marcado como histórico.
11. ✅ Edge Function desativada; pasta mantém apenas aviso de arquivo.
12. ✅ Deload calendário documentado em `docs/DELOAD_POLICY.md`.

### Sprint D — Testes de barreira
13. Teste: `frequency_iron=4` + `preferred_split=abcde` **não** deve ativar poor_recovery set cuts.
14. Teste: `applySubjectiveReadiness(1)` **não** altera `target_weight_kg`.
15. Teste: ACWR spike em telemetry **não** troca compostos no path heurístico.

---

## 9. Mapa rápido de arquivos quentes

```
lib/gameplan/engine/generateDeterministicGameplan.ts   # orquestrador + gate dual
lib/gameplan/engine/prescription.ts                    # P0 autoreg legado
lib/gameplan/engine/adaptiveStateMachine.ts            # logs fantasma + Durateston
lib/gameplan/engine/clinicalLaws.ts                    # −15% readiness
lib/gameplan/engine/iron/WeeklyVolumeTracker.ts         # limpo
lib/gameplan/engine/iron/volumeAuthority.ts             # limpo + floor 2
lib/gameplan/engine/iron/volumeMatrix.ts                # boost hormonal
lib/gameplan/engine/iron/loadPrescriptionMapper.ts      # DP + dead lastReportedRpe
lib/gameplan/engine/iron/recoveryInjector.ts            # no-op
lib/gameplan/engine/iron/ConstraintSolver.ts            # flags mortas
lib/local/recalibrate.ts                               # ainda sobe CNS score
store/useSommaStore.ts                                 # readiness UI state
app/(tabs)/home.tsx                                    # modal readiness
hooks/useRequireDailyScan.ts                           # morto efetivo
lib/config.ts                                          # LOCAL_FIRST_MODE=true
```

---

## 10. Snapshot de confiança

| Camada | Confiança | Motivo |
|--------|-----------|--------|
| Geração Iron (split canônico) | Alta | 106+ testes Iron + linearProgression |
| Progressão de carga (path Iron) | Alta | DP sem RPE |
| Volume semanal / MRV | Alta | authority + matrix |
| “Nenhuma punição por fadiga em lugar nenhum” | **Alta (pós Sprint A)** | Autoreg neutralizado, readiness no-op, CNS score não persiste; barreiras testadas |
| Paridade Edge/cloud | N/A | Desligada no produto local-first |
| Doc histórica (`anchor_point.md`) | Baixa | Contradiz código |

---

## 11. Decisões de produto — resolvidas

1. Readiness scan: UI removida.
2. ACWR: removido de Analytics/Profile.
3. Path legado (`buildIronBlock`): apagado.
4. Deload week 4/6: única descarga automática, por budget de fase.
5. `cns_fatigue_score`: removido do passport, sync e schema futuro.

---

*Gerado por auditoria estática + execução de `tsc` / `vitest` em 2026-07-16. Não altera `seed_hypertrophy.sql`. Próximo passo natural: Sprint A (fechar P0) e atualizar testes de barreira.*
