import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizePrimaryMuscle } from '@/lib/catalog/primaryMuscle';
import { LOCAL_FIRST_MODE } from '@/lib/config';
import { getBundledExercises } from '@/lib/catalog/bundledCatalog';
import { enrichExerciseWithCues } from '@/lib/catalog/biomechanicalMapper';
import type { GameplanBlock } from '@/types/gameplan';
import {
  type LibraryExercise,
} from '@/types/catalog';

export type {
  IronExerciseBiomechanics,
  JointStressProfile,
  LibraryExercise,
  MovementPattern,
} from '@/types/catalog';
export { formatCnsFatigueCost, formatJointStress } from '@/types/catalog';

const LIBRARY_EXERCISE_SELECT =
  'id, slug, name, biomechanical_instructions, equipment_required, default_sets, default_reps, movement_pattern, primary_muscle, synergist_muscles, cns_fatigue_cost, joint_stress_profile, stretch_mediated_hypertrophy';

const CACHE_KEYS = {
  exercises: 'somma-cache-library-exercises-v4',
} as const;

const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

interface CacheEnvelope<T> {
  fetched_at: string;
  rows: T[];
}

let memoryExercises: LibraryExercise[] | null = null;

function isFresh(fetchedAt: string): boolean {
  const ts = Date.parse(fetchedAt);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < CACHE_TTL_MS;
}

async function readCache<T>(key: string, options?: { allowStale?: boolean }): Promise<T[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope?.rows?.length) return null;
    if (!options?.allowStale && !isFresh(envelope.fetched_at)) return null;
    return envelope.rows;
  } catch {
    return null;
  }
}

async function writeCache<T>(key: string, rows: T[]): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = {
      fetched_at: new Date().toISOString(),
      rows,
    };
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Offline storage may be unavailable on web private mode
  }
}

function mapExerciseRow(row: Record<string, unknown>): LibraryExercise {
  const cues =
    row.biomechanical_instructions && typeof row.biomechanical_instructions === 'object'
      ? (row.biomechanical_instructions as Record<string, string>)
      : {};

  const cnsRaw = row.cns_fatigue_cost;
  const cns =
    typeof cnsRaw === 'number'
      ? cnsRaw
      : cnsRaw != null
        ? Number(cnsRaw)
        : null;

  return enrichExerciseWithCues({
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    biomechanical_instructions: cues,
    equipment_required: Array.isArray(row.equipment_required)
      ? row.equipment_required.map(String)
      : [],
    default_sets: typeof row.default_sets === 'number' ? row.default_sets : 4,
    default_reps: typeof row.default_reps === 'number' ? row.default_reps : 8,
    movement_pattern:
      typeof row.movement_pattern === 'string' ? row.movement_pattern : null,
    primary_muscle:
      typeof row.primary_muscle === 'string'
        ? normalizePrimaryMuscle(row.primary_muscle)
        : null,
    synergist_muscles: Array.isArray(row.synergist_muscles)
      ? row.synergist_muscles.map(String)
      : [],
    cns_fatigue_cost:
      cns != null && Number.isFinite(cns) && cns >= 1 && cns <= 5 ? cns : null,
    joint_stress_profile:
      typeof row.joint_stress_profile === 'string' ? row.joint_stress_profile : null,
    stretch_mediated_hypertrophy: row.stretch_mediated_hypertrophy === true,
  });
}

async function fetchTable<T>(
  table: 'library_exercises',
  cacheKey: string,
  select: string,
  mapper: (row: Record<string, unknown>) => T,
  memoryRef: { current: T[] | null },
): Promise<T[]> {
  if (memoryRef.current?.length) return memoryRef.current;

  if (LOCAL_FIRST_MODE) {
    const bundled = getBundledExercises() as T[];

    if (bundled.length) {
      memoryRef.current = bundled;
      await writeCache(cacheKey, bundled);
      return bundled;
    }
  }

  const cached = await readCache<T>(cacheKey);
  if (cached?.length) {
    memoryRef.current = cached;
    return cached;
  }

  const stale = await readCache<T>(cacheKey, { allowStale: true });
  if (stale?.length) {
    memoryRef.current = stale;
    return stale;
  }

  return memoryRef.current ?? [];
}

export async function fetchLibraryExercises(): Promise<LibraryExercise[]> {
  return fetchTable(
    'library_exercises',
    CACHE_KEYS.exercises,
    LIBRARY_EXERCISE_SELECT,
    mapExerciseRow,
    { current: memoryExercises },
  ).then((rows) => {
    memoryExercises = rows;
    return rows;
  });
}

export async function prefetchLibraryCatalogs(): Promise<void> {
  await fetchLibraryExercises();
}

export function getExerciseById(
  exercises: LibraryExercise[],
  id: string,
): LibraryExercise | null {
  return exercises.find((row) => row.id === id) ?? null;
}

/** Human-readable preview for Daily Command cards */
export async function resolveBlockPreviewLabel(block: GameplanBlock): Promise<string> {
  if (block.iron?.exercises?.length) {
    const catalog = await fetchLibraryExercises();
    const first = block.iron.exercises[0];
    const exercise = getExerciseById(catalog, first.exercise_id);
    const name = exercise?.name ?? 'Iron prescription';
    const count = block.iron.exercises.length;
    if (count > 1) return `${name} + ${count - 1} more`;
    const load =
      first.target_weight_kg != null && first.target_weight_kg > 0
        ? ` · ${first.target_weight_kg} kg`
        : '';
    return `${name} · ${first.target_sets}×${first.target_reps}${load}`;
  }

  if (block.nutrition) {
    return block.nutrition.note;
  }

  return block.subtitle;
}
