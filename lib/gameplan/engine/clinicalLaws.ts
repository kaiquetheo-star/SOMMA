import type { LibraryExercise } from '@/types/catalog';
import { applyFivePhaseClinicalMatrix, classifyClinicalPhase } from '@/lib/gameplan/engine/clinicalMatrix';
import type {
  GameplanBlock,
  IronExercisePrescription,
  MicrocycleDay,
} from '@/types/gameplan';
import type { PerformanceQueueItem } from '@/types/performance';

const TITLE_CASE_SMALL_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'for',
  'with',
  'on',
  'at',
  'to',
  'in',
  'vs',
]);

/** Neuro-Mechanical Recruitment — Iron exercise buckets (1 = first) — alias of ClinicalPhase */
export type IronRecruitmentRank = 1 | 2 | 3 | 4 | 5;

/** Clinical Law III — CNS fatigue deltas (sync.ts) */
export const CNS_DELTA_IRON_SET = 2;
export const CNS_FATIGUE_MAX = 100;
/** Rolling profile score at/above this → poor_recovery autoreg (Clinical Law III) */
export const CNS_FATIGUE_AUTOREG_THRESHOLD = 70;

/** Clinical Law III — Mesocycle deload */
export const DELOAD_MESOCYCLE_WEEK = 4;
export const DELOAD_IRON_EXERCISE_CAP = 4;
export const DELOAD_LOAD_FACTOR = 0.6;

/** Clinical Law II — Subjective readiness autoreg */
export const READINESS_AUTOREG_THRESHOLD = 4;
export const READINESS_LOAD_FACTOR = 0.85;

export const BIOMECH_SLUG_MALASANA = 'squat_malasana';
export const BIOMECH_SLUG_CHEST_OPENER = 'sphinx';

/** Strip numeric catalog prefixes and normalize title case for UI */
export function beautifyCatalogName(raw: string): string {
  let name = raw.trim();
  name = name.replace(/^\d{3,6}\s*[-–—:]?\s*/i, '');
  name = name.replace(/^exercise\s+/i, '');
  name = name.replace(/\s{2,}/g, ' ');

  return name
    .split(/\s+/)
    .map((word, index) => {
      if (word.includes('(')) {
        return word.replace(/[A-Za-zÀ-ÿ]+/g, (segment) => {
          const lower = segment.toLowerCase();
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        });
      }
      const lower = word.toLowerCase();
      if (index > 0 && TITLE_CASE_SMALL_WORDS.has(lower)) return lower;
      if (word === word.toUpperCase() && word.length <= 4) return word;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function catalogMetaForExercise(
  exerciseId: string,
  catalog: LibraryExercise[],
): LibraryExercise | undefined {
  return catalog.find((row) => row.id === exerciseId);
}

export function classifyIronRecruitmentRank(
  meta: LibraryExercise | undefined,
  prerequisiteSlugs: string[] = [],
): IronRecruitmentRank {
  return classifyClinicalPhase(meta, prerequisiteSlugs);
}

/** 5-Phase Clinical Matrix — stable sort Iron prescriptions after slot fill */
export function sortIronExercises(
  exercises: IronExercisePrescription[],
  catalog: LibraryExercise[],
  prerequisiteSlugs: string[] = [],
): IronExercisePrescription[] {
  const withNames = exercises.map((exercise) => {
    const meta = catalogMetaForExercise(exercise.exercise_id, catalog);
    return {
      ...exercise,
      display_name: beautifyCatalogName(meta?.name ?? exercise.display_name ?? 'Exercise'),
    };
  });

  return applyFivePhaseClinicalMatrix(withNames, catalog, prerequisiteSlugs);
}

function orderGameplanBlock(
  block: GameplanBlock,
  catalog: LibraryExercise[],
  prerequisiteSlugs: string[],
): GameplanBlock {
  if (block.pillar === 'iron' && block.iron?.exercises?.length) {
    const exercises = sortIronExercises(block.iron.exercises, catalog, prerequisiteSlugs);
    const subtitle = exercises
      .map((row) => row.display_name)
      .filter(Boolean)
      .join(' · ');
    return {
      ...block,
      subtitle: subtitle || block.subtitle,
      iron: { ...block.iron, exercises },
    };
  }

  return block;
}

/** Apply recruitment ordering to every training day before Zustand / cache persistence */
export function applyNeuroMechanicalOrderingToMicrocycle(
  microcycle: MicrocycleDay[],
  catalog: LibraryExercise[],
): MicrocycleDay[] {
  return microcycle.map((day) => {
    if (day.is_rest_day || day.blocks.length === 0) return day;

    let ironNames: string[] = [];
    const ironBlock = day.blocks.find((block) => block.pillar === 'iron');
    if (ironBlock) {
      ironNames = ironExerciseNamesFromBlock(ironBlock, catalog);
    }
    const prerequisiteSlugs = resolveBiomechanicalPrerequisiteSlugs(ironNames);

    const blocks = day.blocks.map((block) =>
      orderGameplanBlock(block, catalog, prerequisiteSlugs),
    );

    return { ...day, blocks };
  });
}

export function clampMesocycleWeek(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 1;
  return Math.min(4, Math.max(1, Math.round(value)));
}

export function clampCnsFatigueScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(CNS_FATIGUE_MAX, Math.max(0, Math.round(value * 10) / 10));
}

export function isDeloadMesocycleWeek(mesocycleWeek: number): boolean {
  return clampMesocycleWeek(mesocycleWeek) === DELOAD_MESOCYCLE_WEEK;
}

function normalizeExerciseName(name: string): string {
  return name.toLowerCase();
}

/** Clinical Law IV — hip primers after squat / leg press patterns */
export function ironBlockNeedsHipPrimer(exerciseNames: string[]): boolean {
  return exerciseNames.some((name) => {
    const n = normalizeExerciseName(name);
    return (
      /\bsquat\b/.test(n) ||
      n.includes('leg press') ||
      n.includes('hack squat') ||
      n.includes('goblet squat')
    );
  });
}

/** Clinical Law IV — chest openers after bench press */
export function ironBlockNeedsChestPrimer(exerciseNames: string[]): boolean {
  return exerciseNames.some((name) => {
    const n = normalizeExerciseName(name);
    return /\bbench\b/.test(n) || n.includes('bench press') || n.includes('chest press');
  });
}

export function resolveBiomechanicalPrerequisiteSlugs(exerciseNames: string[]): string[] {
  const slugs: string[] = [];
  if (ironBlockNeedsHipPrimer(exerciseNames)) slugs.push(BIOMECH_SLUG_MALASANA);
  if (ironBlockNeedsChestPrimer(exerciseNames)) slugs.push(BIOMECH_SLUG_CHEST_OPENER);
  return [...new Set(slugs)];
}

export function applyDeloadToIronExercise(
  exercise: IronExercisePrescription,
): IronExercisePrescription {
  const scaledWeight =
    exercise.target_weight_kg != null
      ? Math.round(exercise.target_weight_kg * DELOAD_LOAD_FACTOR * 10) / 10
      : null;
  return {
    ...exercise,
    target_weight_kg: scaledWeight,
    target_rir: Math.max(exercise.target_rir ?? 2, 3),
    progression_note: [exercise.progression_note, 'Deload week (−40% load)']
      .filter(Boolean)
      .join(' · '),
  };
}

export function capIronExercisesForDeload<T>(exercises: T[], isDeload: boolean): T[] {
  if (!isDeload) return exercises;
  return exercises.slice(0, DELOAD_IRON_EXERCISE_CAP);
}

/** CNS delta for a single performance queue item */
export function cnsDeltaFromQueueItem(item: PerformanceQueueItem): number {
  if (item.kind === 'iron_set') return CNS_DELTA_IRON_SET;

  const pillar = item.input.pillar;
  if (pillar === 'iron') {
    const setCount = item.session?.iron?.sets.length ?? 1;
    return setCount * CNS_DELTA_IRON_SET;
  }
  return 0;
}

export function totalCnsDeltaFromQueue(queue: PerformanceQueueItem[]): number {
  return queue.reduce((sum, item) => sum + cnsDeltaFromQueueItem(item), 0);
}

/** Clinical Law II — mutate selected day protocol after readiness scan */
export function applyReadinessAutoregulationToMicrocycle(
  microcycle: MicrocycleDay[],
  dayIndex: number,
  readinessScore: number,
): MicrocycleDay[] {
  if (readinessScore >= READINESS_AUTOREG_THRESHOLD) return microcycle;

  return microcycle.map((day) => {
    if (day.day_index !== dayIndex) return day;

    const blocks = day.blocks.map((block) => {
        if (block.pillar !== 'iron' || !block.iron?.exercises) return block;

        const exercises = block.iron.exercises.map((exercise) => ({
          ...exercise,
          target_weight_kg:
            exercise.target_weight_kg != null
              ? Math.round(exercise.target_weight_kg * READINESS_LOAD_FACTOR * 10) / 10
              : null,
          progression_note: [exercise.progression_note, 'Autoregulation Mode (−15%)']
            .filter(Boolean)
            .join(' · '),
        }));

        return {
          ...block,
          subtitle: [block.subtitle, 'Autoregulation'].filter(Boolean).join(' · '),
          iron: { ...block.iron, exercises },
        };
      });

    return {
      ...day,
      focus_label: day.focus_label.includes('Autoregulation')
        ? day.focus_label
        : `${day.focus_label} · Autoregulation`,
      blocks,
    };
  });
}

export function ironExerciseNamesFromBlock(
  block: GameplanBlock,
  catalog: LibraryExercise[],
): string[] {
  if (!block.iron?.exercises) return [];
  return block.iron.exercises
    .map((row) => catalog.find((ex) => ex.id === row.exercise_id)?.name)
    .filter((name): name is string => Boolean(name));
}
