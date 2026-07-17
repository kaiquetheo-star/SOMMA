import { describe, expect, it } from 'vitest';

import { ELITE_EXERCISES } from '@/lib/catalog/eliteCatalog';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import {
  applyDoubleProgression,
  findBestWorkingSet,
} from '@/lib/gameplan/engine/iron/loadPrescriptionMapper';
import {
  enforceWeeklyAuthority,
  primaryWeeklyVolumeSnapshot,
} from '@/lib/gameplan/engine/iron/volumeAuthority';
import { VOLUME_MATRIX } from '@/lib/gameplan/engine/iron/volumeMatrix';
import { createWeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import type { IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';

const catalog = buildExerciseCatalog([...ELITE_EXERCISES]);
const pplLimits = VOLUME_MATRIX.twice_per_week;

function prescription(
  slug: string,
  targetSets: number,
  diagnosticReason?: string,
): IronExercisePrescription {
  const row = catalog.bySlug.get(slug);
  if (!row) throw new Error(`Missing elite slug: ${slug}`);
  return {
    exercise_id: row.id,
    slug: row.slug,
    display_name: row.name,
    target_sets: targetSets,
    target_reps: row.default_reps,
    target_rep_range: `${Math.max(6, row.default_reps - 2)}-${row.default_reps} @ 2 RIR`,
    target_rir: 2,
    target_weight_kg: 60,
    rest_seconds: 120,
    progression_note: 'fixture',
    execution_technique: 'Standard',
    diagnostic_reason: diagnosticReason,
    slot_category: row.slot_category,
  };
}

function dayWithExercises(
  dayIndex: number,
  focus: string,
  exercises: IronExercisePrescription[],
): MicrocycleDay {
  return {
    day_index: dayIndex,
    is_rest_day: false,
    focus_label: focus,
    date: `2026-06-${String(7 + dayIndex).padStart(2, '0')}`,
    blocks: [
      {
        id: `block-d${dayIndex}-iron`,
        pillar: 'iron',
        title: focus,
        subtitle: focus,
        duration_minutes: 90,
        order: 0,
        status: 'pending',
        iron: { routine_id: `iron_d${dayIndex}`, exercises },
      },
    ],
  };
}

describe('volumeAuthority — weekly MRV integrity', () => {
  it('prunes inject/rescue overshoot so primary muscle leaves MRV_HARD and lands at or under MRV_SOFT', () => {
    // Simulate post-pass MVP fillers that shoved chest far past hard MRV (PPL 2× = 22 hard / 18 soft).
    const overshot: MicrocycleDay[] = [
      dayWithExercises(1, 'Iron: Push', [
        prescription('barbell_bench_press', 8, 'minimum_viable_path_absolute_last_resort'),
        prescription('close_grip_bench_press', 8, 'volume_floor_fallback'),
        prescription('dumbbell_fly_flat', 8, 'minimum_viable_filler'),
      ]),
      dayWithExercises(4, 'Iron: Push', [
        prescription('push_up', 8, 'injectMinimumViable'),
        prescription('barbell_bench_press', 4, 'minimum_viable_path_absolute_last_resort'),
      ]),
      {
        day_index: 2,
        is_rest_day: true,
        focus_label: 'Rest',
        date: '2026-06-09',
        blocks: [],
      },
    ];

    const before = primaryWeeklyVolumeSnapshot(overshot, catalog);
    expect(before.get('chest') ?? 0).toBeGreaterThan(pplLimits.mrvHard);

    const tracker = createWeeklyVolumeTracker(catalog, [], [], {
      preferred_split: 'ppl_x2',
      hormonal_transition: false,
    });

    const enforced = enforceWeeklyAuthority(overshot, tracker, catalog, 'ppl_x2');
    const after = primaryWeeklyVolumeSnapshot(enforced, catalog);

    expect(after.get('chest') ?? 0).toBeLessThanOrEqual(pplLimits.mrvSoft);
    expect(after.get('chest') ?? 0).toBeLessThanOrEqual(pplLimits.mrvHard);

    const allSets = enforced.flatMap(
      (day) => day.blocks.find((b) => b.pillar === 'iron')?.iron?.exercises ?? [],
    );
    expect(allSets.some((ex) => (ex.diagnostic_reason ?? '').includes('volume_authority'))).toBe(
      true,
    );
  });

  it('respects maxSetsSession on the final day snapshot', () => {
    const day: MicrocycleDay[] = [
      dayWithExercises(1, 'Iron: Push', [
        prescription('barbell_bench_press', 8),
        prescription('dumbbell_fly_flat', 8),
        prescription('push_up', 8),
      ]),
    ];

    const tracker = createWeeklyVolumeTracker(catalog, [], [], {
      preferred_split: 'ppl_x2',
    });
    const enforced = enforceWeeklyAuthority(day, tracker, catalog, 'ppl_x2');
    const chestSets = (enforced[0]?.blocks[0]?.iron?.exercises ?? [])
      .filter((ex) => catalog.bySlug.get(ex.slug ?? '')?.primary_muscle === 'chest')
      .reduce((sum, ex) => sum + ex.target_sets, 0);

    expect(chestSets).toBeLessThanOrEqual(pplLimits.maxSetsSession);
  });

  it('heavy prior-week logs do not shrink prescribed sets via recovery levers', () => {
    const microcycle: MicrocycleDay[] = [
      dayWithExercises(1, 'Iron: Push', [prescription('barbell_bench_press', 10)]),
    ];
    const tracker = createWeeklyVolumeTracker(catalog, [], [], {
      preferred_split: 'ppl_x2',
      hormonal_transition: true,
    });

    const enforced = enforceWeeklyAuthority(microcycle, tracker, catalog, 'ppl_x2');
    const sets = enforced[0]?.blocks[0]?.iron?.exercises?.[0]?.target_sets;
    expect(sets).toBe(10);
  });
});

describe('loadPrescriptionMapper — Best Working Set + double progression', () => {
  it('anchors on best working set that hit rep top, ignoring lighter drop-set failure', () => {
    const log: EnginePerformanceRow = {
      pillar: 'iron',
      exercise_id: catalog.bySlug.get('barbell_bench_press')!.id,
      weight_used: 50,
      reps_completed: 6,
      rpe_score: 10,
      timestamp: '2026-06-10T12:00:00.000Z',
      payload: {
        iron: {
          exercise_id: catalog.bySlug.get('barbell_bench_press')!.id,
          exercise_slug: 'barbell_bench_press',
          sets: [
            { weight_kg: 80, reps: 10, reported_rir: 2 },
            { weight_kg: 80, reps: 10, reported_rir: 2 },
            { weight_kg: 50, reps: 6, reported_rir: 0 },
          ],
        },
      },
    };

    const best = findBestWorkingSet(log, 10);
    expect(best?.weightKg).toBe(80);
    expect(best?.reps).toBe(10);
  });

  it('holds load and asks for more reps when rep top was missed', () => {
    const result = applyDoubleProgression({
      weightKg: 100,
      bestSetReps: 8,
      targetRepsTop: 10,
    });
    expect(result.weight).toBe(100);
    expect(result.note).toMatch(/add reps/i);
  });

  it('applies +2.5% after hitting DUP rep top', () => {
    const result = applyDoubleProgression({
      weightKg: 100,
      bestSetReps: 10,
      targetRepsTop: 10,
    });
    expect(result.weight).toBe(102.5);
    expect(result.note).toMatch(/\+2\.5%/);
  });
});
