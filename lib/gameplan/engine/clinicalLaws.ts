import type { LibraryExercise } from '@/types/catalog';
import { applyFivePhaseClinicalMatrix, classifyClinicalPhase } from '@/lib/gameplan/engine/clinicalMatrix';
import type {
  GameplanBlock,
  IronExercisePrescription,
  MicrocycleDay,
} from '@/types/gameplan';

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

/**
 * Readiness-based load autoregulation removed (linear motor lobotomy).
 * Readiness scans are informational only — never mutate the protocol.
 */
export function applyReadinessAutoregulationToMicrocycle(
  microcycle: MicrocycleDay[],
  _dayIndex: number,
  _readinessScore: number,
): MicrocycleDay[] {
  return microcycle;
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
