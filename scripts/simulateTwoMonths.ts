#!/usr/bin/env -S npx tsx

import { createRequire } from 'node:module';

import type { BiologicalProfile } from '../types/biological';
import type { DailyGameplan, IronExercisePrescription, MicrocycleDay } from '../types/gameplan';
import type { PerformanceLogEntry } from '../types/performance';
import type { EquipmentTag, FocusPreference, UserStats } from '../store/useSommaStore';

const require = createRequire(import.meta.url);

type SimulationBiological = BiologicalProfile & {
  available_equipment: EquipmentTag[];
};

type RuntimeImports = {
  generateDeterministicGameplan: typeof import('../lib/gameplan/engine/generateDeterministicGameplan').generateDeterministicGameplan;
  computeTrainingLoadSnapshot: typeof import('../lib/physics/loadTelemetry').computeTrainingLoadSnapshot;
};

type WeekSnapshot = {
  week: number;
  gameplan: DailyGameplan;
  totalSets: number;
  aggressiveTechniqueCount: number;
  benchPressWeight: number | null;
};

const focus: FocusPreference = {
  iron: 100,
  nutrition: 100,
};

const userStats: UserStats = {
  iron_sessions_completed: 0,
  nutrition_checkins_completed: 0,
};

const requiredTrainingDays = [1, 2, 3, 5, 6, 7];
const loadLedger = new Map<string, number>();

const mockBiological: SimulationBiological = {
  date_of_birth: '1994-05-14',
  height_cm: 159,
  weight_kg: 58,
  body_fat_percentage: null,
  current_body_fat_estimate: null,
  current_injuries: null,
  experience_level: 'ADVANCED',
  training_days_per_week: 6,
  frequency_iron: 6,
  available_time_iron: 90,
  baseline_stress_level: 3,
  available_equipment: ['full_gym'],
  goal_iron: 'Hypertrophy',
  nutrition_goal: 'Hypertrophy support',
  iron_mastery: 5,
  clinical_exit_interview: null,
  hormonal_transition: false,
};

function installNodeRuntimeShims(): void {
  Object.assign(globalThis, { __DEV__: false });

  const store = new Map<string, string>();
  const asyncStorageMock = {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    clear: async () => {
      store.clear();
    },
  };
  const reactNativeMock = {
    Platform: {
      OS: 'web',
      select: <T>(options: { web?: T; default?: T }) => options.web ?? options.default,
    },
  };

  const Module = require('node:module') as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
  };
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === '@react-native-async-storage/async-storage') {
      return { __esModule: true, default: asyncStorageMock, ...asyncStorageMock };
    }
    if (request === 'expo-document-picker') {
      return {
        getDocumentAsync: async () => ({ canceled: true, assets: [] }),
      };
    }
    if (request === 'react-native') {
      return reactNativeMock;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`QA ASSERTION FAILED: ${message}`);
  }
}

function assertNoLegacyBiologicalKeys(profile: object): void {
  const legacyKeys = ['target_archetype', 'mesocycle_week'].filter((key) => key in profile);
  assert(
    legacyKeys.length === 0,
    `mockBiological nao deve conter campos legados: ${legacyKeys.join(', ')}`,
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function currentWeekMonday(): Date {
  const today = new Date();
  const monday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12));
  const day = monday.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday;
}

function biologicalForWeek(week: number): BiologicalProfile {
  const { available_equipment: _availableEquipment, ...biological } = mockBiological;
  const fatigueWeek = week === 5;
  return {
    ...biological,
    baseline_stress_level: fatigueWeek ? 8 : week === 6 ? 6 : 3,
  };
}

function ironExercisesForDay(day: MicrocycleDay): IronExercisePrescription[] {
  return day.blocks.flatMap((block) => block.iron?.exercises ?? []);
}

function allIronExercises(microcycle: MicrocycleDay[]): IronExercisePrescription[] {
  return microcycle.flatMap(ironExercisesForDay);
}

function exerciseLabel(exercise: IronExercisePrescription): string {
  return exercise.display_name ?? exercise.slug ?? exercise.exercise_id;
}

function techniqueKey(exercise: IronExercisePrescription): string {
  return (exercise.execution_technique ?? 'Standard').toLowerCase().replace(/[\s-]/g, '_');
}

function isAggressiveTechnique(exercise: IronExercisePrescription): boolean {
  const technique = techniqueKey(exercise);
  return technique.includes('drop_set') || technique.includes('rest_pause');
}

function isFinisherOrIsolation(exercise: IronExercisePrescription): boolean {
  const slug = exercise.slug ?? '';
  const technique = techniqueKey(exercise);
  return (
    technique.includes('myo_reps') ||
    technique.includes('drop_set') ||
    /fly|pec_deck|leg_extension|leg_curl|curl|raise|pushdown|extension|face_pull|calf/i.test(slug)
  );
}

function isCompoundLike(exercise: IronExercisePrescription): boolean {
  const slug = exercise.slug ?? '';
  return /bench|press|squat|deadlift|row|pulldown|pull_up|chin_up|lunge|hip_thrust|hack|leg_press/i.test(
    slug,
  );
}

function isChinOrPullUp(exercise: IronExercisePrescription): boolean {
  return /chin_up|pull_up/i.test(exercise.slug ?? '');
}

function assertWeekPrescription(gameplan: DailyGameplan, week: number): void {
  for (const dayIndex of requiredTrainingDays) {
    const day = gameplan.microcycle.find((entry) => entry.day_index === dayIndex);
    assert(day, `Semana ${week}: dia ${dayIndex} nao foi gerado.`);
    assert(
      ironExercisesForDay(day).length > 0,
      `Semana ${week}: dia ${dayIndex} (${day.focus_label}) gerou exercises: [].`,
    );
  }

  for (const day of gameplan.microcycle) {
    for (const exercise of ironExercisesForDay(day)) {
      if (isFinisherOrIsolation(exercise)) {
        assert(
          exercise.target_sets <= 4,
          `Semana ${week}: ${exerciseLabel(exercise)} tem ${exercise.target_sets} sets como isolador/finisher (>4).`,
        );
      }
    }
  }

  const bodyweightPulls = allIronExercises(gameplan.microcycle).filter(isChinOrPullUp);
  for (const exercise of bodyweightPulls) {
    assert(
      exercise.loading_protocol === 'weighted' || techniqueKey(exercise).includes('rest_pause'),
      `Semana ${week}: ${exerciseLabel(exercise)} deveria sugerir WEIGHTED ou REST_PAUSE para atleta avancada.`,
    );
  }
}

function baselineLoadForExercise(exercise: IronExercisePrescription): number {
  const slug = exercise.slug ?? '';
  if (/bench_press|chest_press/i.test(slug)) return 40;
  if (/squat|leg_press|hack/i.test(slug)) return 55;
  if (/deadlift|romanian_deadlift|hip_thrust/i.test(slug)) return 60;
  if (/row|pulldown|pull_up|chin_up/i.test(slug)) return exercise.loading_protocol === 'weighted' ? 10 : 35;
  if (/overhead_press/i.test(slug)) return 25;
  if (/curl|raise|pushdown|extension|fly|face_pull|calf/i.test(slug)) return 12.5;
  return 25;
}

function progressionJumpKg(exercise: IronExercisePrescription, week: number): number {
  if (week >= 4) return 0;
  return isCompoundLike(exercise) ? 5 : 2.5;
}

function resolveLoggedWeight(exercise: IronExercisePrescription, week: number): number {
  const previous = loadLedger.get(exercise.exercise_id);
  const prescribed = exercise.target_weight_kg ?? previous ?? baselineLoadForExercise(exercise);
  const logged = Math.max(0, prescribed + progressionJumpKg(exercise, week));
  loadLedger.set(exercise.exercise_id, logged);
  return Math.round(logged * 10) / 10;
}

function reportedRirForSet(week: number, exercise: IronExercisePrescription, setIndex: number): number {
  if (week === 4) {
    return isCompoundLike(exercise) && setIndex >= Math.max(1, exercise.target_sets - 1) ? 0 : 1;
  }
  if (week === 5) return 3;
  return setIndex === exercise.target_sets ? 1 : 2;
}

function simulateWorkoutCompletion(microcycle: MicrocycleDay[], week: number): PerformanceLogEntry[] {
  const logs: PerformanceLogEntry[] = [];

  for (const day of microcycle) {
    for (const block of day.blocks) {
      const exercises = block.iron?.exercises ?? [];
      for (const exercise of exercises) {
        const loggedWeight = resolveLoggedWeight(exercise, week);
        const targetReps = exercise.target_reps ?? 10;
        const completedAt = `${day.date ?? dateKey(addDays(currentWeekMonday(), day.day_index - 1))}T18:00:00.000Z`;
        const setCount = Math.max(1, exercise.target_sets);
        const sets = Array.from({ length: setCount }, (_, index) => {
          const setIndex = index + 1;
          const reportedRir = reportedRirForSet(week, exercise, setIndex);
          const fatigueRepPenalty = week === 4 && reportedRir === 0 ? 2 : 0;
          return {
            set_index: setIndex,
            weight_kg: loggedWeight,
            reps: Math.max(1, targetReps - fatigueRepPenalty),
            target_reps: targetReps,
            target_rir: exercise.target_rir ?? null,
            reported_rir: reportedRir,
            rest_seconds_used: exercise.rest_seconds ?? 90,
            logged_at: completedAt,
          };
        });

        logs.push({
          id: `sim-w${week}-d${day.day_index}-${exercise.exercise_id}`,
          pillar: 'iron',
          block_id: block.id,
          iron: {
            block_id: block.id,
            exercise_id: exercise.exercise_id,
            exercise_name: exerciseLabel(exercise),
            sets,
            completed_at: completedAt,
          },
          timestamp: completedAt,
        });
      }
    }
  }

  return logs;
}

function totalPrescribedSets(gameplan: DailyGameplan): number {
  return allIronExercises(gameplan.microcycle).reduce((sum, exercise) => sum + exercise.target_sets, 0);
}

function aggressiveTechniqueCount(gameplan: DailyGameplan): number {
  return allIronExercises(gameplan.microcycle).filter(isAggressiveTechnique).length;
}

function findBenchPressWeight(gameplan: DailyGameplan): number | null {
  return (
    allIronExercises(gameplan.microcycle).find((exercise) =>
      /barbell_bench_press|bench_press/i.test(exercise.slug ?? ''),
    )?.target_weight_kg ?? null
  );
}

function findFirstExerciseLine(gameplan: DailyGameplan, dayPattern: RegExp): string | null {
  const day = gameplan.microcycle.find((entry) => dayPattern.test(entry.focus_label));
  const exercise = day ? ironExercisesForDay(day)[0] : null;
  if (!day || !exercise) return null;
  const weight = exercise.target_weight_kg != null ? `${exercise.target_weight_kg}kg` : 'calibracao inicial';
  return `${day.focus_label.replace('Iron: ', '')}: ${exerciseLabel(exercise)} prescrito a ${weight}.`;
}

function printWeekSummary(
  snapshot: WeekSnapshot,
  previousSnapshot: WeekSnapshot | null,
  loadTelemetry: ReturnType<RuntimeImports['computeTrainingLoadSnapshot']>,
): void {
  const bench = snapshot.benchPressWeight != null ? `${snapshot.benchPressWeight}kg` : 'calibracao';
  const pushLine = findFirstExerciseLine(snapshot.gameplan, /Push/i);
  const nutritionRest = snapshot.gameplan.microcycle
    .find((day) => day.is_rest_day)
    ?.blocks.find((block) => block.nutrition)?.nutrition?.nutrition_target;

  if (snapshot.week === 4) {
    console.log(`\n🗓️ SEMANA 4: Acumulo de Fadiga Detectado`);
    console.log(`  - Stress Level simulado: 8/10.`);
    console.log(`  - Logs mostram falha tecnica (RIR 0) em compostos.`);
    console.log(`  - Telemetria pre-execucao: ACWR ${loadTelemetry.pillars.iron.acwr ?? 'n/a'} · RPE medio ${loadTelemetry.globalRpeMean ?? 'n/a'}.`);
    return;
  }

  if (snapshot.week === 5) {
    const reduction =
      previousSnapshot && previousSnapshot.totalSets > 0
        ? Math.round((1 - snapshot.totalSets / previousSnapshot.totalSets) * 100)
        : 0;
    const deloadConfirmed =
      (previousSnapshot != null && snapshot.totalSets / previousSnapshot.totalSets <= 0.65) ||
      snapshot.aggressiveTechniqueCount === 0;
    console.log(
      `\n⚠️ SEMANA 5: ${
        deloadConfirmed ? 'AUTO-DELOAD TRIGGERED PELO MOTOR' : 'AUTO-DELOAD NAO CONFIRMADO PELO MOTOR'
      }`,
    );
    console.log(`  - Volume de series reduzido em ${Math.max(0, reduction)}%.`);
    console.log(
      `  - Tecnicas agressivas restantes: ${snapshot.aggressiveTechniqueCount} (Drop-set/Rest-pause esperados como 0 em recuperacao).`,
    );
    if (nutritionRest) {
      console.log(`  - Nutricao: ${nutritionRest.carbs_g}g de carboidratos no dia de descanso.`);
    }
    return;
  }

  const label = snapshot.week === 8 ? 'Recuperacao e Nova Progressao' : 'Progressao Normal';
  console.log(`\n🗓️ SEMANA ${snapshot.week}: ${label}`);
  if (pushLine) console.log(`  - ${pushLine}`);
  console.log(`  - Bench Press monitorado: ${bench}.`);
  console.log(`  - Tecnicas: ${snapshot.aggressiveTechniqueCount} estrategia(s) avancada(s) no microciclo.`);
}

function autoDeloadFinding(previous: WeekSnapshot, current: WeekSnapshot): string | null {
  const reductionRatio = previous.totalSets > 0 ? current.totalSets / previous.totalSets : 1;
  if (reductionRatio <= 0.65 || current.aggressiveTechniqueCount === 0) return null;
  return `Semana 5 deveria reduzir volume (~50%) ou remover tecnicas agressivas. Volume ${previous.totalSets} -> ${current.totalSets}; tecnicas agressivas: ${current.aggressiveTechniqueCount}.`;
}

async function simulateTwoMonths(): Promise<void> {
  installNodeRuntimeShims();
  assertNoLegacyBiologicalKeys(mockBiological);

  const { generateDeterministicGameplan } = require('../lib/gameplan/engine/generateDeterministicGameplan') as Pick<
    RuntimeImports,
    'generateDeterministicGameplan'
  >;
  const { computeTrainingLoadSnapshot } = require('../lib/physics/loadTelemetry') as Pick<
    RuntimeImports,
    'computeTrainingLoadSnapshot'
  >;

  const startMonday = currentWeekMonday();
  const performanceLogs: PerformanceLogEntry[] = [];
  const snapshots: WeekSnapshot[] = [];
  const qaFindings: string[] = [];

  console.log('SOMMA · Simulacao avancada de 8 semanas');
  console.log(`Perfil mockado: 32 anos · 159cm · 58kg inicial · ADVANCED · 6x/semana · full_gym`);
  console.log('Campos legados: target_archetype/mesocycle_week ausentes no mockBiological.');

  for (let week = 1; week <= 8; week += 1) {
    const protocolDate = dateKey(addDays(startMonday, (week - 1) * 7));
    const biological = biologicalForWeek(week);
    const loadTelemetry = computeTrainingLoadSnapshot(performanceLogs, {
      goalIron: biological.goal_iron,
    });

    const gameplan = await generateDeterministicGameplan({
      focus,
      equipment: mockBiological.available_equipment,
      biological,
      userStats,
      performanceLogs,
      protocolDate,
    });

    assertWeekPrescription(gameplan, week);

    const snapshot: WeekSnapshot = {
      week,
      gameplan,
      totalSets: totalPrescribedSets(gameplan),
      aggressiveTechniqueCount: aggressiveTechniqueCount(gameplan),
      benchPressWeight: findBenchPressWeight(gameplan),
    };
    snapshots.push(snapshot);

    if (week === 5) {
      const previous = snapshots.find((entry) => entry.week === 4);
      assert(previous, 'Semana 5 precisa comparar contra a semana 4.');
      const finding = autoDeloadFinding(previous, snapshot);
      if (finding) qaFindings.push(finding);
    }

    printWeekSummary(snapshot, snapshots[snapshots.length - 2] ?? null, loadTelemetry);
    performanceLogs.push(...simulateWorkoutCompletion(gameplan.microcycle, week));
  }

  const week1Bench = snapshots[0]?.benchPressWeight;
  const week8Bench = snapshots[7]?.benchPressWeight;
  if (week1Bench != null && week8Bench != null) {
    assert(
      week8Bench >= week1Bench,
      `Bench Press deveria manter ou progredir apos recuperacao: semana 1 ${week1Bench}kg, semana 8 ${week8Bench}kg.`,
    );
  }

  if (qaFindings.length > 0) {
    console.log('\n❌ SIMULACAO DE 2 MESES CONCLUIDA COM ACHADOS DE QA:');
    qaFindings.forEach((finding) => console.log(`  - ${finding}`));
    throw new Error(`${qaFindings.length} achado(s) de QA detectado(s).`);
  }

  console.log('\n✅ SIMULACAO DE 2 MESES CONCLUIDA: progressao, fadiga e simplificacoes validadas.');
}

simulateTwoMonths().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
