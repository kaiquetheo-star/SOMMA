import { beforeAll, describe, expect, it } from 'vitest';
import { FULL_BUNDLED_EXERCISES } from '@/lib/catalog/bundledCatalog.full';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import type { DailyGameplan, IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';
import type { LibraryExercise } from '@/types/catalog';
import type { UserBiological } from '@/types/biological';

const userBiological: UserBiological = {
  date_of_birth: '1994-05-14',
  weight_kg: 57,
  height_cm: 158,
  body_fat_percentage: 18,
  current_injuries: null,
  baseline_stress_level: 3,
  goal_iron: 'Hypertrophy',
  nutrition_goal: null,
  training_days_per_week: 6,
  experience_level: null,
  available_time_iron: 90,
  iron_mastery: null,
  frequency_iron: 6,
  cns_fatigue_score: 0,
  clinical_exit_interview: null,
  current_body_fat_estimate: 18,
  hormonal_transition: false,
};

const BARBELL_OVERHEAD_PRESS_FIXTURE: LibraryExercise = {
  id: 'fixture-barbell-overhead-press',
  slug: 'barbell_overhead_press',
  name: 'Barbell Overhead Press',
  biomechanical_instructions: {
    setup: 'Stand tall with the barbell at shoulder height.',
    concentric: 'Press overhead without leaning back.',
    eccentric: 'Lower under control.',
    safety: 'Brace before each rep.',
  },
  equipment_required: ['barbell', 'full_gym'],
  default_sets: 4,
  default_reps: 8,
  movement_pattern: 'push',
  primary_muscle: 'shoulders',
  synergist_muscles: ['triceps'],
  cns_fatigue_cost: 4,
  joint_stress_profile: 'low_impact',
  stretch_mediated_hypertrophy: false,
};

function ironExercisesForDay(day: MicrocycleDay): IronExercisePrescription[] {
  const iron = day.blocks.find((block) => block.pillar === 'iron');
  expect(iron?.iron?.exercises).toBeDefined();
  return iron?.iron?.exercises ?? [];
}

describe('Slot Category Overrides', () => {
  const catalog = buildExerciseCatalog(FULL_BUNDLED_EXERCISES);
  let microcycle: DailyGameplan['microcycle'];

  beforeAll(async () => {
    const gameplan = await generateDeterministicGameplan({
      focus: { iron: 100, nutrition: 100 },
      equipment: ['full_gym'],
      biological: userBiological,
      userStats: {
        iron_sessions_completed: 0,
        nutrition_checkins_completed: 0,
      },
      performanceLogs: [],
      protocolDate: '2026-06-09',
    });

    microcycle = gameplan.microcycle;
  });

  it('leg_curl deve ser hamstring_curl, não biceps_curl', () => {
    const ex = catalog.bySlug.get('leg_curl');

    expect(ex?.slot_category).toBe('hamstring_curl');
  });

  it('45_lateral_raises deve ser shoulder_lateral_raise, não calf_raise', () => {
    const ex = catalog.bySlug.get('45_lateral_raises');

    expect(ex?.slot_category).toBe('shoulder_lateral_raise');
  });

  it('corrige os seis slugs críticos de slot_category', () => {
    expect(catalog.bySlug.get('calf_press_using_leg_press_machine')?.slot_category).toBe('calf_raise');
    expect(catalog.bySlug.get('bent_over_lateral_raises')?.slot_category).toBe('shoulder_posterior_fly');
    expect(catalog.bySlug.get('biceps_curl_machine')?.slot_category).toBe('biceps_curl');
    expect(catalog.bySlug.get('calf_raises_on_hackenschmitt_machine')?.slot_category).toBe('calf_raise_seated');
  });

  it('corrige axial_loading dos exercícios axiais ambíguos', () => {
    const fallbackSlugCatalog = buildExerciseCatalog([BARBELL_OVERHEAD_PRESS_FIXTURE]);

    expect(catalog.bySlug.get('barbell_seated_behind_head_military_press')?.axial_loading).toBe(2);
    expect(catalog.bySlug.get('barbell_silverback_shrug')?.axial_loading).toBe(2);
    expect(catalog.bySlug.get('overhead_barbell_press')?.axial_loading).toBe(3);
    expect(fallbackSlugCatalog.bySlug.get('barbell_overhead_press')?.axial_loading).toBe(3);
  });

  it('Dia 5 (Posterior) deve ter hinge_compound prioritário (RDL / stiff / hip thrust)', () => {
    const day5 = microcycle.find((day) => day.day_index === 5);

    expect(day5).toBeDefined();
    if (!day5) return;

    const exercises = ironExercisesForDay(day5);
    const hasPriorityHinge = exercises.some((exercise) => {
      const slug = exercise.slug ?? '';
      return (
        exercise.slot_category === 'hinge_compound' ||
        [
          'romanian_deadlift',
          'barbell_romanian_deadlift',
          'dumbbell_romanian_deadlift',
          'stiff_leg_deadlift',
          'stiff_legged_deadlifts',
          'dumbbell_stiff_leg_deadlift',
          'hip_thrust_barbell',
          'barbell_hip_hinge_good_morning',
        ].includes(slug)
      );
    });

    expect(hasPriorityHinge).toBe(true);
  });
});
