import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import {
  isDegenerateMicrocycle,
  sanitizeMicrocycleIronVolume,
} from '@/lib/gameplan/microcycleValidation';
import { initialBiologicalProfile, type BiologicalProfile } from '@/types/biological';
import type { LibraryExercise } from '@/types/catalog';
import type { IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';
import type { PerformanceLogEntry } from '@/types/performance';
import type { EquipmentTag, FocusPreference, UserStats } from '@/store/useSommaStore';

const catalogState = vi.hoisted(() => ({
  current: [] as LibraryExercise[],
}));

vi.mock('@/lib/catalog/library', () => ({
  fetchLibraryExercises: vi.fn(async () => catalogState.current),
}));

function exercise(
  partial: Pick<LibraryExercise, 'id' | 'slug' | 'name' | 'movement_pattern' | 'primary_muscle'> &
    Partial<
      Pick<
        LibraryExercise,
        | 'biomechanical_instructions'
        | 'equipment_required'
        | 'default_sets'
        | 'default_reps'
        | 'synergist_muscles'
        | 'cns_fatigue_cost'
        | 'joint_stress_profile'
        | 'stretch_mediated_hypertrophy'
      >
    >,
): LibraryExercise {
  return {
    biomechanical_instructions: {
      setup: 'Stable base.',
      concentric: 'Move through the target tissue.',
      eccentric: 'Control the negative.',
      safety: 'Stop for joint pain.',
    },
    equipment_required: ['full_gym'],
    default_sets: 4,
    default_reps: 10,
    synergist_muscles: [],
    cns_fatigue_cost: 3,
    joint_stress_profile: 'low_impact',
    stretch_mediated_hypertrophy: false,
    ...partial,
  };
}

function comprehensiveCatalog(): LibraryExercise[] {
  return [
    exercise({ id: 'ex-bench', slug: 'barbell_bench_press', name: 'Barbell Bench Press', movement_pattern: 'push', primary_muscle: 'chest', default_reps: 8, synergist_muscles: ['front_delts', 'triceps'], cns_fatigue_cost: 4 }),
    exercise({ id: 'ex-incline', slug: 'incline_dumbbell_press_30', name: 'Incline Dumbbell Press 30', movement_pattern: 'push', primary_muscle: 'upper_chest', synergist_muscles: ['front_delts', 'triceps'], cns_fatigue_cost: 3, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-ohp', slug: 'overhead_press', name: 'Standing Overhead Press', movement_pattern: 'push', primary_muscle: 'front_delts', default_reps: 8, synergist_muscles: ['triceps', 'upper_chest'], cns_fatigue_cost: 4 }),
    exercise({ id: 'ex-machine-press', slug: 'machine_shoulder_press', name: 'Machine Shoulder Press', movement_pattern: 'push', primary_muscle: 'front_delts', synergist_muscles: ['triceps'], cns_fatigue_cost: 3 }),
    exercise({ id: 'ex-cable-fly', slug: 'cable_fly', name: 'Cable Fly', movement_pattern: 'isolation', primary_muscle: 'chest', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-lateral', slug: 'cable_lateral_raise', name: 'Cable Lateral Raise', movement_pattern: 'isolation', primary_muscle: 'side_delts', default_sets: 3, default_reps: 15, synergist_muscles: ['traps'], cns_fatigue_cost: 1 }),
    exercise({ id: 'ex-leaning-lateral', slug: 'leaning_cable_lateral_raise', name: 'Leaning Cable Lateral Raise', movement_pattern: 'isolation', primary_muscle: 'side_delts', default_sets: 3, default_reps: 15, synergist_muscles: ['traps'], cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-reverse-pec', slug: 'reverse_pec_deck', name: 'Reverse Pec Deck', movement_pattern: 'isolation', primary_muscle: 'rear_delts', default_sets: 3, default_reps: 15, synergist_muscles: ['mid_back'], cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-face-pull', slug: 'cable_face_pull', name: 'Cable Face Pull', movement_pattern: 'isolation', primary_muscle: 'rear_delts', default_sets: 3, default_reps: 15, synergist_muscles: ['traps', 'rotator_cuff'], cns_fatigue_cost: 1 }),
    exercise({ id: 'ex-pushdown', slug: 'tricep_rope_pushdown', name: 'Tricep Rope Pushdown', movement_pattern: 'isolation', primary_muscle: 'triceps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1 }),
    exercise({ id: 'ex-oh-triceps', slug: 'overhead_tricep_extension', name: 'Overhead Tricep Extension', movement_pattern: 'isolation', primary_muscle: 'triceps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),

    exercise({ id: 'ex-pulldown', slug: 'iliac_lat_pulldown', name: 'Iliac Lat Pulldown', movement_pattern: 'pull', primary_muscle: 'back', synergist_muscles: ['biceps', 'rear_delts'], cns_fatigue_cost: 2, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-row', slug: 'chest_supported_row', name: 'Chest Supported Row', movement_pattern: 'pull', primary_muscle: 'back', synergist_muscles: ['biceps', 'rear_delts'], cns_fatigue_cost: 2 }),
    exercise({ id: 'ex-pullup', slug: 'neutral_grip_pull_up', name: 'Neutral Grip Pull Up', movement_pattern: 'pull', primary_muscle: 'back', default_reps: 6, synergist_muscles: ['biceps'], cns_fatigue_cost: 4, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-pullover', slug: 'cable_pull_over', name: 'Cable Pullover', movement_pattern: 'isolation', primary_muscle: 'back', default_sets: 3, default_reps: 12, synergist_muscles: ['triceps'], cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-bayesian-curl', slug: 'bayesian_curl', name: 'Bayesian Curl', movement_pattern: 'isolation', primary_muscle: 'biceps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-spider-curl', slug: 'spider_curl', name: 'Spider Curl', movement_pattern: 'isolation', primary_muscle: 'biceps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1 }),
    exercise({ id: 'ex-shrug', slug: 'dumbbell_shrug', name: 'Dumbbell Shrug', movement_pattern: 'isolation', primary_muscle: 'traps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 2 }),

    exercise({ id: 'ex-back-squat', slug: 'barbell_back_squat', name: 'Barbell Back Squat', movement_pattern: 'squat', primary_muscle: 'quads', default_sets: 4, default_reps: 6, synergist_muscles: ['glutes', 'erectors'], cns_fatigue_cost: 5, joint_stress_profile: 'spinal_axial_load' }),
    exercise({ id: 'ex-hack-squat', slug: 'hack_squat_machine', name: 'Hack Squat Machine', movement_pattern: 'squat', primary_muscle: 'quads', default_sets: 4, default_reps: 8, synergist_muscles: ['glutes'], cns_fatigue_cost: 3 }),
    exercise({ id: 'ex-pendulum-squat', slug: 'pendulum_squat', name: 'Pendulum Squat', movement_pattern: 'squat', primary_muscle: 'quads', default_sets: 3, default_reps: 10, synergist_muscles: ['glutes'], cns_fatigue_cost: 3, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-split-squat', slug: 'deficit_bulgarian_split_squat', name: 'Deficit Bulgarian Split Squat', movement_pattern: 'lunge', primary_muscle: 'quads', default_sets: 3, default_reps: 10, synergist_muscles: ['glutes'], cns_fatigue_cost: 4, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-smith-split-squat', slug: 'smith_machine_split_squat', name: 'Smith Machine Split Squat', movement_pattern: 'lunge', primary_muscle: 'quads', default_sets: 3, default_reps: 10, synergist_muscles: ['glutes'], cns_fatigue_cost: 3, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-leg-extension', slug: 'leg_extension', name: 'Leg Extension', movement_pattern: 'isolation', primary_muscle: 'quads', default_sets: 4, default_reps: 15, cns_fatigue_cost: 1 }),
    exercise({ id: 'ex-rdl', slug: 'barbell_romanian_deadlift', name: 'Barbell Romanian Deadlift', movement_pattern: 'hinge', primary_muscle: 'hamstrings', default_sets: 4, default_reps: 8, synergist_muscles: ['glutes'], cns_fatigue_cost: 4, joint_stress_profile: 'lumbar_shear', stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-hip-thrust', slug: 'hip_thrust_barbell', name: 'Hip Thrust Barbell', movement_pattern: 'hinge', primary_muscle: 'glutes', default_sets: 4, default_reps: 10, synergist_muscles: ['hamstrings'], cns_fatigue_cost: 3, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-seated-curl', slug: 'seated_leg_curl', name: 'Seated Leg Curl', movement_pattern: 'isolation', primary_muscle: 'hamstrings', default_sets: 4, default_reps: 12, cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-lying-curl', slug: 'lying_leg_curl', name: 'Lying Leg Curl', movement_pattern: 'isolation', primary_muscle: 'hamstrings', default_sets: 4, default_reps: 12, cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    exercise({ id: 'ex-calf', slug: 'seated_calf_raise', name: 'Seated Calf Raise', movement_pattern: 'isolation', primary_muscle: 'calves', default_sets: 4, default_reps: 15, cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
  ];
}

function deadlockCatalog(): LibraryExercise[] {
  return [
    exercise({ id: 'ex-pushup', slug: 'push_up', name: 'Push Up', movement_pattern: 'push', primary_muscle: 'chest', default_sets: 3, default_reps: 12, equipment_required: [] }),
    exercise({ id: 'ex-machine-chest', slug: 'machine_chest_press', name: 'Machine Chest Press', movement_pattern: 'push', primary_muscle: 'chest', default_sets: 3, default_reps: 10, synergist_muscles: ['triceps'], cns_fatigue_cost: 2 }),
    exercise({ id: 'ex-cable-fly', slug: 'cable_fly', name: 'Cable Fly', movement_pattern: 'isolation', primary_muscle: 'chest', default_sets: 3, default_reps: 12, synergist_muscles: ['triceps'], cns_fatigue_cost: 1 }),
    exercise({ id: 'ex-pec-deck', slug: 'pec_deck', name: 'Pec Deck', movement_pattern: 'isolation', primary_muscle: 'chest', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1 }),
    exercise({ id: 'ex-pushdown', slug: 'cable_pushdown', name: 'Cable Pushdown', movement_pattern: 'isolation', primary_muscle: 'triceps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1 }),
    exercise({ id: 'ex-oh-triceps', slug: 'overhead_tricep_extension', name: 'Overhead Tricep Extension', movement_pattern: 'isolation', primary_muscle: 'triceps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1 }),
    exercise({ id: 'ex-row', slug: 'chest_supported_row', name: 'Chest Supported Row', movement_pattern: 'pull', primary_muscle: 'back', cns_fatigue_cost: 2 }),
    exercise({ id: 'ex-pulldown', slug: 'iliac_lat_pulldown', name: 'Iliac Lat Pulldown', movement_pattern: 'pull', primary_muscle: 'back', cns_fatigue_cost: 2 }),
    exercise({ id: 'ex-curl', slug: 'bayesian_curl', name: 'Bayesian Curl', movement_pattern: 'isolation', primary_muscle: 'biceps', default_sets: 3, cns_fatigue_cost: 1 }),
    exercise({ id: 'ex-squat', slug: 'hack_squat_machine', name: 'Hack Squat Machine', movement_pattern: 'squat', primary_muscle: 'quads', default_reps: 8, cns_fatigue_cost: 3 }),
    exercise({ id: 'ex-lunge', slug: 'smith_machine_split_squat', name: 'Smith Split Squat', movement_pattern: 'lunge', primary_muscle: 'quads', default_reps: 10, cns_fatigue_cost: 3 }),
    exercise({ id: 'ex-hinge', slug: 'hip_thrust_barbell', name: 'Hip Thrust', movement_pattern: 'hinge', primary_muscle: 'glutes', cns_fatigue_cost: 3 }),
    exercise({ id: 'ex-leg-extension', slug: 'leg_extension', name: 'Leg Extension', movement_pattern: 'isolation', primary_muscle: 'quads', default_sets: 4, default_reps: 15, cns_fatigue_cost: 1 }),
    exercise({ id: 'ex-leg-curl', slug: 'lying_leg_curl', name: 'Lying Leg Curl', movement_pattern: 'isolation', primary_muscle: 'hamstrings', default_sets: 4, default_reps: 12, cns_fatigue_cost: 1 }),
    exercise({ id: 'ex-calf', slug: 'seated_calf_raise', name: 'Seated Calf Raise', movement_pattern: 'isolation', primary_muscle: 'calves', default_sets: 4, default_reps: 15, cns_fatigue_cost: 1 }),
  ];
}

function biological(overrides: Partial<BiologicalProfile> = {}): BiologicalProfile {
  return {
    ...initialBiologicalProfile,
    date_of_birth: '1996-01-01',
    weight_kg: 57,
    height_cm: 170,
    baseline_stress_level: 3,
    goal_iron: 'Hypertrophy',
    nutrition_goal: 'Hypertrophy support',
    training_days_per_week: 6,
    frequency_iron: 6,
    available_time_iron: 90,
    experience_level: 'advanced',
    iron_mastery: 5,
    mesocycle_week: 1,
    cns_fatigue_score: 0,
    hormonal_transition: false,
    ...overrides,
  };
}

const focus: FocusPreference = { iron: 100, nutrition: 100 };
const userStats: UserStats = { iron_sessions_completed: 0, nutrition_checkins_completed: 0 };
const fullGym: EquipmentTag[] = ['full_gym'];

function highVolumeLog(exerciseId: string, setCount: number, timestamp: string): PerformanceLogEntry {
  return {
    id: `log-${exerciseId}-${timestamp}`,
    pillar: 'iron',
    block_id: `block-${exerciseId}`,
    timestamp,
    iron: {
      block_id: `block-${exerciseId}`,
      exercise_id: exerciseId,
      exercise_name: exerciseId,
      completed_at: timestamp,
      sets: Array.from({ length: setCount }, (_, index) => ({
        set_index: index + 1,
        weight_kg: 40,
        reps: 10,
        target_reps: 10,
        target_rir: 2,
        reported_rir: 2,
        rest_seconds_used: 75,
        logged_at: timestamp,
      })),
    },
  };
}

async function generateWithCurrentCatalog(input?: {
  biological?: Partial<BiologicalProfile>;
  equipment?: EquipmentTag[];
  performanceLogs?: PerformanceLogEntry[];
}) {
  return generateDeterministicGameplan({
    focus,
    equipment: input?.equipment ?? fullGym,
    biological: biological(input?.biological),
    userStats,
    performanceLogs: input?.performanceLogs ?? [],
    protocolDate: '2026-06-03',
  });
}

function ironExercises(day: MicrocycleDay): IronExercisePrescription[] {
  return day.blocks.flatMap((block) => block.iron?.exercises ?? []);
}

function allIronExercises(microcycle: MicrocycleDay[]): IronExercisePrescription[] {
  return microcycle.flatMap(ironExercises);
}

function catalogById(): Map<string, LibraryExercise> {
  return new Map(catalogState.current.map((row) => [row.id, row]));
}

describe('SOMMA Iron comprehensive generation pipeline', () => {
  beforeEach(() => {
    catalogState.current = comprehensiveCatalog();
  });

  it('Scenario 1: anti-poisoning regression caps Myo-Reps/finishers at 4 and compounds at 8 under extreme time budget', async () => {
    const gameplan = await generateWithCurrentCatalog({
      biological: { available_time_iron: 180 },
    });
    const byId = catalogById();
    const exercises = allIronExercises(gameplan.microcycle);

    expect(exercises.length).toBeGreaterThan(0);

    for (const prescription of exercises) {
      const meta = byId.get(prescription.exercise_id);
      const technique = prescription.execution_technique?.toLowerCase() ?? '';
      const isFinisherOrMyo = technique.includes('myo') || /finisher/i.test(prescription.progression_note ?? '');

      // anchor_point.md: volume efetivo de isoladores/finishers não pode virar junk volume sistêmico.
      if (isFinisherOrMyo) {
        expect(prescription.target_sets).toBeLessThanOrEqual(4);
      }

      // anchor_point.md: compostos pesados preservam estímulo mecânico, mas têm teto anti-poisoning.
      if (meta?.movement_pattern !== 'isolation') {
        expect(prescription.target_sets).toBeLessThanOrEqual(8);
      }
    }

    const bugRegressionTargets = exercises.filter((row) =>
      /face_pull|leg_extension|lying_leg_curl/i.test(`${row.slug ?? ''} ${row.display_name ?? ''}`),
    );
    expect(bugRegressionTargets.every((row) => row.target_sets <= 4)).toBe(true);
  });

  it('Scenario 2: deadlock breaker injects a minimum viable Push B instead of persisting an empty day', async () => {
    catalogState.current = deadlockCatalog();
    const logs = [
      highVolumeLog('ex-pushup', 8, '2026-06-01T10:00:00.000Z'),
      highVolumeLog('ex-machine-chest', 8, '2026-06-02T10:00:00.000Z'),
      highVolumeLog('ex-cable-fly', 8, '2026-06-03T10:00:00.000Z'),
      highVolumeLog('ex-pushdown', 8, '2026-06-01T11:00:00.000Z'),
      highVolumeLog('ex-oh-triceps', 8, '2026-06-02T11:00:00.000Z'),
      highVolumeLog('ex-pec-deck', 8, '2026-06-03T11:00:00.000Z'),
    ];

    const gameplan = await generateWithCurrentCatalog({
      performanceLogs: logs,
      biological: { iron_mastery: 5, available_time_iron: 90 },
    });
    const pushB = gameplan.microcycle.find((day) => day.day_index === 5);
    const exercises = pushB ? ironExercises(pushB) : [];

    expect(pushB?.is_rest_day).toBe(false);

    // anchor_point.md: quando MRV/CNS cria deadlock, o usuário ainda recebe protocolo mínimo de deload.
    expect(exercises).not.toHaveLength(0);
    expect(exercises.length).toBeGreaterThanOrEqual(2);
    expect(exercises.slice(0, 2).every((row) => row.target_sets === 2)).toBe(true);
  });

  it('Scenario 3: end-to-end real profile builds a 7-day week with DUP legs and carb-cycled nutrition', async () => {
    const gameplan = await generateWithCurrentCatalog({
      biological: {
        weight_kg: 57,
        training_days_per_week: 6,
        frequency_iron: 6,
        available_time_iron: 90,
        baseline_stress_level: 3,
      },
      equipment: ['full_gym'],
    });

    expect(gameplan.microcycle).toHaveLength(7);

    const restDays = gameplan.microcycle.filter((day) => day.is_rest_day);
    expect(restDays.map((day) => day.day_index)).toEqual([4]);

    for (const day of gameplan.microcycle.filter((entry) => !entry.is_rest_day)) {
      // anchor_point.md: nenhum dia de treino pode chegar ao app sem bloco Iron executável.
      expect(ironExercises(day).length).toBeGreaterThan(0);
    }

    const legsA = gameplan.microcycle.find((day) => day.day_index === 3);
    const legsB = gameplan.microcycle.find((day) => day.day_index === 7);
    expect(legsA).toBeDefined();
    expect(legsB).toBeDefined();

    // anchor_point.md: DUP Legs A = tensão mecânica pura, faixa pesada 5-8 reps.
    expect(ironExercises(legsA!).some((row) => /5-8/.test(row.target_rep_range ?? '') || row.target_reps <= 8)).toBe(true);

    // anchor_point.md: DUP Legs B = estabilidade unilateral/stretch, faixa de hipertrofia 10-15 reps.
    expect(ironExercises(legsB!).some((row) => row.target_reps >= 10 && row.target_reps <= 15)).toBe(true);

    for (const day of gameplan.microcycle) {
      const nutrition = day.blocks.find((block) => block.pillar === 'nutrition')?.nutrition?.nutrition_target;
      // anchor_point.md: o Head Coach sempre acompanha treino/descanso com prescrição metabólica.
      expect(nutrition).toBeDefined();
      expect(nutrition?.protein_g).toBe(Math.round(57 * 2.2));
    }

    const pushCarbs = gameplan.microcycle.find((day) => /push/i.test(day.focus_label))?.blocks.find((block) => block.pillar === 'nutrition')?.nutrition?.nutrition_target?.carbs_g;
    const legsCarbs = legsA?.blocks.find((block) => block.pillar === 'nutrition')?.nutrition?.nutrition_target?.carbs_g;
    const restCarbs = restDays[0]?.blocks.find((block) => block.pillar === 'nutrition')?.nutrition?.nutrition_target?.carbs_g;

    // anchor_point.md: carb cycling prioriza glicogênio em legs, manutenção em push/pull, déficit em rest.
    expect(legsCarbs).toBeGreaterThan(pushCarbs ?? 0);
    expect(pushCarbs).toBeGreaterThan(restCarbs ?? Number.POSITIVE_INFINITY);
  });

  it('Scenario 4: corrupted hydration sanitizes 36-set isolators and rejects empty Iron training days', () => {
    const corrupted: MicrocycleDay[] = [
      { day_index: 1, is_rest_day: false, focus_label: 'Iron: Push A', blocks: [] },
      {
        day_index: 2,
        is_rest_day: false,
        focus_label: 'Iron: Legs A',
        blocks: [
          {
            id: 'block-d2-iron',
            pillar: 'iron',
            title: 'Iron: Legs A',
            subtitle: 'Leg Extension',
            duration_minutes: 90,
            order: 0,
            status: 'pending',
            iron: {
              routine_id: 'iron-corrupt',
              exercises: [
                {
                  exercise_id: 'ex-leg-extension',
                  slug: 'leg_extension',
                  display_name: 'Leg Extension',
                  target_sets: 36,
                  target_reps: 15,
                  target_weight_kg: null,
                  execution_technique: 'Myo-Reps',
                },
              ],
            },
          },
        ],
      },
      { day_index: 3, is_rest_day: true, focus_label: 'Rest & Recovery', blocks: [] },
      { day_index: 4, is_rest_day: true, focus_label: 'Rest & Recovery', blocks: [] },
      {
        day_index: 5,
        is_rest_day: false,
        focus_label: 'Iron: Push B',
        blocks: [
          {
            id: 'block-d5-iron',
            pillar: 'iron',
            title: 'Iron: Push B',
            subtitle: 'Corrupt Empty Iron',
            duration_minutes: 90,
            order: 0,
            status: 'pending',
            iron: { routine_id: 'iron-empty', exercises: [] },
          },
        ],
      },
    ];

    const sanitized = sanitizeMicrocycleIronVolume(corrupted);
    const legExtension = sanitized[1]?.blocks[0]?.iron?.exercises[0];

    // anchor_point.md: cache legado nunca pode reidratar um isolador com 36 séries.
    expect(legExtension?.target_sets).toBeLessThanOrEqual(4);

    // anchor_point.md: treino Iron vazio é estado inválido e deve forçar regeneração/fallback.
    expect(isDegenerateMicrocycle(sanitized, 3)).toBe(true);
  });
});
