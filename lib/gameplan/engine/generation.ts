// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import type { TargetArchetype, TrainingExperienceLevel } from '@/types/biological';

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
