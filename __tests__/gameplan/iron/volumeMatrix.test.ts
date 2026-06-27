import { describe, expect, it } from 'vitest';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import {
  resolveDayFocusMuscles,
  resolveVolumeMatrix,
  VOLUME_MATRIX,
} from '@/lib/gameplan/engine/iron/volumeMatrix';
import {
  ABCDE_MEV,
  createWeeklyVolumeTracker,
  type VolumeCreditContext,
} from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import type { LibraryExercise } from '@/types/catalog';
import { initialBiologicalProfile } from '@/types/biological';

function mockExercise(partial: Partial<CatalogExercise> & Pick<CatalogExercise, 'id' | 'slug'>): CatalogExercise {
  return {
    name: partial.name ?? partial.slug,
    biomechanical_instructions: {},
    movement_pattern: partial.movement_pattern ?? 'push',
    primary_muscle: partial.primary_muscle ?? 'chest',
    synergist_muscles: partial.synergist_muscles ?? [],
    cns_fatigue_cost: partial.cns_fatigue_cost ?? 3,
    complexity_level: partial.complexity_level ?? 3,
    joint_stress_profile: partial.joint_stress_profile ?? 'low_impact',
    equipment_required: partial.equipment_required ?? ['full_gym'],
    default_sets: partial.default_sets ?? 4,
    default_reps: partial.default_reps ?? 8,
    stretch_mediated_hypertrophy: partial.stretch_mediated_hypertrophy ?? false,
    selection_score: partial.selection_score ?? 1,
    tempo: partial.tempo ?? [3, 1, 1, 1],
    cue_card: {
      setup: 'Set up.',
      vector: 'Move.',
      catch: 'Control.',
      anti_pattern: 'No bounce.',
      failure_type: 'technical',
    },
    ...partial,
  };
}

function buildCatalog(exercises: CatalogExercise[]) {
  const rows: LibraryExercise[] = exercises.map((exercise) => ({
    id: exercise.id,
    slug: exercise.slug,
    name: exercise.name,
    biomechanical_instructions: exercise.biomechanical_instructions,
    equipment_required: [...exercise.equipment_required],
    default_sets: exercise.default_sets,
    default_reps: exercise.default_reps,
    movement_pattern: exercise.movement_pattern,
    primary_muscle: exercise.primary_muscle,
    synergist_muscles: [...exercise.synergist_muscles],
    cns_fatigue_cost: exercise.cns_fatigue_cost,
    joint_stress_profile: exercise.joint_stress_profile,
    stretch_mediated_hypertrophy: exercise.stretch_mediated_hypertrophy,
  }));
  return buildExerciseCatalog(rows);
}

const benchPress = mockExercise({
  id: 'ex-bench',
  slug: 'barbell_bench_press',
  primary_muscle: 'chest',
  synergist_muscles: ['front_delts', 'triceps'],
});

const catalog = buildCatalog([benchPress]);

function trackerWithContext(ctx: VolumeCreditContext) {
  return createWeeklyVolumeTracker(catalog, [], [], initialBiologicalProfile, ctx);
}

describe('resolveVolumeMatrix', () => {
  it('ABCDE → MEV 14, MRV_SOFT 22, maxSetsSession 16', () => {
    const row = resolveVolumeMatrix('abcde');
    expect(row.mev).toBe(14);
    expect(row.mrvSoft).toBe(22);
    expect(row.mrvHard).toBe(26);
    expect(row.maxSetsSession).toBe(16);
  });

  it('PPL×2 → MEV 10, MRV_SOFT 18, maxSetsSession 12', () => {
    const row = resolveVolumeMatrix('ppl_x2');
    expect(row.mev).toBe(10);
    expect(row.mrvSoft).toBe(18);
    expect(row.mrvHard).toBe(22);
    expect(row.maxSetsSession).toBe(12);
  });

  it('exports ABCDE_MEV alias at 14', () => {
    expect(ABCDE_MEV).toBe(VOLUME_MATRIX.once_per_week.mev);
    expect(ABCDE_MEV).toBe(14);
  });
});

describe('resolveDayFocusMuscles', () => {
  it('maps ABCDE day 1 push focus to catalog muscle keys', () => {
    const focus = resolveDayFocusMuscles('abcde', 1);
    expect(focus.has('chest')).toBe(true);
    expect(focus.has('triceps')).toBe(true);
    expect(focus.has('front_delts')).toBe(true);
  });

  it('maps ABCDE day 6 arms focus', () => {
    const focus = resolveDayFocusMuscles('abcde', 6);
    expect(focus.has('biceps')).toBe(true);
    expect(focus.has('triceps')).toBe(true);
  });
});

describe('creditVolume synergist fractions', () => {
  it('1× split + synergist on day focus → 1.0× credit', () => {
    const tracker = trackerWithContext({
      frequencyClass: 'once_per_week',
      dayFocusMuscles: new Set(['chest', 'triceps', 'front_delts']),
    });
    tracker.creditVolume(benchPress, 4);
    expect(tracker.completedSetsForMuscle('chest')).toBe(4);
    expect(tracker.completedSetsForMuscle('triceps')).toBe(4);
    expect(tracker.completedSetsForMuscle('front_delts')).toBe(4);
  });

  it('2× split → synergists receive 0.5× credit', () => {
    const tracker = trackerWithContext({
      frequencyClass: 'twice_per_week',
      dayFocusMuscles: new Set(['chest', 'triceps']),
    });
    tracker.creditVolume(benchPress, 4);
    expect(tracker.completedSetsForMuscle('triceps')).toBe(2);
    expect(tracker.completedSetsForMuscle('front_delts')).toBe(2);
  });

  it('1× split + synergist outside day focus → 0.5× credit', () => {
    const tracker = trackerWithContext({
      frequencyClass: 'once_per_week',
      dayFocusMuscles: new Set(['quads']),
    });
    tracker.creditVolume(benchPress, 4);
    expect(tracker.completedSetsForMuscle('triceps')).toBe(2);
    expect(tracker.completedSetsForMuscle('front_delts')).toBe(2);
  });

  it('primary muscle always receives 1.0× credit', () => {
    const tracker = trackerWithContext({
      frequencyClass: 'twice_per_week',
      dayFocusMuscles: new Set(),
    });
    tracker.creditVolume(benchPress, 5);
    expect(tracker.completedSetsForMuscle('chest')).toBe(5);
  });

  it('debitVolume mirrors creditVolume fractions', () => {
    const tracker = trackerWithContext({
      frequencyClass: 'once_per_week',
      dayFocusMuscles: new Set(['chest', 'triceps', 'front_delts']),
    });
    tracker.creditVolume(benchPress, 4);
    tracker.debitVolume(benchPress, 4);
    expect(tracker.completedSetsForMuscle('chest')).toBe(0);
    expect(tracker.completedSetsForMuscle('triceps')).toBe(0);
    expect(tracker.completedSetsForMuscle('front_delts')).toBe(0);
  });
});

describe('canAddSets respects split MRV_HARD', () => {
  const chestIsolation = mockExercise({
    id: 'ex-fly',
    slug: 'cable_fly',
    movement_pattern: 'isolation',
    primary_muscle: 'chest',
    synergist_muscles: [],
  });
  const isolationCatalog = buildCatalog([chestIsolation]);

  it('ABCDE blocks above MRV_HARD 26', () => {
    const tracker = createWeeklyVolumeTracker(
      isolationCatalog,
      [],
      [],
      { ...initialBiologicalProfile, preferred_split: 'abcde' },
    );
    tracker.creditVolume(chestIsolation, 8);
    tracker.creditVolume(chestIsolation, 8);
    tracker.creditVolume(chestIsolation, 8);
    const blocked = tracker.canAddSets(chestIsolation, 8);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('26');
  });

  it('PPL blocks above MRV_HARD 22', () => {
    const tracker = createWeeklyVolumeTracker(
      isolationCatalog,
      [],
      [],
      { ...initialBiologicalProfile, preferred_split: 'ppl_x2' },
    );
    tracker.creditVolume(chestIsolation, 8);
    tracker.creditVolume(chestIsolation, 8);
    const blocked = tracker.canAddSets(chestIsolation, 8);
    expect(blocked.allowed).toBe(false);
    expect(blocked.reason).toContain('22');
  });
});

describe('setVolumeCreditContext', () => {
  it('updates synergist fractions mid-session deterministically', () => {
    const tracker = createWeeklyVolumeTracker(
      catalog,
      [],
      [],
      { ...initialBiologicalProfile, preferred_split: 'abcde' },
    );

    tracker.setVolumeCreditContext({
      frequencyClass: 'once_per_week',
      dayFocusMuscles: new Set(['quads']),
    });
    tracker.creditVolume(benchPress, 4);
    expect(tracker.completedSetsForMuscle('triceps')).toBe(2);

    tracker.setVolumeCreditContext({
      frequencyClass: 'once_per_week',
      dayFocusMuscles: resolveDayFocusMuscles('abcde', 1),
    });
    tracker.creditVolume(benchPress, 4);
    expect(tracker.completedSetsForMuscle('triceps')).toBe(6);
  });
});
