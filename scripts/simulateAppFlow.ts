#!/usr/bin/env -S npx tsx

import { createRequire } from 'node:module';

import type { EquipmentTag, FocusPreference } from '../store/useSommaStore';
import {
  initialBiologicalProfile,
  isBiologicalProfileComplete,
  type BiologicalProfile,
} from '../types/biological';
import type { IronExercisePrescription, MicrocycleDay } from '../types/gameplan';

const require = createRequire(import.meta.url);

const SUCCESS_MESSAGE =
  '✅ SIMULAÇÃO DE SUCESSO: O microciclo está biomecanicamente coerente e livre de anomalias.';

const focusPreference: FocusPreference = {
  iron: 100,
  nutrition: 100,
};

const availableEquipment: EquipmentTag[] = ['full_gym'];

const biologicalProfile: BiologicalProfile = {
  ...initialBiologicalProfile,
  date_of_birth: '1996-01-01',
  weight_kg: 57,
  height_cm: 170,
  body_fat_percentage: null,
  current_body_fat_estimate: null,
  current_injuries: null,
  baseline_stress_level: 3,
  goal_iron: 'Hypertrophy',
  nutrition_goal: 'Hypertrophy support',
  training_days_per_week: 6,
  frequency_iron: 6,
  available_time_iron: 90,
  experience_level: 'advanced',
  iron_mastery: 5,
  cns_fatigue_score: 0,
  hormonal_transition: false,
};

function fail(message: string, day?: MicrocycleDay): never {
  console.error(`❌ SIMULAÇÃO FALHOU: ${message}`);
  if (day) {
    console.error(`JSON do Dia ${day.day_index}:`);
    console.error(JSON.stringify(day, null, 2));
  }
  throw new Error(message);
}

function dayByIndex(microcycle: MicrocycleDay[], dayIndex: number): MicrocycleDay {
  const day = microcycle.find((entry) => entry.day_index === dayIndex);
  if (!day) fail(`Dia ${dayIndex} não encontrado no weeklyMicrocycle.`);
  return day;
}

function ironExercisesForDay(day: MicrocycleDay): IronExercisePrescription[] {
  return day.blocks.flatMap((block) => block.iron?.exercises ?? []);
}

function techniqueName(exercise: IronExercisePrescription): string {
  return (exercise.execution_technique ?? '').toLowerCase();
}

function isMyoRepOrFinisher(exercise: IronExercisePrescription): boolean {
  const technique = techniqueName(exercise);
  return technique.includes('myo-reps') || technique.includes('finisher');
}

function exerciseLabel(exercise: IronExercisePrescription): string {
  return exercise.display_name ?? exercise.slug ?? exercise.exercise_id;
}

function techniqueDetail(exercise: IronExercisePrescription): string {
  const technique = techniqueName(exercise);
  if (technique.includes('drop_set')) return ' (Last set: -20% load to failure)';
  if (technique.includes('rest_pause')) return ' (Last set: 15s rest-pause to technical failure)';
  return '';
}

function printDaySummary(day: MicrocycleDay): void {
  const exercises = ironExercisesForDay(day);

  console.log(`\nDia ${day.day_index} — ${day.focus_label} (Rest Day: ${day.is_rest_day})`);
  if (day.is_rest_day) {
    console.log('  🛌 Rest & Recovery - Biological Fueling only');
    return;
  }

  exercises.forEach((exercise, index) => {
    const reps = exercise.target_rep_range ?? `${exercise.target_reps} reps`;
    const technique = exercise.execution_technique ?? 'Standard';
    const loading =
      exercise.loading_protocol === 'weighted'
        ? ` | Loading: WEIGHTED (+${exercise.target_weight_kg ?? 10}kg)`
        : exercise.loading_protocol
          ? ` | Loading: ${exercise.loading_protocol.toUpperCase()}`
          : '';
    console.log(
      `  ${index + 1}. ${exerciseLabel(exercise)} — ${exercise.target_sets} sets x ${reps} | Execution: ${technique}${techniqueDetail(exercise)}${loading}`,
    );
  });
}

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

async function simulateAppFlow(): Promise<void> {
  installNodeRuntimeShims();

  const { generateDeterministicGameplan } = require('../lib/gameplan/engine/generateDeterministicGameplan') as typeof import('../lib/gameplan/engine/generateDeterministicGameplan');
  const { useSommaStore } = require('../store/useSommaStore') as typeof import('../store/useSommaStore');

  // Import contract check: this script must point at the same deterministic engine used by the app.
  if (typeof generateDeterministicGameplan !== 'function') {
    throw new Error('generateDeterministicGameplan não foi importada corretamente.');
  }

  if (!isBiologicalProfileComplete(biologicalProfile)) {
    throw new Error('Perfil biológico de simulação incompleto; a geração do app seria ignorada.');
  }

  const store = useSommaStore.getState();

  await store.resetStore();

  const resetState = useSommaStore.getState();
  if (
    resetState.performance_logs.length > 0 ||
    resetState.performanceQueue.length > 0 ||
    resetState.weeklyMicrocycle !== null
  ) {
    throw new Error('resetStore não deixou logs, fila e weeklyMicrocycle completamente limpos.');
  }

  const originalFetchDailyGameplanAsync = resetState.fetchDailyGameplanAsync;
  useSommaStore.setState({
    fetchDailyGameplanAsync: async () => {
      // completeFoundationScan fires generation in the app; this CLI runs one explicit fetch below.
    },
  });

  useSommaStore.getState().completeFoundationScan({
    focus_preference: focusPreference,
    available_equipment: availableEquipment,
    biological: biologicalProfile,
  });

  useSommaStore.setState({ fetchDailyGameplanAsync: originalFetchDailyGameplanAsync });

  const foundationState = useSommaStore.getState();
  if (foundationState.performance_logs.length > 0 || foundationState.performanceQueue.length > 0) {
    throw new Error('Foundation scan contaminou o tracker com performance logs/fila não vazios.');
  }

  await useSommaStore.getState().fetchDailyGameplanAsync({ forceRefresh: true });

  const { weeklyMicrocycle, gameplan_error } = useSommaStore.getState();
  const biologicalKeys = Object.keys(useSommaStore.getState().user_biological);
  const legacyBiologicalKeys = biologicalKeys.filter((key) =>
    ['target_archetype', 'mesocycle_week'].includes(key),
  );
  if (legacyBiologicalKeys.length > 0) {
    throw new Error(`user_biological ainda contém campos legados: ${legacyBiologicalKeys.join(', ')}`);
  }
  if (gameplan_error) {
    throw new Error(`Erro na geração do gameplan: ${gameplan_error}`);
  }
  if (!weeklyMicrocycle) {
    throw new Error('weeklyMicrocycle não foi populado após fetchDailyGameplanAsync.');
  }

  const day5 = dayByIndex(weeklyMicrocycle, 5);
  const day7 = dayByIndex(weeklyMicrocycle, 7);
  const day5Exercises = ironExercisesForDay(day5);

  if (day5Exercises.length <= 0) {
    fail('Assert 1: Dia 5 (Push B) está com iron.exercises vazio.', day5);
  }

  for (const day of weeklyMicrocycle) {
    if (!day.is_rest_day && ironExercisesForDay(day).length < 4) {
      fail(
        `Assert 4: Dia ${day.day_index} tem menos de 4 exercícios de Iron em um protocolo de 90 minutos.`,
        day,
      );
    }
  }

  for (const day of weeklyMicrocycle) {
    for (const exercise of ironExercisesForDay(day)) {
      const technique = techniqueName(exercise);
      const isAdvancedFinisher =
        isMyoRepOrFinisher(exercise) ||
        technique.includes('drop_set') ||
        technique.includes('rest_pause');
      if (isAdvancedFinisher && exercise.target_sets > 4) {
        fail(
          `Assert 2: ${exerciseLabel(exercise)} usa ${exercise.execution_technique} com ${exercise.target_sets} sets (> 4).`,
          day,
        );
      }
    }
  }

  const restDays = weeklyMicrocycle.filter((day) => day.is_rest_day);
  if (restDays.length !== 1 || restDays[0]?.day_index !== 4) {
    fail(
      `Assert 3: esperado apenas Dia 4 como descanso; recebido [${restDays
        .map((day) => day.day_index)
        .join(', ')}].`,
      restDays[0] ?? weeklyMicrocycle[3],
    );
  }

  console.log(SUCCESS_MESSAGE);
  [...weeklyMicrocycle]
    .sort((a, b) => a.day_index - b.day_index)
    .forEach(printDaySummary);
}

simulateAppFlow().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
