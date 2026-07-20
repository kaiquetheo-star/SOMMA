import { IntensityTechnique } from '@/types/catalog';
import { supportsAdvancedMetabolicTechnique } from '@/lib/catalog/tacticalEnrichment';
import type { BiologicalProfile, TrainingExperienceLevel } from '@/types/biological';
import type { MicrocycleDay, IronExercisePrescription } from '@/types/gameplan';
import {
  ironExercisesFromPerformanceLog,
  type PerformanceLogEntry,
} from '@/types/performance';
import type { LibraryExercise } from '@/types/catalog';

const DROP_SET_NOTE =
  'Drop-set: execute até a falha, reduza 20% da carga e repita até a falha novamente, sem descanso. (Não use a série drop como âncora de progressão — preserve a melhor série de trabalho.)';
const REST_PAUSE_NOTE =
  'Pausa-descanso: última série até a falha, descanse 15s e repita com a mesma carga até a falha técnica.';
const PRE_EXHAUST_NOTE =
  'Pré-exaustão: execute este isolador antes do composto principal para aumentar o recrutamento local.';
const BI_SET_NOTE =
  'Bi-set no mesmo músculo: execute em sequência com o par indicado, descansando apenas ao fim do par.';
const WEIGHTED_BODYWEIGHT_NOTE =
  'Carga externa (+10 kg) para calibrar força relativa avançada.';

const DROP_SET_ISOLATION_SLUGS = /fly|pec_deck|leg_extension|leg_curl|curl|raise|pushdown|extension|face_pull/i;
const NON_TARGET_DROP_SET_SLUGS = /calf|abdominal|crunch|plank|dead_bug|pallof/i;
const REST_PAUSE_COMPOUND_SLUGS = /hack|machine|leg_press|chest_press|smith|pull_up|chin_up/i;
const BODYWEIGHT_LOADING_SLUGS = /chin_up|pull_up|dip|push_up/i;

type NormalizedExperience = 'beginner' | 'intermediate' | 'advanced';

function normalizeExperience(level: TrainingExperienceLevel | null | undefined): NormalizedExperience {
  const normalized = (level ?? 'intermediate').toLowerCase();
  if (normalized === 'beginner') return 'beginner';
  if (normalized === 'advanced') return 'advanced';
  return 'intermediate';
}

function isAdvancedAthlete(biological: BiologicalProfile, logs: readonly PerformanceLogEntry[]): boolean {
  if (normalizeExperience(biological.experience_level) === 'advanced') return true;
  return logs.some((log) =>
    ironExercisesFromPerformanceLog(log).some((iron) => iron.sets.length >= 5),
  );
}

function appendNote(existing: string | undefined, note: string): string {
  if (!existing?.trim()) return note;
  if (existing.includes(note)) return existing;
  return `${existing} · ${note}`;
}

function catalogBySlug(catalog: readonly LibraryExercise[]): ReadonlyMap<string, LibraryExercise> {
  return new Map(catalog.map((exercise) => [exercise.slug, exercise]));
}

function compatibleWith(
  exercise: IronExercisePrescription,
  catalog: ReadonlyMap<string, LibraryExercise>,
  technique: IntensityTechnique,
): boolean {
  const slug = exercise.slug ?? '';
  const row = slug ? catalog.get(slug) : null;
  if (
    (technique === IntensityTechnique.DROP_SET || technique === IntensityTechnique.MYO_REPS) &&
    row &&
    !supportsAdvancedMetabolicTechnique(row)
  ) {
    return false;
  }

  if (row?.intensity_compatibility?.includes(technique)) return true;

  if (technique === IntensityTechnique.DROP_SET) {
    return DROP_SET_ISOLATION_SLUGS.test(slug) && !NON_TARGET_DROP_SET_SLUGS.test(slug);
  }
  if (technique === IntensityTechnique.REST_PAUSE) {
    return REST_PAUSE_COMPOUND_SLUGS.test(slug);
  }
  if (technique === IntensityTechnique.PRE_EXHAUST) {
    return /fly|pec_deck|leg_extension/i.test(slug);
  }
  return false;
}

function isCompoundLike(exercise: IronExercisePrescription): boolean {
  const slug = exercise.slug ?? '';
  return /bench|press|squat|deadlift|row|pulldown|pull_up|chin_up|lunge|hip_thrust|hack|leg_press/i.test(slug);
}

function isIsolationLike(exercise: IronExercisePrescription): boolean {
  const slug = exercise.slug ?? '';
  return DROP_SET_ISOLATION_SLUGS.test(slug);
}

function dropSetPriority(exercise: IronExercisePrescription, focusLabel: string): number {
  const slug = exercise.slug ?? '';
  if (/legs/i.test(focusLabel) && /leg_extension/i.test(slug)) return 100;
  if (/push/i.test(focusLabel) && /cable_fly/i.test(slug)) return 100;
  if (/push/i.test(focusLabel) && /pec_deck/i.test(slug)) return 95;
  if (/push/i.test(focusLabel) && /dumbbell_fly/i.test(slug)) return 90;
  if (/pull/i.test(focusLabel) && /curl|face_pull/i.test(slug)) return 80;
  if (NON_TARGET_DROP_SET_SLUGS.test(slug)) return -100;
  return isIsolationLike(exercise) ? 10 : 0;
}

function applyWeightedBodyweight(
  exercise: IronExercisePrescription,
  biological: BiologicalProfile,
  advanced: boolean,
): IronExercisePrescription {
  const slug = exercise.slug ?? '';
  const isBodyweightLoadingCandidate = BODYWEIGHT_LOADING_SLUGS.test(slug);
  const shouldLoad = isBodyweightLoadingCandidate && (advanced || (biological.weight_kg ?? 999) < 70);
  if (!isBodyweightLoadingCandidate) return exercise;
  if (!shouldLoad) {
    return {
      ...exercise,
      loading_protocol: exercise.loading_protocol ?? 'bodyweight',
    };
  }

  return {
    ...exercise,
    loading_protocol: 'weighted',
    target_weight_kg: exercise.target_weight_kg ?? 10,
    progression_note: appendNote(exercise.progression_note, WEIGHTED_BODYWEIGHT_NOTE),
  };
}

function applyPreExhaust(exercises: IronExercisePrescription[], focusLabel: string): IronExercisePrescription[] {
  const isolationIndex = exercises.findIndex(
    (exercise) => compatibleWith(exercise, new Map(), IntensityTechnique.PRE_EXHAUST) && isIsolationLike(exercise),
  );
  const compoundIndex = exercises.findIndex(isCompoundLike);
  if (isolationIndex <= 0 || compoundIndex < 0 || isolationIndex > compoundIndex + 2) return exercises;

  const next = [...exercises];
  const [isolation] = next.splice(isolationIndex, 1);
  if (!isolation) return exercises;
  next.splice(Math.max(0, compoundIndex), 0, {
    ...isolation,
    execution_technique: isolation.execution_technique === 'Padrão' || isolation.execution_technique === 'Standard'
      ? 'Pré-exaustão'
      : isolation.execution_technique,
    progression_note: appendNote(isolation.progression_note, PRE_EXHAUST_NOTE),
  });
  return /Isolation Focus/i.test(focusLabel) ? next : exercises;
}

function applyBiSet(exercises: IronExercisePrescription[], dayIndex: number): IronExercisePrescription[] {
  const first = exercises.findIndex((exercise) => isIsolationLike(exercise) && /curl|pushdown|extension|raise/i.test(exercise.slug ?? ''));
  if (first < 0) return exercises;

  const firstExercise = exercises[first]!;
  const second = exercises.findIndex(
    (exercise, index) =>
      index !== first &&
      isIsolationLike(exercise) &&
      (exercise.slug ?? '') !== (firstExercise.slug ?? '') &&
      (/curl/i.test(exercise.slug ?? '') === /curl/i.test(firstExercise.slug ?? '') ||
        /triceps|pushdown|extension/i.test(exercise.slug ?? '') === /triceps|pushdown|extension/i.test(firstExercise.slug ?? '')),
  );
  if (second < 0) return exercises;

  const supersetId = `d${dayIndex}-biset-1`;
  return exercises.map((exercise, index) => {
    if (index !== first && index !== second) return exercise;
    return {
      ...exercise,
      superset_id: supersetId,
      progression_note: appendNote(exercise.progression_note, BI_SET_NOTE),
    };
  });
}

function applyDayStrategies(
  day: MicrocycleDay,
  biological: BiologicalProfile,
  advanced: boolean,
  catalog: ReadonlyMap<string, LibraryExercise>,
): MicrocycleDay {
  return {
    ...day,
    blocks: day.blocks.map((block) => {
      if (block.pillar !== 'iron' || !block.iron?.exercises.length) return block;

      let exercises = block.iron.exercises.map((exercise) =>
        applyWeightedBodyweight(exercise, biological, advanced),
      );

      if (!advanced) {
        return {
          ...block,
          iron: { ...block.iron, exercises },
        };
      }

      const dropSetIndex = exercises
        .map((exercise, index) => ({ exercise, index, score: dropSetPriority(exercise, day.focus_label) }))
        .filter(({ exercise, score }) => score > 0 && compatibleWith(exercise, catalog, IntensityTechnique.DROP_SET))
        .sort((a, b) => b.score - a.score || b.index - a.index)[0]?.index;

      if (dropSetIndex != null) {
        const exercise = exercises[dropSetIndex]!;
        exercises[dropSetIndex] = {
          ...exercise,
          target_sets: Math.min(exercise.target_sets, 4),
          execution_technique: 'Séries drop',
          progression_note: appendNote(exercise.progression_note, DROP_SET_NOTE),
        };
      }

      const restPauseIndex = exercises.findIndex(
        (exercise) =>
          exercise.execution_technique !== 'Séries drop' &&
          exercise.execution_technique !== 'DROP_SET' &&
          isCompoundLike(exercise) &&
          compatibleWith(exercise, catalog, IntensityTechnique.REST_PAUSE),
      );
      if (restPauseIndex >= 0) {
        const exercise = exercises[restPauseIndex]!;
        exercises[restPauseIndex] = {
          ...exercise,
          execution_technique: 'Pausa-descanso',
          progression_note: appendNote(exercise.progression_note, REST_PAUSE_NOTE),
        };
      }

      exercises = applyPreExhaust(exercises, day.focus_label);
      exercises = applyBiSet(exercises, day.day_index);

      return {
        ...block,
        iron: { ...block.iron, exercises },
      };
    }),
  };
}

export function applyIntensityStrategies(
  microcycle: MicrocycleDay[],
  biological: BiologicalProfile,
  logs: readonly PerformanceLogEntry[] = [],
  catalog: readonly LibraryExercise[] = [],
): MicrocycleDay[] {
  const advanced = isAdvancedAthlete(biological, logs);
  const bySlug = catalogBySlug(catalog);

  return microcycle.map((day) => {
    if (day.is_rest_day) return day;
    return applyDayStrategies(day, biological, advanced, bySlug);
  });
}
