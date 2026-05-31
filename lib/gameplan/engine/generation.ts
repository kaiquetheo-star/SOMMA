// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import { normalizePrimaryMuscle } from '@/lib/catalog/primaryMuscle';
import type { TargetArchetype, TrainingExperienceLevel } from '@/types/biological';
import type { LibraryExercise } from '@/types/catalog';

export interface DeterministicGenerationContext {
  protocolDate: string;
  targetArchetype: TargetArchetype | null;
  experienceLevel: TrainingExperienceLevel | null;
}

/** FNV-1a — stable string → 32-bit seed */
export function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Composite seed: date + archetype + experience.
 * Changing passport goals changes the movement pool draw immediately.
 */
export function buildDeterministicSeed(ctx: DeterministicGenerationContext): number {
  const archetype = ctx.targetArchetype ?? 'UNSET';
  const experience = ctx.experienceLevel ?? 'unset';
  return hashStringToSeed(`${ctx.protocolDate}|${archetype}|${experience}`);
}

/** Mulberry32 — deterministic PRNG from seed */
export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildGenerationContext(input: {
  protocolDate: string;
  biological: {
    target_archetype: TargetArchetype | null;
    experience_level: TrainingExperienceLevel | null;
  };
}): { ctx: DeterministicGenerationContext; seed: number; rng: () => number } {
  const ctx: DeterministicGenerationContext = {
    protocolDate: input.protocolDate,
    targetArchetype: input.biological.target_archetype,
    experienceLevel: input.biological.experience_level,
  };
  const seed = buildDeterministicSeed(ctx);
  return { ctx, seed, rng: createSeededRng(seed) };
}

const POWERBUILDER_SLUG_BOOST =
  /squat|deadlift|bench|row|overhead|press|rdl|romanian|hip.thrust|leg.press/i;
const AESTHETIC_SLUG_BOOST =
  /pulldown|lat|fly|lateral|delt|rear|face.pull|curl|pushdown|shrug/i;

export function archetypeSlugScore(slug: string, archetype: TargetArchetype | null): number {
  if (!archetype) return 0;
  if (archetype === 'POWERBUILDER_BULK') {
    return POWERBUILDER_SLUG_BOOST.test(slug) ? 10 : 0;
  }
  if (archetype === 'AESTHETIC_V_TAPER') {
    return AESTHETIC_SLUG_BOOST.test(slug) ? 10 : 0;
  }
  if (archetype === 'LEAN_RECOMP') {
    return /squat|press|row|pulldown|rdl/i.test(slug) ? 6 : 0;
  }
  return 0;
}

/** Seeded ordering of gold slug alternatives within a blueprint slot */
export function orderGoldSlugsForArchetype(
  goldSlugs: readonly string[],
  archetype: TargetArchetype | null,
  rng: () => number,
): string[] {
  return [...goldSlugs].sort((a, b) => {
    const scoreA = archetypeSlugScore(a, archetype) + rng() * 0.001;
    const scoreB = archetypeSlugScore(b, archetype) + rng() * 0.001;
    return scoreB - scoreA;
  });
}

function slotKind(slotId: string): 'compound' | 'isolation' | 'core' {
  if (slotId.includes('core')) return 'core';
  if (
    slotId.includes('iso') ||
    slotId.includes('curl') ||
    slotId.includes('fly') ||
    slotId.includes('triceps') ||
    slotId.includes('biceps') ||
    slotId.includes('calves')
  ) {
    return 'isolation';
  }
  return 'compound';
}

/**
 * Archetype reshuffles blueprint slot priority before trim:
 * - POWERBUILDER: compounds first (squat/deadlift slots rise)
 * - AESTHETIC: compounds first, then lat/delt-biased accessories
 */
export function reorderBlueprintSlotsForArchetype<T extends { slotId: string }>(
  slots: readonly T[],
  archetype: TargetArchetype | null,
): T[] {
  const copy = [...slots];

  copy.sort((a, b) => {
    const kindA = slotKind(a.slotId);
    const kindB = slotKind(b.slotId);
    const rank = (k: typeof kindA) => (k === 'compound' ? 0 : k === 'isolation' ? 1 : 2);
    const base = rank(kindA) - rank(kindB);
    if (base !== 0) return base;

    if (archetype === 'AESTHETIC_V_TAPER') {
      const aestheticA = /rear|lat|pull|fly|delt/i.test(a.slotId) ? 0 : 1;
      const aestheticB = /rear|lat|pull|fly|delt/i.test(b.slotId) ? 0 : 1;
      return aestheticA - aestheticB;
    }

    if (archetype === 'POWERBUILDER_BULK') {
      const powerA = /quad|hinge|leg|squat|deadlift/i.test(a.slotId) ? 0 : 1;
      const powerB = /quad|hinge|leg|squat|deadlift/i.test(b.slotId) ? 0 : 1;
      return powerA - powerB;
    }

    return 0;
  });

  return copy;
}

export type PullOrientation = 'vertical_pull' | 'horizontal_pull';

/** Hard split firewall — zero cross-contamination between training days */
export const ALLOWED_MUSCLES_PER_SPLIT: Record<string, readonly string[]> = {
  push: ['chest', 'shoulders', 'triceps', 'core'],
  pull: ['back', 'biceps', 'rear delt', 'core'],
  legs: ['quads', 'hamstrings', 'calves', 'glutes', 'core'],
  upper: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'core'],
  lower: ['quads', 'hamstrings', 'calves', 'glutes', 'core'],
  full: [
    'chest',
    'back',
    'quads',
    'hamstrings',
    'calves',
    'glutes',
    'shoulders',
    'biceps',
    'triceps',
    'core',
  ],
};

export { normalizePrimaryMuscle } from '@/lib/catalog/primaryMuscle';

/** Chest / pec isolation fly — must never appear on pull or leg days */
export function isChestIsolationFly(row: { slug: string; name: string; primary_muscle?: string | null }): boolean {
  const blob = `${row.slug} ${row.name} ${row.primary_muscle ?? ''}`.toLowerCase();
  if (!/\bfly\b|flye|cable_fly|pec.fly|chest.fly/.test(blob)) return false;
  if (/rear|reverse|face.pull|lateral/.test(blob)) return false;
  return /chest|pec|fly/.test(blob);
}

export function classifyPullOrientation(row: {
  slug: string;
  name: string;
  primary_muscle?: string | null;
  movement_pattern?: string | null;
}): PullOrientation | null {
  const blob = `${row.slug} ${row.name}`.toLowerCase();
  if (
    /pulldown|pull[- ]?down|pull[- ]?up|chin[- ]?up|lat.pulldown|assisted.pull/.test(blob)
  ) {
    return 'vertical_pull';
  }
  if (/\brow\b|bent.over|seated.cable.row|inverted.row|t.bar|meadows.row|pendlay/.test(blob)) {
    return 'horizontal_pull';
  }
  const muscle = (row.primary_muscle ?? '').toLowerCase();
  if (muscle.includes('lat') && row.movement_pattern === 'pull') return 'vertical_pull';
  if ((muscle.includes('back') || muscle.includes('mid_back')) && row.movement_pattern === 'pull') {
    return 'horizontal_pull';
  }
  return null;
}

export function exerciseAllowedOnIronDay(
  row: { slug: string; name: string; primary_muscle?: string | null },
  dayKey: string,
): boolean {
  const allowed = ALLOWED_MUSCLES_PER_SPLIT[dayKey];
  if (!allowed) return false;

  const muscle = normalizePrimaryMuscle(row.primary_muscle);
  if (!muscle || !allowed.includes(muscle)) return false;

  if (isChestIsolationFly(row) && !['push', 'upper', 'full'].includes(dayKey)) return false;
  return true;
}

export function filterPoolForPullCollision(
  pool: LibraryExercise[],
  slotId: string,
  selectedOrientations: readonly PullOrientation[],
): LibraryExercise[] {
  const hasVertical = selectedOrientations.includes('vertical_pull');

  return pool.filter((row) => {
    const orientation = classifyPullOrientation(row);

    if (slotId === 'back_horizontal') {
      if (orientation === 'vertical_pull') return false;
      if (orientation === 'horizontal_pull') return true;
      return /\brow\b/i.test(row.name) || /\brow\b/i.test(row.slug);
    }

    if (slotId === 'back_vertical') {
      if (orientation === 'horizontal_pull') return false;
      return orientation === 'vertical_pull' || orientation == null;
    }

    if (hasVertical && orientation === 'vertical_pull') return false;
    return true;
  });
}
