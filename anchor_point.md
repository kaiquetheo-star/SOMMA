# SOMMA V8 Anchor Point

Atualizado em: 2026-06-02

Este arquivo resume o que foi implementado até agora nas fases SOMMA V8 executadas nesta sessão. O foco foi manter o Head Coach 100% determinístico, local-first, TypeScript strict, sem alterar `seed_hypertrophy.sql`.

## Fase 1 — Fundação de Dados e X-Frame Bias

Objetivo: enriquecer o catálogo de exercícios em memória com metadados para viés estético X-Frame e experiência Text-Only Elite.

Arquivos principais:

- `types/catalog.ts`
  - Adicionados `ExerciseTempo`, `ExerciseFailureType`, `ExerciseCueCard`, `XFrameCatalogMetadata`.
  - Criado `CatalogExercise = LibraryExercise & XFrameCatalogMetadata`.
  - Campos derivados:
    - `selection_score`
    - `tempo`
    - `cue_card`

- `lib/gameplan/engine/iron/xFrameBias.ts`
  - Criado `XFRAME_BIAS_CONFIG`.
  - Pesos:
    - `deltoid_lateral`: `3.0`
    - `pectoralis_major_clavicular`: `2.5`
    - `latissimus_dorsi_vertical`: `2.5`
    - `quadriceps_vastus_lateral_bias`: `2.0`
    - `hamstrings_glutes`: `1.5`
    - `default`: `1.0`
  - Blacklist:
    - `lateral_flexion`
    - `weighted_oblique_isolation`
    - `high_load_rectus_abdominis`
  - Funções:
    - `calculateSelectionScore`
    - `isXFrameBlacklisted`

- `lib/catalog/biomechanicalMapper.ts`
  - Criada `enrichExerciseWithCues(rawExercise)`.
  - Lê `biomechanical_instructions`.
  - Mapeia `setup`, `concentric`, `eccentric`, `safety` para `cue_card`.
  - Aplica defaults determinísticos por `movement_pattern`.
  - Aplica `calculateSelectionScore`.

- `lib/catalog/bundledCatalog.ts`
  - `getBundledExercises()` agora retorna exercícios enriquecidos em memória.

- `lib/catalog/library.ts`
  - Linhas vindas do loader também passam por `enrichExerciseWithCues`.

- `lib/gameplan/engine/iron/catalog/ExerciseCatalog.ts`
  - Builder do catálogo Iron preserva `selection_score`, `tempo`, `cue_card`.

Teste:

- `__tests__/catalog/xFrameBias.test.ts`
  - Valida `cable_lateral_raise` com score `3.0`.
  - Valida `barbell_back_squat` com score `>= 2.0`, tempo `[3, 1, 'X', 0]`, falha técnica.
  - Valida blacklist de flexão lateral com halter.

## Fase 2 — Constraint Solver e Weekly Volume Tracker

Objetivo: implementar o cérebro heurístico determinístico para preencher slots com volume semanal, recovery mode, hard filters e scoring X-Frame.

Arquivos principais:

- `lib/gameplan/engine/iron/WeeklyVolumeTracker.ts`
  - Constantes:
    - `MEV = 10`
    - `MRV_SOFT = 18`
    - `MRV_HARD = 22`
    - `SYNERGIST_FRACTION = 0.5`
  - `creditVolume` soma:
    - `sets * 1.0` para `primary_muscle`
    - `sets * 0.5` para cada sinergista
  - Calcula ACWR a partir de `logs7d` e janela crônica.
  - `isRecoveryMode = true` quando:
    - `acwr > 1.5`
    - ou `biological.hormonal_transition === true`
  - `canAddSets` bloqueia acima de `MRV_HARD`, ou acima de `MEV` em recovery mode.

- `lib/gameplan/engine/iron/ConstraintSolver.ts`
  - Hard filters:
    - equipamento disponível
    - blacklist de cintura
    - conflito HIIT antes de legs
    - recovery mode com filtro de CNS/joint stress
    - anti-duplicata determinística
  - Scoring:
    - `selection_score * 1000`
    - penalidade de sinergista redundante
    - penalidade por CNS
    - boost para músculo abaixo do MEV
  - Desempate determinístico por `exercise.slug`.

- `lib/gameplan/engine/iron/types.ts`
  - `SolverConstraints` expandido com:
    - `available_equipment`
    - `previousDayWasHiit`
    - `usedExerciseIds`
    - `dailyIronFocus`
  - `SolverState` expandido com `isRecoveryMode`.

- `lib/gameplan/engine/iron/generateIronMicrocycle.ts`
  - Tracker agora recebe `logs7d`, `logs21d` e `biological`.

Teste:

- `__tests__/gameplan/iron/solver.test.ts`
  - Cenário A: prioriza `cable_lateral_raise`.
  - Cenário B: recovery mode rejeita `barbell_back_squat` e escolhe opção baixa em CNS.
  - Cenário C: pós-HIIT bloqueia squat/hinge/lunge em legs.
  - Cenário D: anti-duplicata bloqueia `face_pull` repetido.

## Fase 3 — DUP e Text-Only Elite Cues

Objetivo: aplicar Periodização Ondulatória Diária e garantir que tempo/cues fluam para a UI sem vídeos.

Arquivos principais:

- `lib/gameplan/engine/iron/dupLogic.ts`
  - Criada `getDailyIronFocus(dayIndex, split)`.
  - Matriz DUP:
    - Push/Pull A: `metabolic_hypertrophy`, reps `[8, 12]`, tempo `[3, 0, 1, 1]`
    - Legs A: `pure_mechanical_tension`, reps `[5, 8]`, tempo `[3, 1, 'X', 0]`
    - Push/Pull B: `stretch_mediated`, reps `[10, 15]`, tempo `[3, 1, 1, 1]`
    - Legs B: `unilateral_stability`, reps `[10, 12]`, tempo `[2, 1, 1, 1]`

- `lib/gameplan/engine/iron/cueMapper.ts`
  - Criada `mapToExerciseCueCard(exercise, dayFocus)`.
  - Lê `biomechanical_instructions`.
  - Fallbacks determinísticos por `movement_pattern` e `dayFocus`.
  - Resolve `failure_type`:
    - compostos/CNS alto: `technical`
    - isoladores: `concentric`

- `lib/gameplan/engine/iron/loadPrescriptionMapper.ts`
  - Prescrição agora aplica faixa de reps do DUP.
  - Injeta:
    - `slug`
    - `tempo`
    - `cue_card`
    - `progression_note`

- `types/gameplan.ts`
  - `IronExercisePrescription` expandido com:
    - `slug`
    - `tempo`
    - `cue_card`

- `lib/gameplan/engine/iron/generateIronMicrocycle.ts`
  - Chama `getDailyIronFocus` antes de resolver slots.
  - Passa foco DUP para solver e mapper.
  - Reaplica foco após autocorreções de coerência.

- `lib/gameplan/engine/iron/splits/pplSplit.ts`
  - Legs B ganhou slot `unilateral_stability`.

- `lib/gameplan/engine/iron/catalog/ExerciseCatalog.ts`
  - `CatalogExercise` do motor preserva `biomechanical_instructions`.

- `lib/gameplan/engine/iron/ConstraintSolver.ts`
  - Scoring agora considera bônus DUP:
    - Legs A favorece compostos pesados.
    - Legs B favorece unilaterais/baixo CNS.
    - Stretch days favorecem exercícios `stretch_mediated_hypertrophy`.

Teste:

- `__tests__/gameplan/iron/dupAndCues.test.ts`
  - Cenário A: PPLx2 com Legs A em 5-8 reps e Legs B em 10-12 reps com unilateral.
  - Cenário B: `barbell_back_squat` em Legs A recebe tempo `[3, 1, 'X', 0]` e falha técnica.
  - Cenário C: exercício sem JSONB recebe fallback seguro por `movement_pattern`.

## Validações Executadas

Comandos já executados com sucesso:

```sh
npx tsc --noEmit
npx vitest run "__tests__/catalog/xFrameBias.test.ts"
npx vitest run "__tests__/gameplan/iron/solver.test.ts"
npx vitest run "__tests__/gameplan/iron/dupAndCues.test.ts"
```

Resultado consolidado:

- TypeScript strict: passou.
- Fase 1: 3 testes passaram.
- Fase 2: 4 testes passaram.
- Fase 3: 3 testes passaram.

## Invariantes Mantidas

- `seed_hypertrophy.sql` não foi modificado.
- A lógica nova vive na camada TypeScript de aplicação.
- O app continua local-first.
- Não foi introduzido `Math.random()`.
- A estrutura principal do `weeklyMicrocycle` foi preservada.
- O motor Iron continua determinístico e testável.

## Próxima Fase Prevista

Fase 4 — Termodinâmica, Macros e UI Final.

Escopo esperado:

- metas calóricas e macros por tipo de dia
- carb cycling
- hidratação/eletrólitos
- integração com superfície de Nutrition/UI
