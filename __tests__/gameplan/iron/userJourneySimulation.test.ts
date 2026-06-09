import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import {
  filterIronLogsLastDays,
  flattenPerformanceLogs,
} from '@/lib/gameplan/engine/performanceLogs';
import { fetchLibraryExercises } from '@/lib/catalog/library';
import { initialBiologicalProfile, type BiologicalProfile } from '@/types/biological';
import type { IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';
import type { IronSetLog, PerformanceLogEntry } from '@/types/performance';
import { useSommaStore, type EquipmentTag, type FocusPreference, type UserStats } from '@/store/useSommaStore';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'web',
    select: <T,>(options: { web?: T; default?: T }) => options.web ?? options.default,
  },
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(async () => ({ canceled: true, assets: [] })),
}));

vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
    },
  };
});

const focus: FocusPreference = { iron: 100, nutrition: 100 };
const equipment: EquipmentTag[] = ['full_gym'];
const userStats: UserStats = {
  iron_sessions_completed: 0,
  nutrition_checkins_completed: 0,
};
const trainingDays = [1, 2, 3, 5, 6, 7];

function biological(overrides: Partial<BiologicalProfile> = {}): BiologicalProfile {
  return {
    ...initialBiologicalProfile,
    date_of_birth: '1994-05-14',
    weight_kg: 58,
    height_cm: 159,
    body_fat_percentage: null,
    current_body_fat_estimate: null,
    current_injuries: null,
    baseline_stress_level: 3,
    goal_iron: 'Hypertrophy',
    nutrition_goal: 'Hypertrophy support',
    training_days_per_week: 6,
    frequency_iron: 6,
    available_time_iron: 90,
    experience_level: 'ADVANCED',
    iron_mastery: 5,
    cns_fatigue_score: 0,
    hormonal_transition: false,
    ...overrides,
  };
}

function ironExercises(day: MicrocycleDay | undefined): IronExercisePrescription[] {
  return day?.blocks.flatMap((block) => block.iron?.exercises ?? []) ?? [];
}

function isIsolationOrFinisher(exercise: IronExercisePrescription): boolean {
  const slug = exercise.slug ?? '';
  const technique = (exercise.execution_technique ?? '').toLowerCase();
  return (
    technique.includes('myo') ||
    technique.includes('drop') ||
    /fly|pec_deck|leg_extension|leg_curl|curl|raise|pushdown|extension|face_pull|calf/.test(slug)
  );
}

async function generate(input?: {
  performanceLogs?: PerformanceLogEntry[];
  profile?: Partial<BiologicalProfile>;
  protocolDate?: string;
}) {
  return generateDeterministicGameplan({
    focus,
    equipment,
    biological: biological(input?.profile),
    userStats,
    performanceLogs: input?.performanceLogs ?? [],
    protocolDate: input?.protocolDate ?? '2026-06-01',
  });
}

function performanceLogForExercise(
  day: MicrocycleDay,
  blockId: string,
  exercise: IronExercisePrescription,
  options: { rir: number; setCount?: number; weightKg?: number; reps?: number },
): PerformanceLogEntry {
  const completedAt = `${day.date ?? '2026-06-01'}T18:00:00.000Z`;
  const setCount = options.setCount ?? exercise.target_sets;
  const reps = options.reps ?? exercise.target_reps ?? 10;
  const sets: IronSetLog[] = Array.from({ length: setCount }, (_, index) => ({
    set_index: index + 1,
    weight_kg: options.weightKg ?? exercise.target_weight_kg ?? 40,
    reps,
    target_reps: exercise.target_reps ?? reps,
    target_rir: exercise.target_rir ?? null,
    reported_rir: options.rir,
    rest_seconds_used: exercise.rest_seconds ?? 90,
    logged_at: completedAt,
  }));

  return {
    id: `journey-${day.day_index}-${exercise.exercise_id}-${completedAt}`,
    pillar: 'iron',
    block_id: blockId,
    timestamp: completedAt,
    iron: {
      block_id: blockId,
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.display_name ?? exercise.slug ?? exercise.exercise_id,
      sets,
      completed_at: completedAt,
    },
  };
}

function highFatigueLogs(days: MicrocycleDay[]): PerformanceLogEntry[] {
  return days.flatMap((day) => {
    const block = day.blocks.find((entry) => entry.pillar === 'iron');
    return ironExercises(day).map((exercise) =>
      performanceLogForExercise(day, block?.id ?? `block-d${day.day_index}-iron`, exercise, {
        rir: 1,
        setCount: Math.max(6, exercise.target_sets),
        weightKg: exercise.target_weight_kg ?? 50,
      }),
    );
  });
}

describe('real user journey simulation', () => {
  beforeEach(() => {
    useSommaStore.setState({
      user_environment: { available_equipment: [], updated_at: null },
      user_stats: { ...userStats },
      user_foundation: { focus_preference: null, foundation_completed_at: null },
      user_biological: biological(),
      weeklyMicrocycle: null,
      protocolDate: null,
      weekStartDate: null,
      protocolGeneratedAt: null,
      selectedDayIndex: 1,
      readinessScanDate: null,
      subjectiveReadiness: null,
      damageControlActiveDates: [],
      performance_logs: [],
      performanceQueue: [],
      performance_syncing: false,
      lastWorkoutSummary: null,
      gameplan_loading: false,
      gameplan_source: null,
      gameplan_error: null,
    });
  });

  it('Scenario A: A Semana Perfeita builds complete Iron and Longevity on all training days', async () => {
    const gameplan = await generate();

    for (const dayIndex of trainingDays) {
      const day = gameplan.microcycle.find((entry) => entry.day_index === dayIndex);
      const exercises = ironExercises(day);
      expect(exercises.length, `day ${dayIndex}`).toBeGreaterThanOrEqual(4);
      expect(day?.blocks.some((block) => block.pillar === 'longevity')).toBe(true);
    }

    for (const day of gameplan.microcycle) {
      for (const exercise of ironExercises(day)) {
        if (isIsolationOrFinisher(exercise)) {
          expect(exercise.target_sets).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it('Scenario B: O Usuário Fatigado deloads sets without deleting the Legs day', async () => {
    const baseline = await generate();
    const logs = highFatigueLogs(
      baseline.microcycle.filter((day) => day.day_index === 1 || day.day_index === 2),
    );

    const catalog = buildExerciseCatalog(await fetchLibraryExercises());
    const flatLogs = flattenPerformanceLogs(logs);
    const tracker = createWeeklyVolumeTracker(catalog, flatLogs, flatLogs, biological());
    expect(tracker.isRecoveryMode).toBe(true);

    const fatigued = await generate({
      performanceLogs: logs,
      profile: { baseline_stress_level: 8, cns_fatigue_score: 85 },
    });
    const legs = fatigued.microcycle.find((day) => day.day_index === 3);
    const legsExercises = ironExercises(legs);
    const longevity = legs?.blocks.find((block) => block.pillar === 'longevity');

    expect(legsExercises.length).toBeGreaterThanOrEqual(3);
    expect(legsExercises.some((exercise) => exercise.target_sets <= 3)).toBe(true);
    expect(
      `${longevity?.longevity?.mobility_focus ?? ''} ${longevity?.longevity?.cardio_prescription ?? ''}`,
    ).toMatch(/Mobilidade|Zona 2|Caminhada/i);
  });

  it('Scenario C: Consistência e Estado completes workouts and feeds progression logs', async () => {
    const gameplan = await generate();
    useSommaStore.setState({
      user_foundation: {
        focus_preference: null,
        foundation_completed_at: '2026-06-01T00:00:00.000Z',
      },
      user_environment: { available_equipment: equipment, updated_at: '2026-06-01T00:00:00.000Z' },
      user_biological: biological(),
      weeklyMicrocycle: gameplan.microcycle,
      protocolDate: gameplan.date,
      weekStartDate: gameplan.week_start_date ?? null,
    });

    for (const dayIndex of [1, 2, 3]) {
      const day = gameplan.microcycle.find((entry) => entry.day_index === dayIndex)!;
      const block = day.blocks.find((entry) => entry.pillar === 'iron')!;
      const firstExercise = ironExercises(day)[0]!;

      useSommaStore.getState().logIronSet({
        block_id: block.id,
        exercise_id: firstExercise.exercise_id,
        exercise_name: firstExercise.display_name ?? firstExercise.slug ?? firstExercise.exercise_id,
        set: {
          set_index: 1,
          weight_kg: firstExercise.target_weight_kg ?? 40 + dayIndex * 2.5,
          reps: firstExercise.target_reps,
          target_reps: firstExercise.target_reps,
          target_rir: firstExercise.target_rir ?? null,
          reported_rir: 2,
          rest_seconds_used: firstExercise.rest_seconds ?? 90,
          logged_at: `${day.date}T18:00:00.000Z`,
        },
      });

      await useSommaStore.getState().completeWorkout({
        block_id: block.id,
        pillar: 'iron',
        exercise_id: firstExercise.exercise_id,
        weight_used: firstExercise.target_weight_kg ?? 40 + dayIndex * 2.5,
        reps_completed: firstExercise.target_reps,
        target_rir: firstExercise.target_rir ?? null,
      });
    }

    const state = useSommaStore.getState();
    for (const dayIndex of [1, 2, 3]) {
      const block = state.weeklyMicrocycle
        ?.find((day) => day.day_index === dayIndex)
        ?.blocks.find((entry) => entry.pillar === 'iron');
      expect(block?.status).toBe('completed');
      expect(block?.completed_at).toBeDefined();
    }

    const next = await generate({
      performanceLogs: state.performance_logs,
      protocolDate: '2026-06-08',
    });
    const progressedExerciseIds = new Set(state.performance_logs.map((log) => log.iron?.exercise_id));
    const progressed = next.microcycle
      .flatMap((day) => ironExercises(day))
      .filter((exercise) => progressedExerciseIds.has(exercise.exercise_id));

    expect(progressed.length).toBeGreaterThan(0);
    expect(
      progressed.some(
        (exercise) =>
          exercise.target_weight_kg != null ||
          /E1RM|Last set|RIR/i.test(exercise.progression_note ?? ''),
      ),
    ).toBe(true);
  });
});
