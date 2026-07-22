# SOMMA — Anchor Point 2 (Estado Atual do Motor)

**Data:** 2026-07-22  
**Escopo:** codebase local-first (Expo SDK 54 / web).  
**Verificação:** `npx tsc --noEmit` ✅ · Iron + regression + catalog → **38 files / 154 tests** ✅  

Este documento é a fonte de verdade do **estado atual do Head Coach Iron**.  
`anchor_point.md` (2026-06-03) está **histórico/deprecated**.

> **Linha do tempo**
> - **2026-07-16** — Lobotomia fechada (Sprints A–D): sem punição por fadiga/ACWR/readiness; motor linear único.
> - **2026-07-22** — Elite Coach Brain: metadados táticos, ordem clínica, dose ABCDE Dia 2 (quads/calves).

---

## 1. Veredito executivo

| Área | Estado | Notas |
|------|--------|-------|
| TypeScript strict | Saudável | Zero erros |
| Suite Iron + catalog + regression | Saudável | 154/154 no escopo citado |
| Motor linear (ABCDE×5 / PPL×6) | Saudável | Sem composeRecovery; double progression pura |
| Elite coach (ordem + dose + shear) | Saudável | Sissy nunca abre; panturrilha 1+1 com 6 sets |
| Punição por fadiga | Fechada | Autoreg/readiness/CNS score neutralizados (Sprint A) |
| Cloud / Edge Head Coach | Desligado | `LOCAL_FIRST_MODE`; Edge arquivada |
| Documentação histórica | Deprecated | `anchor_point.md` → apontar aqui |

**Conclusão:** o Head Coach é **100% local, determinístico e linear**. O “treino aleatório” observado no ABCDE Dia 2 era **metadado + template + sanitize**, não RNG nem LLM.

---

## 2. Arquitetura atual do motor

### 2.1 Pipeline linear

```
generateDeterministicGameplan
  → generateIronMicrocycle (ABCDE/PPL templates + ConstraintSolver + WeeklyVolumeTracker)
  → pruneIronDayBlockPicks (time budget)
  → injectMinimumViableIronPicks
  → finalizeIronDayBlockPrescriptions / mapToIronPrescription (double progression)
  → applyIntensityStrategies
  → adaptGameplan (ASM — sem cortes de volume por readiness/RPE)
  → sanitizeMicrocycleIronVolume (budget; exceção panturrilha até 6)
  → enforceWeeklyAuthority (MRV_SOFT, maxSetsSession, Constitution floors)
  → applyNeuroMechanicalOrderingToMicrocycle (5-phase clinical matrix)
```

### 2.2 Gate do split

| Split | Frequência canônica | Comportamento |
|-------|---------------------|---------------|
| `abcde` | 5 | Templates `abcdeSplit.ts` (calendário 1,2,4,5,6 Iron · 3,7 Rest) |
| `ppl_x2` | 6 | Templates PPL |
| `abcdef` | legado | Normalizado → `abcde` + freq 5 na geração |
| Outras freqs | — | Rotação heurística do próprio motor Iron (sem `buildIronBlock` legado) |

### 2.3 O que a lobotomia removeu (permanente)

- Recovery composition / ACWR / `isRecoveryMode` governando volume  
- Cortes de volume por readiness/RPE  
- `poor_recovery` set cuts / swaps por CNS score  
- Edge Function como segundo Head Coach  
- UI de readiness obrigatória  

**Única descarga automática:** semanas 4 e 6 via `phase_budget` (ver `docs/DELOAD_POLICY.md`).

### 2.4 Modifiers hormonais

`resolveVolumeLimitsForSplit(split, biological)`:

- `hormonal_protocol.type === 'trt'` **ou** `hormonal_transition === true`  
  - `MRV_SOFT × 1.2` · `MRV_HARD × 1.15`  
- TRT também eleva tetos por exercício em `volumePeriodization` (ABCDE).

---

## 3. Elite Coach Brain (2026-07-22)

### 3.1 Diagnóstico do bug “treino aleatório”

Não havia aleatoriedade. Causas estruturais:

1. **Sissy Squats** no catálogo com `movement_pattern: squat` → enrichment marcava `primary_compound` → matriz clínica abria a sessão com ele.  
2. **Template Dia 2** pedia `calf_raise×2` + `calf_raise_seated×1` (3 movimentos).  
3. **Sanitize** cortava panturrilha 6 → 4 (`MAX_FINISHER_OR_ISOLATION_SETS`), furando MEV de gastroc.  
4. **Hack/Belt** não creditavam `quadriceps_rectus` no mapa anatômico → MEV de reto femoral dependia de Sissy.

### 3.2 Regras de coach agora codificadas

| Lei | Comportamento |
|-----|----------------|
| Composto primeiro | Isoladores / high knee shear **nunca** fase 2 da matriz clínica |
| Sissy = finisher | `movement_pattern: isolation`, `tactical_role: isolation_metabolic` |
| Shear no joelho | Soft penalty no `scoreExerciseCandidate` (−1800); não abre sessão |
| Panturrilha ABCDE Dia 2 | **1 standing + 1 seated**, dose **6 sets** cada (MEV, não spam) |
| Preferência de máquina | Pin `leg_extension` em `quad_isolation`; pin calves Elite |
| Alias starvation | `tactical_role` reconciliado com `movement_pattern`; extensions → rectus |
| Sanitize vs dose | Panturrilha pode ir até **6** sets (exceção ao teto genérico de iso 4) |

### 3.3 ABCDE Dia 2 (quads · calves) — contrato

```
slots: quad_compound×2, quad_isolation×2, calf_raise×1, calf_raise_seated×1
ordem esperada: compostos → isoladores de quad → standing calf → seated calf
abrir com Sissy / high_knee_shear: PROIBIDO
panturrilhas na sessão: ≤ 2
```

Testes: `__tests__/gameplan/iron/eliteCoach.test.ts` + `__tests__/regression/physiologicalGuarantees.test.ts`.

### 3.4 Arquivos tocados (Elite Coach)

```
lib/catalog/eliteCatalog.ts                 # sissy → isolation
lib/catalog/tacticalEnrichment.ts           # rules sissy/leg_extension + fallback shear
lib/catalog/eliteAnatomicalMap.ts           # hack/belt creditam rectus
lib/gameplan/engine/clinicalMatrix.ts       # isolation antes de tactical_role mentiroso
lib/gameplan/engine/iron/ConstraintSolver.ts# score shear + pins + calf dose
lib/gameplan/engine/iron/catalog/ExerciseCatalog.ts  # role reconciliado com pattern override
lib/gameplan/engine/iron/catalog/starvationAliases.ts # role + rectus em extensions
lib/gameplan/engine/iron/splits/abcdeSplit.ts         # Dia 2 calves 1+1, defaultSets 6
lib/gameplan/microcycleValidation.ts        # sanitize permite calf ≤6
```

---

## 4. Constitution floors & volume

| Camada | Regra |
|--------|--------|
| `setFloors.ts` | Compound ≥ **2** · Isolation ≥ **1** |
| `enforceWeeklyAuthority` | Único trim semanal MRV / max session; respeita floors |
| ABCDE natural (não-deload) | Compound 4–5 · Iso 3–4 (budget); **calves até 6** via slot+sanitize |
| Sub-grupos | Primary 1.0 · secondary heads 0.5 · synergist ~0.33 |
| Cap hormonal maintenance | ≤ **7** exercícios/dia |

---

## 5. O que NÃO está quebrado (manter)

- **WeeklyVolumeTracker** — ledger slug-first, MEV/MRV matrix.  
- **Double progression** no mapper Iron (+2.5% / hold reps).  
- **X-Frame bias**, anti-duplicata, equipment filter, waist blacklist.  
- **DUP / ABCDE / PPL** cobertos por testes.  
- **Hormonal MRV boost** (TRT / transition).  
- **Time pruning** — orçamento de tempo, não fadiga.  
- **Offline-first** (`LOCAL_FIRST_MODE`) — sem Supabase.  
- **Barreiras de lobotomia** — `lobotomyBarriers.test.ts`.  
- **Garantias fisiológicas** — `physiologicalGuarantees.test.ts`.

---

## 6. Dívida restante (não bloqueante)

| Item | Severidade | Nota |
|------|------------|------|
| Aliases starvation vs Elite em alguns slots | P2 | Pin de `leg_extension` mitiga; aliases ainda podem aparecer como 2º iso |
| Shells/histórico de recovery em docs antigas | P3 | `SOMMA - REGRAS .md`, scripts de simulação |
| `lib/supabase/**` empacotável | P3 | Morto em runtime local-first |
| Copy Spirit/Healer em rest days | P3 | Calendário, não fadiga |

---

## 7. Determinismo e higiene

| Check | Resultado |
|-------|-----------|
| RNG no path ABCDE Iron | Ausente |
| `Math.random` no ConstraintSolver | Não |
| Head Coach LLM/cloud | Desligado |
| Strict TS | Passa |
| Elite + physiology + lobotomy barriers | Passam |

---

## 8. Histórico de sprints (lobotomia 2026-07-16)

### Sprint A — Fechar a lobotomia ✅
- Autoreg `poor_recovery` neutralizado; readiness no-op; CNS score não persiste.  
- Motor heurístico único para splits conhecidos.  
- Barreiras em `lobotomyBarriers.test.ts`.

### Sprint B — Dead code ✅
- Flags recovery/CNS, levers, injector, UI readiness removidos/simplificados.

### Sprint C — Cloud / docs ✅
- Edge arquivada; `anchor_point.md` histórico; `docs/DELOAD_POLICY.md`.

### Sprint D — Barreiras ✅
- freq≠canônica sem set cuts; readiness não muda carga; ACWR não troca compostos.

### Sprint E — Elite Coach Brain ✅ (2026-07-22)
- Metadados + matriz clínica + Dia 2 ABCDE + dose de panturrilha + MEV rectus/gastroc.

---

## 9. Mapa rápido de arquivos quentes

```
lib/gameplan/engine/generateDeterministicGameplan.ts  # orquestrador linear
lib/gameplan/engine/iron/generateIronMicrocycle.ts     # split → slots → solver
lib/gameplan/engine/iron/ConstraintSolver.ts           # score + pins + calf dose
lib/gameplan/engine/iron/splits/abcdeSplit.ts          # templates ABCDE
lib/gameplan/engine/clinicalMatrix.ts                  # ordem 5 fases
lib/gameplan/engine/iron/volumeAuthority.ts            # MRV + session cap + floors
lib/gameplan/engine/iron/volumeMatrix.ts               # MEV/MRV + boost hormonal
lib/gameplan/engine/iron/loadPrescriptionMapper.ts     # double progression
lib/gameplan/microcycleValidation.ts                   # sanitize (calf ≤6)
lib/catalog/eliteCatalog.ts                           # seed Elite offline
lib/catalog/tacticalEnrichment.ts                     # tactical_role
lib/catalog/eliteAnatomicalMap.ts                     # sub-grupos MEV
lib/config.ts                                         # LOCAL_FIRST_MODE=true
```

---

## 10. Snapshot de confiança

| Camada | Confiança | Motivo |
|--------|-----------|--------|
| Geração Iron canônica | Alta | 154 testes no escopo Iron/regression/catalog |
| Progressão de carga | Alta | DP sem RPE |
| Volume semanal / MRV | Alta | authority + matrix + physiology |
| Ordem de sessão (coach) | Alta | clinical matrix + eliteCoach tests |
| Dose panturrilha ABCDE | Alta | slot 6 + sanitize exception + MEV |
| “Nenhuma punição por fadiga” | Alta | Sprint A + barriers |
| Paridade Edge/cloud | N/A | Desligada |
| Doc `anchor_point.md` | Baixa | Histórica |

---

## 11. Decisões de produto — vigentes

1. Readiness: informativo no máximo; **nunca** corta carga.  
2. ACWR: não governa volume.  
3. Path legado `buildIronBlock`: removido.  
4. Deload week 4/6: única descarga automática.  
5. `cns_fatigue_score`: fora do passport ativo.  
6. Elite coach: **composto → secundário → isolador → finisher**; volume por **dose**, não por spam de exercícios.  
7. ABCDE Dia 2: no máximo **2** panturrilhas (gastroc + soleus).

---

*Atualizado 2026-07-22 após Elite Coach Brain. Verificação: `tsc --noEmit` + vitest Iron/regression/catalog (154). Não altera `seed_hypertrophy.sql` além do row Sissy no `eliteCatalog.ts` bundled.*
