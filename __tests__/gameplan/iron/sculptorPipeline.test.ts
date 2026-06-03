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

function sculptorExercise(
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
      setup: 'Lock in posture before loading the target tissue.',
      concentric: 'Drive with intent while keeping the joint path clean.',
      eccentric: 'Own the eccentric and preserve tension.',
      safety: 'Terminate the set when joint stress replaces muscular tension.',
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

function fullSculptorCatalog(): LibraryExercise[] {
  return [
    sculptorExercise({ id: 'bench', slug: 'barbell_bench_press', name: 'Barbell Bench Press', movement_pattern: 'push', primary_muscle: 'chest', default_reps: 8, synergist_muscles: ['front_delts', 'triceps'], cns_fatigue_cost: 4 }),
    sculptorExercise({ id: 'incline', slug: 'incline_dumbbell_press_30', name: 'Incline Dumbbell Press 30', movement_pattern: 'push', primary_muscle: 'upper_chest', synergist_muscles: ['front_delts', 'triceps'], cns_fatigue_cost: 3, stretch_mediated_hypertrophy: true }),
    sculptorExercise({ id: 'ohp', slug: 'overhead_press', name: 'Standing Overhead Press', movement_pattern: 'push', primary_muscle: 'front_delts', default_reps: 8, synergist_muscles: ['triceps', 'upper_chest'], cns_fatigue_cost: 4 }),
    sculptorExercise({ id: 'machine-press', slug: 'machine_shoulder_press', name: 'Machine Shoulder Press', movement_pattern: 'push', primary_muscle: 'front_delts', cns_fatigue_cost: 3 }),
    sculptorExercise({ id: 'cable-fly', slug: 'cable_fly', name: 'Cable Fly', movement_pattern: 'isolation', primary_muscle: 'chest', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    sculptorExercise({ id: 'lateral', slug: 'cable_lateral_raise', name: 'Cable Lateral Raise', movement_pattern: 'isolation', primary_muscle: 'side_delts', default_sets: 3, default_reps: 15, synergist_muscles: ['traps'], cns_fatigue_cost: 1 }),
    sculptorExercise({ id: 'leaning-lateral', slug: 'leaning_cable_lateral_raise', name: 'Leaning Cable Lateral Raise', movement_pattern: 'isolation', primary_muscle: 'side_delts', default_sets: 3, default_reps: 15, synergist_muscles: ['traps'], cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    sculptorExercise({ id: 'reverse-pec', slug: 'reverse_pec_deck', name: 'Reverse Pec Deck', movement_pattern: 'isolation', primary_muscle: 'rear_delts', default_sets: 3, default_reps: 15, synergist_muscles: ['mid_back'], cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    sculptorExercise({ id: 'face-pull', slug: 'cable_face_pull', name: 'Cable Face Pull', movement_pattern: 'isolation', primary_muscle: 'rear_delts', default_sets: 3, default_reps: 15, synergist_muscles: ['traps', 'rotator_cuff'], cns_fatigue_cost: 1 }),
    sculptorExercise({ id: 'pushdown', slug: 'tricep_rope_pushdown', name: 'Tricep Rope Pushdown', movement_pattern: 'isolation', primary_muscle: 'triceps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1 }),
    sculptorExercise({ id: 'oh-triceps', slug: 'overhead_tricep_extension', name: 'Overhead Tricep Extension', movement_pattern: 'isolation', primary_muscle: 'triceps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),

    sculptorExercise({ id: 'pulldown', slug: 'iliac_lat_pulldown', name: 'Iliac Lat Pulldown', movement_pattern: 'pull', primary_muscle: 'back', synergist_muscles: ['biceps', 'rear_delts'], cns_fatigue_cost: 2, stretch_mediated_hypertrophy: true }),
    sculptorExercise({ id: 'row', slug: 'chest_supported_row', name: 'Chest Supported Row', movement_pattern: 'pull', primary_muscle: 'back', synergist_muscles: ['biceps', 'rear_delts'], cns_fatigue_cost: 2 }),
    sculptorExercise({ id: 'pullup', slug: 'neutral_grip_pull_up', name: 'Neutral Grip Pull Up', movement_pattern: 'pull', primary_muscle: 'back', default_reps: 6, synergist_muscles: ['biceps'], cns_fatigue_cost: 4, stretch_mediated_hypertrophy: true }),
    sculptorExercise({ id: 'pullover', slug: 'cable_pull_over', name: 'Cable Pullover', movement_pattern: 'isolation', primary_muscle: 'back', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    sculptorExercise({ id: 'bayesian-curl', slug: 'bayesian_curl', name: 'Bayesian Curl', movement_pattern: 'isolation', primary_muscle: 'biceps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    sculptorExercise({ id: 'spider-curl', slug: 'spider_curl', name: 'Spider Curl', movement_pattern: 'isolation', primary_muscle: 'biceps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1 }),
    sculptorExercise({ id: 'shrug', slug: 'dumbbell_shrug', name: 'Dumbbell Shrug', movement_pattern: 'isolation', primary_muscle: 'traps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 2 }),

    sculptorExercise({ id: 'back-squat', slug: 'barbell_back_squat', name: 'Barbell Back Squat', movement_pattern: 'squat', primary_muscle: 'quads', default_sets: 4, default_reps: 6, synergist_muscles: ['glutes', 'erectors'], cns_fatigue_cost: 5, joint_stress_profile: 'spinal_axial_load', biomechanical_instructions: { setup: 'Brace hard under the bar.', vector: 'Drive vertically through the midfoot for maximal mechanical tension.', catch: 'Control depth without relaxing the brace.', anti_pattern: 'Do not chase reps after bar speed collapses.' } }),
    sculptorExercise({ id: 'hack-squat', slug: 'hack_squat_machine', name: 'Hack Squat Machine', movement_pattern: 'squat', primary_muscle: 'quads', default_sets: 4, default_reps: 8, synergist_muscles: ['glutes'], cns_fatigue_cost: 3, biomechanical_instructions: { setup: 'Lock hips into the pad.', vector: 'Push the platform with pure knee extension tension.', catch: 'Let the knees travel while keeping heels rooted.', anti_pattern: 'Do not bounce out of the bottom.' } }),
    sculptorExercise({ id: 'pendulum-squat', slug: 'pendulum_squat', name: 'Pendulum Squat', movement_pattern: 'squat', primary_muscle: 'quads', default_sets: 3, default_reps: 10, synergist_muscles: ['glutes'], cns_fatigue_cost: 3, stretch_mediated_hypertrophy: true, biomechanical_instructions: { setup: 'Set stance for deep quad bias.', vector: 'Sink into lengthened quad tension before driving up.', catch: 'Pause in the loaded stretch.', anti_pattern: 'Do not shorten range to move more load.' } }),
    sculptorExercise({ id: 'split-squat', slug: 'deficit_bulgarian_split_squat', name: 'Deficit Bulgarian Split Squat', movement_pattern: 'lunge', primary_muscle: 'quads', default_sets: 3, default_reps: 10, synergist_muscles: ['glutes'], cns_fatigue_cost: 4, stretch_mediated_hypertrophy: true, biomechanical_instructions: { setup: 'Stack ribs over pelvis on the lead leg.', vector: 'Own unilateral stability while the front quad lengthens.', catch: 'Pause with control in the deficit.', anti_pattern: 'Do not let the pelvis twist to escape tension.' } }),
    sculptorExercise({ id: 'smith-split-squat', slug: 'smith_machine_split_squat', name: 'Smith Machine Split Squat', movement_pattern: 'lunge', primary_muscle: 'quads', default_sets: 3, default_reps: 10, synergist_muscles: ['glutes'], cns_fatigue_cost: 3, stretch_mediated_hypertrophy: true, biomechanical_instructions: { setup: 'Anchor the lead foot and use the rail for balance.', vector: 'Bias the front leg with slow unilateral control.', catch: 'Hold the stretched bottom without losing knee track.', anti_pattern: 'Do not turn the rep into a bilateral press.' } }),
    sculptorExercise({ id: 'leg-extension', slug: 'leg_extension', name: 'Leg Extension', movement_pattern: 'isolation', primary_muscle: 'quads', default_sets: 4, default_reps: 15, cns_fatigue_cost: 1 }),
    sculptorExercise({ id: 'rdl', slug: 'barbell_romanian_deadlift', name: 'Barbell Romanian Deadlift', movement_pattern: 'hinge', primary_muscle: 'hamstrings', default_sets: 4, default_reps: 8, synergist_muscles: ['glutes'], cns_fatigue_cost: 4, joint_stress_profile: 'lumbar_shear', stretch_mediated_hypertrophy: true }),
    sculptorExercise({ id: 'hip-thrust', slug: 'hip_thrust_barbell', name: 'Hip Thrust Barbell', movement_pattern: 'hinge', primary_muscle: 'glutes', default_sets: 4, default_reps: 10, synergist_muscles: ['hamstrings'], cns_fatigue_cost: 3, stretch_mediated_hypertrophy: true }),
    sculptorExercise({ id: 'seated-curl', slug: 'seated_leg_curl', name: 'Seated Leg Curl', movement_pattern: 'isolation', primary_muscle: 'hamstrings', default_sets: 4, default_reps: 12, cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    sculptorExercise({ id: 'lying-curl', slug: 'lying_leg_curl', name: 'Lying Leg Curl', movement_pattern: 'isolation', primary_muscle: 'hamstrings', default_sets: 4, default_reps: 12, cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
    sculptorExercise({ id: 'calf', slug: 'seated_calf_raise', name: 'Seated Calf Raise', movement_pattern: 'isolation', primary_muscle: 'calves', default_sets: 4, default_reps: 15, cns_fatigue_cost: 1, stretch_mediated_hypertrophy: true }),
  ];
}

function deadlockCatalog(): LibraryExercise[] {
  return [
    sculptorExercise({ id: 'pushup', slug: 'push_up', name: 'Push Up', movement_pattern: 'push', primary_muscle: 'chest', equipment_required: [], cns_fatigue_cost: 2 }),
    sculptorExercise({ id: 'machine-chest', slug: 'machine_chest_press', name: 'Machine Chest Press', movement_pattern: 'push', primary_muscle: 'chest', synergist_muscles: ['triceps'], cns_fatigue_cost: 2 }),
    sculptorExercise({ id: 'cable-fly', slug: 'cable_fly', name: 'Cable Fly', movement_pattern: 'isolation', primary_muscle: 'chest', default_sets: 3, default_reps: 12, synergist_muscles: ['triceps'], cns_fatigue_cost: 1 }),
    sculptorExercise({ id: 'pec-deck', slug: 'pec_deck', name: 'Pec Deck', movement_pattern: 'isolation', primary_muscle: 'chest', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1 }),
    sculptorExercise({ id: 'pushdown', slug: 'cable_pushdown', name: 'Cable Pushdown', movement_pattern: 'isolation', primary_muscle: 'triceps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1 }),
    sculptorExercise({ id: 'oh-triceps', slug: 'overhead_tricep_extension', name: 'Overhead Tricep Extension', movement_pattern: 'isolation', primary_muscle: 'triceps', default_sets: 3, default_reps: 12, cns_fatigue_cost: 1 }),
    sculptorExercise({ id: 'row', slug: 'chest_supported_row', name: 'Chest Supported Row', movement_pattern: 'pull', primary_muscle: 'back', cns_fatigue_cost: 2 }),
    sculptorExercise({ id: 'pulldown', slug: 'iliac_lat_pulldown', name: 'Iliac Lat Pulldown', movement_pattern: 'pull', primary_muscle: 'back', cns_fatigue_cost: 2 }),
    sculptorExercise({ id: 'curl', slug: 'bayesian_curl', name: 'Bayesian Curl', movement_pattern: 'isolation', primary_muscle: 'biceps', default_sets: 3, cns_fatigue_cost: 1 }),
    sculptorExercise({ id: 'squat', slug: 'hack_squat_machine', name: 'Hack Squat Machine', movement_pattern: 'squat', primary_muscle: 'quads', default_reps: 8, cns_fatigue_cost: 3 }),
    sculptorExercise({ id: 'lunge', slug: 'smith_machine_split_squat', name: 'Smith Split Squat', movement_pattern: 'lunge', primary_muscle: 'quads', default_reps: 10, cns_fatigue_cost: 3 }),
    sculptorExercise({ id: 'hinge', slug: 'hip_thrust_barbell', name: 'Hip Thrust', movement_pattern: 'hinge', primary_muscle: 'glutes', cns_fatigue_cost: 3 }),
    sculptorExercise({ id: 'leg-extension', slug: 'leg_extension', name: 'Leg Extension', movement_pattern: 'isolation', primary_muscle: 'quads', default_sets: 4, default_reps: 15, cns_fatigue_cost: 1 }),
    sculptorExercise({ id: 'leg-curl', slug: 'lying_leg_curl', name: 'Lying Leg Curl', movement_pattern: 'isolation', primary_muscle: 'hamstrings', default_sets: 4, default_reps: 12, cns_fatigue_cost: 1 }),
    sculptorExercise({ id: 'calf', slug: 'seated_calf_raise', name: 'Seated Calf Raise', movement_pattern: 'isolation', primary_muscle: 'calves', default_sets: 4, default_reps: 15, cns_fatigue_cost: 1 }),
  ];
}

function realProfile(overrides: Partial<BiologicalProfile> = {}): BiologicalProfile {
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

async function generateSculptorGameplan(input?: {
  biological?: Partial<BiologicalProfile>;
  equipment?: EquipmentTag[];
  performanceLogs?: PerformanceLogEntry[];
}) {
  return generateDeterministicGameplan({
    focus,
    equipment: input?.equipment ?? fullGym,
    biological: realProfile(input?.biological),
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

describe('SOMMA Iron Sculptor Pipeline', () => {
  beforeEach(() => {
    catalogState.current = fullSculptorCatalog();
  });

  it('deve proteger o atleta de junk volume em finishers mesmo com tempo sobrando', async () => {
    const gameplan = await generateSculptorGameplan({
      biological: { available_time_iron: 180 },
    });
    const byId = catalogById();
    const exercises = allIronExercises(gameplan.microcycle);

    expect(exercises.length).toBeGreaterThan(0);

    for (const prescription of exercises) {
      const meta = byId.get(prescription.exercise_id);
      const technique = prescription.execution_technique?.toLowerCase() ?? '';
      const isMyoOrFinisher = technique.includes('myo') || /finisher/i.test(prescription.progression_note ?? '');

      // Isoladores em Myo-Reps são cinzeladas metabólicas: acima de 4 séries vira lixo local, não estímulo.
      if (isMyoOrFinisher) {
        expect(prescription.target_sets).toBeLessThanOrEqual(4);
      }

      // Compostos pesados têm custo neural/articular alto; 8 séries é teto de proteção sistêmica.
      if (meta?.movement_pattern !== 'isolation') {
        expect(prescription.target_sets).toBeLessThanOrEqual(8);
      }
    }

    const oldBugTargets = exercises.filter((row) =>
      /face_pull|leg_extension|lying_leg_curl/i.test(`${row.slug ?? ''} ${row.display_name ?? ''}`),
    );
    expect(oldBugTargets.every((row) => row.target_sets <= 4)).toBe(true);
  });

  it('deve adaptar o treino em deadlock e manter presença neuromuscular mínima', async () => {
    catalogState.current = deadlockCatalog();
    const logs = [
      highVolumeLog('pushup', 8, '2026-06-01T10:00:00.000Z'),
      highVolumeLog('machine-chest', 8, '2026-06-02T10:00:00.000Z'),
      highVolumeLog('cable-fly', 8, '2026-06-03T10:00:00.000Z'),
      highVolumeLog('pushdown', 8, '2026-06-01T11:00:00.000Z'),
      highVolumeLog('oh-triceps', 8, '2026-06-02T11:00:00.000Z'),
      highVolumeLog('pec-deck', 8, '2026-06-03T11:00:00.000Z'),
    ];

    const gameplan = await generateSculptorGameplan({
      performanceLogs: logs,
      biological: { iron_mastery: 5, available_time_iron: 90 },
    });
    const pushB = gameplan.microcycle.find((day) => day.day_index === 5);
    const exercises = pushB ? ironExercises(pushB) : [];

    expect(pushB?.is_rest_day).toBe(false);

    // MRV_HARD protege contra overtraining sistêmico; fallback preserva frequência sem abandonar o atleta.
    expect(exercises).not.toHaveLength(0);
    expect(exercises.length).toBeGreaterThanOrEqual(2);
    expect(exercises.slice(0, 2).every((row) => row.target_sets === 2)).toBe(true);
  });

  it('deve periodizar Legs A e Legs B com estímulos, tempos e cues diferentes', async () => {
    const gameplan = await generateSculptorGameplan({
      biological: {
        weight_kg: 57,
        training_days_per_week: 6,
        frequency_iron: 6,
        available_time_iron: 90,
        baseline_stress_level: 3,
      },
      equipment: ['full_gym'],
    });

    const legsA = gameplan.microcycle.find((day) => day.day_index === 3);
    const legsB = gameplan.microcycle.find((day) => day.day_index === 7);
    expect(legsA).toBeDefined();
    expect(legsB).toBeDefined();

    const legsAExercises = ironExercises(legsA!);
    const legsBExercises = ironExercises(legsB!);

    // Legs A: tensão mecânica pura pede compostos pesados, reps baixas e falha técnica controlada.
    expect(legsAExercises.some((row) => /5-8/.test(row.target_rep_range ?? '') || row.target_reps <= 8)).toBe(true);
    expect(legsAExercises.some((row) => row.cue_card?.failure_type === 'technical')).toBe(true);

    // Legs B: estabilidade/stretch reduz custo de SNC e desloca a falha para contração local.
    expect(legsBExercises.some((row) => row.target_reps >= 10 && row.target_reps <= 15)).toBe(true);
    expect(legsBExercises.some((row) => row.cue_card?.failure_type === 'concentric')).toBe(true);

    const legsATempos = new Set(legsAExercises.map((row) => JSON.stringify(row.tempo)));
    const legsBTempos = new Set(legsBExercises.map((row) => JSON.stringify(row.tempo)));
    const sharedTempos = [...legsATempos].filter((tempo) => legsBTempos.has(tempo));

    // Tempo diferente prova que o coach periodiza o tecido-alvo, não só troca nomes de exercícios.
    expect(sharedTempos.length).toBeLessThan(Math.max(legsATempos.size, legsBTempos.size));
    expect(legsAExercises[0]?.cue_card?.vector).not.toBe(legsBExercises[0]?.cue_card?.vector);
  });

  it('deve blindar o estado contra cache legado com isolador de 36 séries e dia vazio', () => {
    const poisoned: MicrocycleDay[] = [
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
              routine_id: 'poisoned-leg-day',
              exercises: [
                {
                  exercise_id: 'leg-extension',
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
            subtitle: 'Empty Legacy Block',
            duration_minutes: 90,
            order: 0,
            status: 'pending',
            iron: { routine_id: 'empty-legacy', exercises: [] },
          },
        ],
      },
    ];

    const sanitized = sanitizeMicrocycleIronVolume(poisoned);
    const legExtension = sanitized[1]?.blocks[0]?.iron?.exercises[0];

    // Cache envenenado não pode reentrar no app com volume acima do teto fisiológico de isolador.
    expect(legExtension?.target_sets).toBeLessThanOrEqual(4);

    // Dia Iron vazio é abandono; se não for reparado nesta camada, precisa ser marcado para regeneração limpa.
    expect(isDegenerateMicrocycle(sanitized, 3)).toBe(true);
  });
});
