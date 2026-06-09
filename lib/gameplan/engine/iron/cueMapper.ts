import type { CatalogExercise } from '@/lib/gameplan/engine/iron/types';
import type { ExerciseCueCard, ExerciseFailureType } from '@/types/catalog';

const HEAVY_COMPOUND_PATTERNS = new Set(['push', 'pull', 'squat', 'hinge', 'lunge', 'carry']);

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');
}

function instructionValue(
  exercise: CatalogExercise,
  keys: readonly string[],
  fallback: string,
): string {
  for (const key of keys) {
    const value = exercise.biomechanical_instructions[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return fallback;
}

function resolveFailureType(exercise: CatalogExercise): ExerciseFailureType {
  const raw = exercise.biomechanical_instructions.failure_type;
  if (raw === 'technical' || raw === 'concentric') return raw;
  if (HEAVY_COMPOUND_PATTERNS.has(exercise.movement_pattern) || exercise.cns_fatigue_cost >= 3) {
    return 'technical';
  }
  return 'concentric';
}

function setupFallback(exercise: CatalogExercise): string {
  if (exercise.movement_pattern === 'push') {
    return 'Retract and depress the scapulae, plant the feet, and keep elbows about 45 degrees from the torso.';
  }
  if (exercise.movement_pattern === 'pull') {
    return 'Set the rib cage tall, depress the scapulae, and start each rep from the target back muscle.';
  }
  if (exercise.movement_pattern === 'squat') {
    return 'Brace 360 degrees, stack ribs over pelvis, and root the feet before descending.';
  }
  if (exercise.movement_pattern === 'hinge') {
    return 'Lock the lats, keep the bar close, and hinge from the hips with a neutral spine.';
  }
  if (exercise.movement_pattern === 'lunge') {
    return 'Set a stable split stance, brace the trunk, and keep the front knee tracking over toes.';
  }
  return 'Create a stable base and align the working joint with the target muscle.';
}

function vectorFallback(exercise: CatalogExercise): string {
  const primary = normalizeToken(exercise.primary_muscle);
  if (primary.includes('quad')) return 'Drive through the floor while pushing the knees out over the toes.';
  if (primary.includes('hamstring')) return 'Pull the hips back and let the hamstrings control the load.';
  if (primary.includes('glute')) return 'Drive the hips through without borrowing from the lower back.';
  if (primary.includes('lat') || primary === 'back') return 'Pull the elbows toward the hips instead of curling with the hands.';
  if (primary.includes('delt')) return 'Lead with the elbow and move the load away from the torso.';
  if (primary.includes('chest')) return 'Press or sweep on the chest fiber line while keeping the shoulder packed.';
  return 'Move through the target muscle, not through momentum.';
}

function catchFallback(exercise: CatalogExercise, dayFocus: string): string {
  if (dayFocus === 'stretch_mediated' || exercise.stretch_mediated_hypertrophy) {
    return 'Own the lengthened position for the prescribed pause before reversing the rep.';
  }
  if (dayFocus === 'pure_mechanical_tension') {
    return 'Control the bottom position under load, then drive out without losing position.';
  }
  return 'Keep tension through the eccentric until the target muscle reaches stable end range.';
}

function antiPatternFallback(exercise: CatalogExercise, dayFocus: string): string {
  // Regra 4: Text-Only Elite warns against the exact biomechanical failure for the day.
  if (exercise.movement_pattern === 'squat' && dayFocus === 'pure_mechanical_tension') {
    return 'End the set if butt wink appears or the lumbar spine loses neutral under load.';
  }
  if (exercise.movement_pattern === 'push') {
    return 'Do not lose scapular retraction or flare the elbows beyond the stable pressing path.';
  }
  if (exercise.movement_pattern === 'pull') {
    return 'Do not turn the rep into a shrug or biceps-dominant pull.';
  }
  if (exercise.movement_pattern === 'hinge') {
    return 'Do not chase range by rounding the lower back or relaxing the brace.';
  }
  if (exercise.movement_pattern === 'lunge') {
    return 'Do not let the pelvis twist or the front knee cave inward.';
  }
  return 'Stop when momentum replaces target-muscle contraction.';
}

export function mapToExerciseCueCard(exercise: CatalogExercise, dayFocus: string): ExerciseCueCard {
  return {
    setup: instructionValue(exercise, ['setup'], setupFallback(exercise)),
    vector: instructionValue(
      exercise,
      ['vector', 'concentric'],
      vectorFallback(exercise),
    ),
    catch: instructionValue(
      exercise,
      ['catch', 'eccentric'],
      catchFallback(exercise, dayFocus),
    ),
    anti_pattern: instructionValue(
      exercise,
      ['anti_pattern', 'safety', 'regression'],
      antiPatternFallback(exercise, dayFocus),
    ),
    failure_type: resolveFailureType(exercise),
  };
}
