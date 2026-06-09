import { calculateSelectionScore } from '@/lib/gameplan/engine/iron/xFrameBias';
import { enrichWithTacticalData } from '@/lib/catalog/tacticalEnrichment';
import type {
  CatalogExercise,
  ExerciseFailureType,
  ExerciseTempo,
  LibraryExercise,
} from '@/types/catalog';

const COMPOUND_PATTERNS = new Set(['push', 'pull', 'hinge', 'squat', 'lunge', 'carry']);

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');
}

function cueValue(
  instructions: Record<string, string>,
  keys: readonly string[],
  fallback: string,
): string {
  for (const key of keys) {
    const value = instructions[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return fallback;
}

function parseTempoToken(token: string): string | number | null {
  const normalized = token.trim().toUpperCase();
  if (normalized === 'X') return 'X';

  const asNumber = Number(normalized);
  return Number.isFinite(asNumber) ? asNumber : null;
}

function parseTempo(raw: string | undefined): ExerciseTempo | null {
  if (!raw) return null;

  const parts = raw.split(/[-,]/).map(parseTempoToken);
  if (parts.length !== 4 || parts.some((part) => part == null)) return null;

  return [
    parts[0] as number,
    parts[1] as number,
    parts[2] as string | number,
    parts[3] as number,
  ];
}

function isTensionConstantExercise(exercise: LibraryExercise): boolean {
  const slug = normalizeToken(exercise.slug);
  const name = normalizeToken(exercise.name);

  return (
    slug.includes('cable_lateral_raise') ||
    slug.includes('crossover') ||
    slug.includes('cable_fly') ||
    name.includes('crossover')
  );
}

function defaultTempo(exercise: LibraryExercise): ExerciseTempo {
  const movementPattern = normalizeToken(exercise.movement_pattern);
  const slug = normalizeToken(exercise.slug);

  if (isTensionConstantExercise(exercise)) return [2, 0, 1, 0];
  if (movementPattern === 'isolation' || slug.includes('machine')) return [3, 0, 1, 1];

  return [3, 1, 'X', 0];
}

function defaultFailureType(exercise: LibraryExercise): ExerciseFailureType {
  const movementPattern = normalizeToken(exercise.movement_pattern);
  const cnsCost = exercise.cns_fatigue_cost ?? 0;

  return COMPOUND_PATTERNS.has(movementPattern) || cnsCost >= 3 ? 'technical' : 'concentric';
}

function parseFailureType(raw: string | undefined, fallback: ExerciseFailureType): ExerciseFailureType {
  return raw === 'technical' || raw === 'concentric' ? raw : fallback;
}

function defaultSetup(exercise: LibraryExercise): string {
  const movementPattern = normalizeToken(exercise.movement_pattern);

  if (movementPattern === 'squat') return 'Brace 360 degrees, stack ribs over pelvis, and set feet before descent.';
  if (movementPattern === 'hinge') return 'Brace hard, keep lats engaged, and hinge from the hips.';
  if (movementPattern === 'push') return 'Plant the feet, pin the shoulder blades, and keep wrists stacked.';
  if (movementPattern === 'pull') return 'Set the rib cage tall, depress the scapulae, and start from the target muscle.';

  return 'Create a stable base and align the joint with the target muscle.';
}

function defaultVector(exercise: LibraryExercise): string {
  const primary = normalizeToken(exercise.primary_muscle);

  if (primary.includes('quad')) return 'Drive through the floor while keeping the knees tracking over the toes.';
  if (primary.includes('hamstring')) return 'Pull the hips back and let the hamstrings create the movement.';
  if (primary.includes('glute')) return 'Drive the hips through without borrowing from the lower back.';
  if (primary.includes('lat')) return 'Pull the elbows toward the hips instead of pulling with the hands.';
  if (primary.includes('delt') || primary.includes('shoulder')) return 'Lead with the elbows and keep the traps quiet.';

  return 'Move through the target muscle, not through momentum.';
}

function defaultCatch(exercise: LibraryExercise): string {
  return exercise.stretch_mediated_hypertrophy
    ? 'Own the lengthened position and pause before reversing the rep.'
    : 'Control the eccentric until the target muscle reaches its stable end range.';
}

function defaultAntiPattern(exercise: LibraryExercise): string {
  const movementPattern = normalizeToken(exercise.movement_pattern);

  if (movementPattern === 'squat') return 'Do not let the knees cave or the lumbar spine lose position.';
  if (movementPattern === 'hinge') return 'Do not chase range of motion by rounding the lower back.';
  if (movementPattern === 'push') return 'Do not flare hard or lose scapular control to finish the rep.';
  if (movementPattern === 'pull') return 'Do not turn the rep into a shrug or biceps-dominant pull.';

  return 'Stop the set when momentum replaces the target-muscle contraction.';
}

export function enrichExerciseWithCues(rawExercise: LibraryExercise): CatalogExercise {
  const tacticalExercise = enrichWithTacticalData(rawExercise);
  const instructions = tacticalExercise.biomechanical_instructions;
  const specificCues = tacticalExercise.specific_cues;
  const tempo = parseTempo(instructions.tempo) ?? defaultTempo(tacticalExercise);
  const failureType = parseFailureType(
    instructions.failure_type,
    defaultFailureType(tacticalExercise),
  );

  return {
    ...tacticalExercise,
    selection_score: calculateSelectionScore(tacticalExercise),
    tempo,
    cue_card: {
      setup: specificCues?.setup ?? cueValue(instructions, ['setup'], defaultSetup(tacticalExercise)),
      vector: specificCues?.execution ?? cueValue(instructions, ['vector', 'concentric'], defaultVector(tacticalExercise)),
      catch: cueValue(instructions, ['catch', 'eccentric'], defaultCatch(tacticalExercise)),
      anti_pattern: specificCues?.common_mistake ?? cueValue(
        instructions,
        ['anti_pattern', 'safety', 'regression'],
        defaultAntiPattern(tacticalExercise),
      ),
      failure_type: failureType,
    },
  };
}
