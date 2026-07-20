/**
 * Constitution — Garantias Fisiológicas (NUNCA quebrar).
 *
 * Referência negativa (o que NÃO pode voltar a acontecer):
 * - somma-backup-2026-07-16.json: Day 4 Pull colapsado a 1–2 sets; Day 1 Push
 *   sem tríceps direto; Day 6 só braços (sem 3 cabeças de ombro); UI/cues em inglês
 *   ("Healer Zone", "Spirit & Nutrition Reset", "Feet flat, arch legal…").
 * - somma-backup-2026-07-20.json: mesmo perfil com TRT ativo ainda sem tríceps no
 *   Push, Day 6 sem cobertura de ombro, conteúdo visível em inglês.
 *
 * Estes testes geram microciclo ao vivo — não leem o JSON do backup — para
 * garantir que o motor atual não reproduz as violações.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { ELITE_EXERCISES } from '@/lib/catalog/eliteCatalog';
import { generateDeterministicGameplan } from '@/lib/gameplan/engine/generateDeterministicGameplan';
import {
  MUSCLE_GROUPS,
  type MuscleSubGroup,
} from '@/lib/gameplan/engine/iron/anatomicalDivision';
import { buildExerciseCatalog } from '@/lib/gameplan/engine/iron/catalog/ExerciseCatalog';
import { getVolumeBudgetForHormonalProfile } from '@/lib/gameplan/engine/iron/hormonalProfile';
import { ABCDE_SPLIT } from '@/lib/gameplan/engine/iron/splits/abcdeSplit';
import { isCompoundExercise } from '@/lib/gameplan/engine/iron/volumePeriodization';
import { resolveVolumeLimitsForSplit } from '@/lib/gameplan/engine/iron/volumeMatrix';
import { createWeeklyVolumeTracker } from '@/lib/gameplan/engine/iron/WeeklyVolumeTracker';
import { initialBiologicalProfile, type UserBiological } from '@/types/biological';
import type { DailyGameplan, IronExercisePrescription, MicrocycleDay } from '@/types/gameplan';

/** Constitution floors — compostos ≥2, isoladores ≥1 por sessão. */
const CONSTITUTION_MIN_COMPOUND_SETS = 2;
const CONSTITUTION_MIN_ISOLATION_SETS = 1;

/**
 * Perfil espelhado dos backups 2026-07-16 / 2026-07-20 (ABCDE advanced, 90 min).
 * TRT é aplicado só no teste de capacidade hormonal.
 */
const backupBiological: UserBiological = {
  ...initialBiologicalProfile,
  date_of_birth: '1994-05-14',
  weight_kg: 58,
  height_cm: 159,
  body_fat_percentage: null,
  current_injuries: null,
  baseline_stress_level: 4,
  goal_iron: 'Hypertrophy',
  nutrition_goal: 'Hypertrophy support',
  available_time_iron: 90,
  training_days_per_week: 5,
  frequency_iron: 5,
  experience_level: 'advanced',
  iron_mastery: 5,
  mesocycle_phase: 'maintenance',
  mesocycle_week: 1,
  mesocycle_goal: 'hypertrophy',
  preferred_split: 'abcde',
  clinical_exit_interview: null,
  current_body_fat_estimate: null,
  hormonal_transition: false,
};

const catalog = buildExerciseCatalog([...ELITE_EXERCISES], { includeStarvationAliases: true });

/** Frases em inglês que os backups emitiram no conteúdo visível — proibidas. */
const ENGLISH_BACKUP_ANTIPATTERNS = [
  'Healer Zone',
  'Spirit & Nutrition Reset',
  'Spirit Reset',
  'Upper Push',
  'Upper Pull',
  'Lower Anterior',
  'Lower Posterior',
  'Weak Point',
  'Calibrate first set',
  'Feet flat, arch legal',
  'Progressive overload',
  'Biological Fueling',
] as const;

function ironExercisesForDay(day: MicrocycleDay | undefined): IronExercisePrescription[] {
  return day?.blocks.flatMap((block) => block.iron?.exercises ?? []) ?? [];
}

function allIronExercises(microcycle: DailyGameplan['microcycle']): IronExercisePrescription[] {
  return microcycle.flatMap((day) => (day.is_rest_day ? [] : ironExercisesForDay(day)));
}

function totalWeeklySets(microcycle: DailyGameplan['microcycle']): number {
  return allIronExercises(microcycle).reduce((sum, exercise) => sum + exercise.target_sets, 0);
}

function metaFor(exercise: IronExercisePrescription) {
  return exercise.slug ? catalog.bySlug.get(exercise.slug) : undefined;
}

function isDirectTriceps(exercise: IronExercisePrescription): boolean {
  const meta = metaFor(exercise);
  if (!meta) return false;
  if (meta.primary_muscle === 'triceps') return true;
  return (meta.muscle_sub_groups ?? []).some((sg) => sg.startsWith('triceps_'));
}

function isDirectBiceps(exercise: IronExercisePrescription): boolean {
  const meta = metaFor(exercise);
  if (!meta) return false;
  if (meta.primary_muscle === 'biceps') return true;
  return (meta.muscle_sub_groups ?? []).some(
    (sg) => sg.startsWith('biceps_') || sg === 'brachialis',
  );
}

function coversShoulderHead(
  exercises: IronExercisePrescription[],
  head: 'anterior' | 'lateral' | 'posterior',
): boolean {
  return exercises.some((exercise) => {
    const meta = metaFor(exercise);
    if (!meta) return false;
    if (head === 'anterior') {
      return (
        meta.muscle_sub_groups?.includes('shoulder_anterior') === true ||
        meta.primary_muscle === 'front_delts'
      );
    }
    if (head === 'lateral') {
      return (
        meta.muscle_sub_groups?.includes('shoulder_lateral') === true ||
        meta.primary_muscle === 'side_delts'
      );
    }
    return (
      meta.muscle_sub_groups?.includes('shoulder_posterior') === true ||
      meta.primary_muscle === 'rear_delts'
    );
  });
}

/** Campos de UI que o usuário vê no microciclo (exceto nomes de catálogo). */
function visibleUserFacingStrings(microcycle: DailyGameplan['microcycle']): string[] {
  const strings: string[] = [];
  for (const day of microcycle) {
    strings.push(day.focus_label);
    for (const block of day.blocks) {
      strings.push(block.title);
      if (block.subtitle) strings.push(block.subtitle);
      for (const exercise of block.iron?.exercises ?? []) {
        if (exercise.progression_note) strings.push(exercise.progression_note);
        if (exercise.execution_technique) strings.push(exercise.execution_technique);
        const cue = exercise.cue_card;
        if (cue) {
          strings.push(cue.setup, cue.vector, cue.catch, cue.anti_pattern);
        }
      }
    }
  }
  return strings.filter((value) => value.trim().length > 0);
}

function looksPrimarilyEnglish(text: string): boolean {
  const lower = text.toLowerCase();
  // Heurística: tokens ingleses comuns de cues/labels dos backups, sem diacríticos PT.
  const englishHits = (
    lower.match(
      /\b(feet|flat|arch|legal|wrists|elbows|scapulae|pinned|leg drive|press to|lockout|spotter|safeties|calibrate|first set|healer|spirit|reset|weak point|upper push|lower anterior|progressive overload|biological fueling|standard|myo-reps|drop-set|rest-pause)\b/g,
    ) ?? []
  ).length;
  const portugueseHits = (
    lower.match(
      /\b(pés|escápulas|cotovelos|calibre|série|descanso|zona|cura|reset|espiritual|nutrição|peito|tríceps|bíceps|ombros|costas|pernas|empurrar|puxar)\b/g,
    ) ?? []
  ).length;
  if (englishHits === 0) return false;
  return englishHits > portugueseHits;
}

async function generate(biological: UserBiological): Promise<DailyGameplan> {
  return generateDeterministicGameplan({
    focus: { iron: 100, nutrition: 100 },
    equipment: ['full_gym'],
    biological,
    userStats: { iron_sessions_completed: 0, nutrition_checkins_completed: 0 },
    performanceLogs: [],
    protocolDate: '2026-07-20',
  });
}

describe('Constitution — Garantias Fisiológicas', () => {
  let microcycle: DailyGameplan['microcycle'];

  beforeAll(async () => {
    const gameplan = await generate(backupBiological);
    microcycle = gameplan.microcycle;
  }, 60_000);

  it('Compostos: mínimo 2 sets por sessão', () => {
    // Backup 07-16: compostos do Pull achatados a 1–2 sets — piso constitucional é 2.
    const compounds = allIronExercises(microcycle).filter((exercise) => {
      const meta = metaFor(exercise);
      return meta != null && isCompoundExercise(meta);
    });

    expect(compounds.length).toBeGreaterThan(0);
    for (const exercise of compounds) {
      expect(
        exercise.target_sets,
        `composto ${exercise.slug ?? exercise.exercise_id} com ${exercise.target_sets} sets`,
      ).toBeGreaterThanOrEqual(CONSTITUTION_MIN_COMPOUND_SETS);
    }
  });

  it('Isoladores: mínimo 1 set por sessão', () => {
    const isolators = allIronExercises(microcycle).filter((exercise) => {
      const meta = metaFor(exercise);
      return meta != null && !isCompoundExercise(meta);
    });

    expect(isolators.length).toBeGreaterThan(0);
    for (const exercise of isolators) {
      expect(
        exercise.target_sets,
        `isolador ${exercise.slug ?? exercise.exercise_id} com ${exercise.target_sets} sets`,
      ).toBeGreaterThanOrEqual(CONSTITUTION_MIN_ISOLATION_SETS);
    }
  });

  it('Todo sub-grupo atinge MEV semanal', () => {
    // Sub-grupos que o split ABCDE declara como primary/secondary devem bater MEV.
    const tracker = createWeeklyVolumeTracker(catalog, [], [], backupBiological);
    for (const day of microcycle) {
      for (const exercise of ironExercisesForDay(day)) {
        const meta = metaFor(exercise);
        if (!meta) continue;
        tracker.creditVolume(meta, exercise.target_sets);
      }
    }

    const required = new Set<MuscleSubGroup>();
    for (const template of ABCDE_SPLIT.dayTemplates) {
      for (const group of template.primaryGroups) required.add(group);
      for (const group of template.secondaryGroups) required.add(group);
    }

    const deficits: string[] = [];
    for (const subGroup of required) {
      const volume = tracker.getSubGroupVolume(subGroup);
      const mev = MUSCLE_GROUPS[subGroup].mevPerWeek;
      if (volume + 1e-6 < mev) {
        deficits.push(`${subGroup}: ${volume.toFixed(2)} < MEV ${mev}`);
      }
    }

    expect(deficits, deficits.join('; ')).toEqual([]);
  });

  it('Push day tem tríceps direto', () => {
    // Backups 16/20 Day 1: label "…Triceps" mas zero exercício de tríceps.
    const pushDay = microcycle.find((day) => day.day_index === 1);
    expect(pushDay?.is_rest_day).toBe(false);

    const triceps = ironExercisesForDay(pushDay).filter(isDirectTriceps);
    expect(
      triceps.length,
      'Day 1 Push deve incluir pelo menos 1 exercício direto de tríceps',
    ).toBeGreaterThanOrEqual(1);

    const tricepsSets = triceps.reduce((sum, exercise) => sum + exercise.target_sets, 0);
    expect(tricepsSets).toBeGreaterThanOrEqual(CONSTITUTION_MIN_ISOLATION_SETS);
  });

  it('Pull day tem bíceps direto', () => {
    const pullDay = microcycle.find((day) => day.day_index === 4);
    expect(pullDay?.is_rest_day).toBe(false);

    const biceps = ironExercisesForDay(pullDay).filter(isDirectBiceps);
    expect(
      biceps.length,
      'Day 4 Pull deve incluir pelo menos 1 exercício direto de bíceps',
    ).toBeGreaterThanOrEqual(1);

    const bicepsSets = biceps.reduce((sum, exercise) => sum + exercise.target_sets, 0);
    expect(bicepsSets).toBeGreaterThanOrEqual(CONSTITUTION_MIN_ISOLATION_SETS);
  });

  it('Shoulder day cobre 3 cabeças', () => {
    // Backups 16/20 Day 6: só curls/pushdowns — zero anterior/lateral/posterior.
    const shoulderDay = microcycle.find((day) => day.day_index === 6);
    expect(shoulderDay?.is_rest_day).toBe(false);

    const exercises = ironExercisesForDay(shoulderDay);
    expect(coversShoulderHead(exercises, 'anterior')).toBe(true);
    expect(coversShoulderHead(exercises, 'lateral')).toBe(true);
    expect(coversShoulderHead(exercises, 'posterior')).toBe(true);
  });

  it('Idioma do usuário respeitado em 100% do conteúdo visível', () => {
    // Usuário BR (backups) — conteúdo estrutural e cues devem estar em PT.
    const json = JSON.stringify(microcycle);
    for (const antipattern of ENGLISH_BACKUP_ANTIPATTERNS) {
      expect(json, `antipadrão inglês do backup ainda presente: "${antipattern}"`).not.toContain(
        antipattern,
      );
    }

    expect(json).toContain('Zona de Cura');
    expect(json).toMatch(/Espiritual|Nutrição/);

    const englishVisible = visibleUserFacingStrings(microcycle).filter(looksPrimarilyEnglish);
    expect(
      englishVisible,
      `conteúdo visível ainda em inglês:\n${englishVisible.slice(0, 8).join('\n')}`,
    ).toEqual([]);
  });

  it('TRT/hormonal: AUMENTA capacidade, nunca reduz', async () => {
    // Backup 07-20 tinha TRT mas reproduzia as mesmas falhas estruturais;
    // capacidade hormonal nunca pode ficar abaixo do natural.
    const naturalLimits = resolveVolumeLimitsForSplit('abcde');
    const trtLimits = resolveVolumeLimitsForSplit('abcde', {
      hormonal_protocol: { type: 'trt', weekly_dose_mg: 200, recovery_multiplier: 1.5 },
    });
    expect(trtLimits.mrvSoft).toBeGreaterThan(naturalLimits.mrvSoft);
    expect(trtLimits.mrvHard).toBeGreaterThan(naturalLimits.mrvHard);

    const naturalBudget = getVolumeBudgetForHormonalProfile(backupBiological, 'maintenance');
    const trtBudget = getVolumeBudgetForHormonalProfile(
      {
        ...backupBiological,
        hormonal_protocol: { type: 'trt', weekly_dose_mg: 200, recovery_multiplier: 1.5 },
      },
      'maintenance',
    );
    expect(trtBudget.targetSetsPerSession).toBeGreaterThan(naturalBudget.targetSetsPerSession);

    const naturalPlan = await generate(backupBiological);
    const trtPlan = await generate({
      ...backupBiological,
      hormonal_protocol: { type: 'trt', weekly_dose_mg: 200, recovery_multiplier: 1.5 },
    });

    const naturalSets = totalWeeklySets(naturalPlan.microcycle);
    const trtSets = totalWeeklySets(trtPlan.microcycle);

    // Nunca reduz volume realizado vs baseline natural do mesmo input.
    expect(trtSets).toBeGreaterThanOrEqual(naturalSets);
    // Aumenta capacidade realizada (não só tetos teóricos).
    expect(trtSets).toBeGreaterThan(naturalSets);

    for (const exercise of allIronExercises(trtPlan.microcycle)) {
      const meta = metaFor(exercise);
      if (!meta) continue;
      const floor = isCompoundExercise(meta)
        ? CONSTITUTION_MIN_COMPOUND_SETS
        : CONSTITUTION_MIN_ISOLATION_SETS;
      expect(exercise.target_sets).toBeGreaterThanOrEqual(floor);
    }
  }, 60_000);
});
