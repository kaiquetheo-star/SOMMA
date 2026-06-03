import type { CatalogExercise, ExerciseCatalog } from '@/lib/gameplan/engine/iron/types';
import {
  isIronMovementPattern,
  normalizeMovementPattern,
} from '@/lib/gameplan/engine/iron/taxonomy/movementPatterns';
import { enrichExerciseWithCues } from '@/lib/catalog/biomechanicalMapper';
import type { IronMovementPattern } from '@/lib/gameplan/engine/iron/taxonomy/movementPatterns';
import type { LibraryExercise } from '@/types/catalog';

type ComplexityLevel = 1 | 2 | 3 | 4 | 5;

function complexityFromSlug(slug: string): ComplexityLevel | null {
  // Curated overrides (seed_hypertrophy.sql + known catalog basics)
  const MAP: Record<string, ComplexityLevel> = {
    // Too-basic (filtered out for mastery >= 4)
    push_up: 2,
    goblet_squat: 2,
    lat_pulldown: 2,

    // Elite / advanced rotations
    deficit_bulgarian_split_squat: 4,
    pendulum_squat: 4,
    hack_squat_machine: 3,
    belt_squat: 3,
    sissy_squat: 4,
    barbell_back_squat: 4,
    barbell_romanian_deadlift: 4,
    stiff_leg_deadlift: 4,
    barbell_hip_hinge_good_morning: 5,
    rack_pull: 4,
    conventional_deadlift: 5,

    iliac_lat_pulldown: 4,
    pendlay_row: 4,
    t_bar_row: 3,
    chest_supported_row: 3,
    neutral_grip_pull_up: 4,
    pull_up_overhand: 4,

    bayesian_curl: 4,
    spider_curl: 3,
    preacher_curl_machine: 3,

    overhead_press: 4,
    machine_shoulder_press: 3,

    reverse_pec_deck: 2,
    face_pull: 2,
    cable_lateral_raise: 2,
    dumbbell_shrug: 3,
  };

  return MAP[slug] ?? null;
}

function defaultComplexityForExercise(row: LibraryExercise, movement_pattern: IronMovementPattern): ComplexityLevel {
  const override = complexityFromSlug(row.slug);
  if (override) return override;

  // Heuristic fallback: keep midline at 3; compounds drift higher, pure iso lower.
  if (movement_pattern === 'isolation') return 2;
  if (movement_pattern === 'carry') return 3;
  if (movement_pattern === 'squat' || movement_pattern === 'hinge') return 4;
  if (movement_pattern === 'lunge') return 3;
  if (movement_pattern === 'push' || movement_pattern === 'pull') return 3;
  return 3;
}

/**
 * Normalizes raw SQL / catalog muscle strings to consistent index keys.
 * Extends the global vocabulary with hypertrophy-seed delt and chest variants.
 */
export function normalizeCatalogMuscle(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const normalized = raw.toLowerCase().trim().replace(/\s+/g, '_');
  if (!normalized) return null;

  const ALIAS_MAP: Record<string, string> = {
    quadriceps: 'quads',
    quad: 'quads',
    hamstring: 'hamstrings',
    hams: 'hamstrings',
    glute: 'glutes',
    gluteus: 'glutes',
    lats: 'back',
    lat: 'back',
    mid_back: 'back',
    'mid-back': 'back',
    lower_back: 'back',
    // Keep traps distinct (required for Pull B thickness/traps slots).
    traps: 'traps',
    trapezius: 'traps',
    pecs: 'chest',
    pectorals: 'chest',
    upper_chest: 'upper_chest',
    'upper-chest': 'upper_chest',
    front_delts: 'front_delts',
    'front-delts': 'front_delts',
    front_delt: 'front_delts',
    side_delts: 'side_delts',
    'side-delts': 'side_delts',
    lateral_delt: 'side_delts',
    rear_delts: 'rear_delts',
    'rear-delts': 'rear_delts',
    rear_delt: 'rear_delts',
    'rear-delt': 'rear_delts',
    delts: 'shoulders',
    deltoids: 'shoulders',
    shoulder: 'shoulders',
    bicep: 'biceps',
    tricep: 'triceps',
    calf: 'calves',
    abs: 'core',
    abdominals: 'core',
    obliques: 'core',
    erector: 'erectors',
    erector_spinae: 'erectors',
    adductor: 'adductors',
    forearm: 'forearms',
  };

  return ALIAS_MAP[normalized] ?? normalized;
}

function normalizeSynergists(raw: string[] | null | undefined): readonly string[] {
  if (!raw?.length) return [];
  const out: string[] = [];
  for (const item of raw) {
    const muscle = normalizeCatalogMuscle(item);
    if (muscle) out.push(muscle);
  }
  return out;
}

function toCatalogExercise(row: LibraryExercise): CatalogExercise | null {
  const enriched = enrichExerciseWithCues(row);
  const movement_pattern = normalizeMovementPattern(row.movement_pattern);
  const primary_muscle = normalizeCatalogMuscle(row.primary_muscle);

  if (!movement_pattern || !primary_muscle) return null;

  const cns = row.cns_fatigue_cost;
  if (cns == null || cns < 1 || cns > 5) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    biomechanical_instructions: row.biomechanical_instructions,
    movement_pattern,
    primary_muscle,
    synergist_muscles: normalizeSynergists(row.synergist_muscles),
    cns_fatigue_cost: cns,
    complexity_level: defaultComplexityForExercise(row, movement_pattern),
    joint_stress_profile: row.joint_stress_profile,
    equipment_required: [...row.equipment_required],
    default_sets: row.default_sets,
    default_reps: row.default_reps,
    stretch_mediated_hypertrophy: row.stretch_mediated_hypertrophy,
    intensity_compatibility: row.intensity_compatibility,
    requires_loading: row.requires_loading,
    selection_score: enriched.selection_score,
    tempo: enriched.tempo,
    cue_card: enriched.cue_card,
  };
}

function indexByPattern(
  exercises: readonly CatalogExercise[],
): ReadonlyMap<IronMovementPattern, readonly CatalogExercise[]> {
  const buckets = new Map<IronMovementPattern, CatalogExercise[]>();

  for (const pattern of ['squat', 'hinge', 'lunge', 'push', 'pull', 'isolation', 'carry'] as const) {
    if (isIronMovementPattern(pattern)) buckets.set(pattern, []);
  }

  for (const exercise of exercises) {
    const list = buckets.get(exercise.movement_pattern);
    if (list) list.push(exercise);
  }

  const frozen = new Map<IronMovementPattern, readonly CatalogExercise[]>();
  for (const [pattern, list] of buckets) {
    frozen.set(pattern, Object.freeze([...list]));
  }
  return frozen;
}

function indexByPrimaryMuscle(
  exercises: readonly CatalogExercise[],
): ReadonlyMap<string, readonly CatalogExercise[]> {
  const buckets = new Map<string, CatalogExercise[]>();

  for (const exercise of exercises) {
    const key = exercise.primary_muscle;
    const list = buckets.get(key) ?? [];
    list.push(exercise);
    buckets.set(key, list);
  }

  const frozen = new Map<string, readonly CatalogExercise[]>();
  for (const [muscle, list] of buckets) {
    frozen.set(muscle, Object.freeze([...list]));
  }
  return frozen;
}

/** Builds an indexed, normalized hypertrophy catalog from `library_exercises` rows. */
export function buildExerciseCatalog(rows: LibraryExercise[]): ExerciseCatalog {
  const exercises: CatalogExercise[] = [];
  const byId = new Map<string, CatalogExercise>();
  const bySlug = new Map<string, CatalogExercise>();

  for (const row of rows) {
    const mapped = toCatalogExercise(row);
    if (!mapped) continue;
    exercises.push(mapped);
    byId.set(mapped.id, mapped);
    bySlug.set(mapped.slug, mapped);
  }

  const frozenExercises = Object.freeze(exercises) as readonly CatalogExercise[];

  return Object.freeze({
    exercises: frozenExercises,
    byId,
    bySlug,
    byPattern: indexByPattern(frozenExercises),
    byPrimaryMuscle: indexByPrimaryMuscle(frozenExercises),
  });
}
