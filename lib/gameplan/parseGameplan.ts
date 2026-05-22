import type {
  CombatBlockPrescription,
  CombatRoundStructureEntry,
  CombatTacticalFocus,
  DailyGameplan,
  GameplanBlock,
  IronBlockPrescription,
  SpiritBlockPrescription,
  WorkoutPillar,
} from '@/types/gameplan';

const VALID_PILLARS: WorkoutPillar[] = ['iron', 'combat', 'spirit'];

const VALID_TACTICAL_FOCUS: CombatTacticalFocus[] = [
  'footwork_range',
  'power_inside',
  'defense_counter',
  'burnout',
];

function parseTacticalFocus(value: unknown): CombatTacticalFocus | null {
  return typeof value === 'string' &&
    VALID_TACTICAL_FOCUS.includes(value as CombatTacticalFocus)
    ? (value as CombatTacticalFocus)
    : null;
}

function parseRoundsStructure(raw: unknown): CombatRoundStructureEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const focus = parseTacticalFocus(row.tactical_focus);
    if (!focus) return [];
    const roundStart =
      typeof row.round_start === 'number'
        ? row.round_start
        : typeof row.round_index_start === 'number'
          ? row.round_index_start
          : null;
    const roundEnd =
      typeof row.round_end === 'number'
        ? row.round_end
        : typeof row.round_index_end === 'number'
          ? row.round_index_end
          : null;
    if (roundStart == null || roundEnd == null || roundStart < 1 || roundEnd < roundStart) {
      return [];
    }
    return [
      {
        round_start: roundStart,
        round_end: roundEnd,
        tactical_focus: focus,
        coach_intent:
          typeof row.coach_intent === 'string'
            ? row.coach_intent
            : typeof row.intent === 'string'
              ? row.intent
              : undefined,
      },
    ];
  });
}

function deriveRoundsStructureFromRounds(
  rounds: CombatBlockPrescription['rounds'],
): CombatRoundStructureEntry[] {
  if (!rounds.length) return [];
  const segments: CombatRoundStructureEntry[] = [];
  let segmentStart = rounds[0]!.round_index;
  let currentFocus = rounds[0]!.tactical_focus;

  for (let i = 1; i < rounds.length; i += 1) {
    const round = rounds[i]!;
    if (round.tactical_focus === currentFocus) continue;
    segments.push({
      round_start: segmentStart,
      round_end: rounds[i - 1]!.round_index,
      tactical_focus: currentFocus,
    });
    segmentStart = round.round_index;
    currentFocus = round.tactical_focus;
  }

  segments.push({
    round_start: segmentStart,
    round_end: rounds[rounds.length - 1]!.round_index,
    tactical_focus: currentFocus,
  });

  return segments;
}

function isWorkoutPillar(value: unknown): value is WorkoutPillar {
  return typeof value === 'string' && VALID_PILLARS.includes(value as WorkoutPillar);
}

function parseIronPrescription(raw: unknown): IronBlockPrescription | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const record = raw as Record<string, unknown>;
  const exercisesRaw = record.exercises;
  if (!Array.isArray(exercisesRaw) || exercisesRaw.length === 0) return undefined;

  const exercises = exercisesRaw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.exercise_id !== 'string') return [];
    const repRange =
      typeof row.target_rep_range === 'string' ? row.target_rep_range : undefined;
    const rir =
      typeof row.target_rir === 'number'
        ? row.target_rir
        : row.target_rir != null
          ? Number(row.target_rir)
          : undefined;

    return [
      {
        exercise_id: row.exercise_id,
        target_sets: typeof row.target_sets === 'number' ? row.target_sets : 4,
        target_reps: typeof row.target_reps === 'number' ? row.target_reps : 8,
        target_weight_kg:
          typeof row.target_weight_kg === 'number' ? row.target_weight_kg : null,
        target_rep_range: repRange,
        target_rir: Number.isFinite(rir) ? rir : undefined,
        progression_note:
          typeof row.progression_note === 'string' ? row.progression_note : undefined,
        execution_technique:
          typeof row.execution_technique === 'string' ? row.execution_technique : undefined,
        rest_seconds:
          typeof row.rest_seconds === 'number'
            ? row.rest_seconds
            : row.rest_seconds != null
              ? Number(row.rest_seconds)
              : undefined,
        alternative_exercise_id:
          typeof row.alternative_exercise_id === 'string'
            ? row.alternative_exercise_id
            : row.alternative_exercise_id === null
              ? null
              : undefined,
      },
    ];
  });

  if (exercises.length === 0) return undefined;

  return {
    routine_id: typeof record.routine_id === 'string' ? record.routine_id : undefined,
    exercises,
  };
}

function parseCombatPrescription(raw: unknown): CombatBlockPrescription | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const record = raw as Record<string, unknown>;
  const roundsRaw = record.rounds;
  if (!Array.isArray(roundsRaw) || roundsRaw.length === 0) return undefined;

  const structureFromPayload = parseRoundsStructure(
    record.rounds_structure ?? record.roundsStructure,
  );

  const rounds = roundsRaw.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    if (typeof row.combo_id !== 'string') return [];
    const roundIndex = typeof row.round_index === 'number' ? row.round_index : index + 1;
    const tacticalFocus =
      parseTacticalFocus(row.tactical_focus) ??
      structureFromPayload.find(
        (segment) => roundIndex >= segment.round_start && roundIndex <= segment.round_end,
      )?.tactical_focus ??
      'footwork_range';

    return [
      {
        round_index: roundIndex,
        combo_id: row.combo_id,
        work_seconds: typeof row.work_seconds === 'number' ? row.work_seconds : 180,
        rest_seconds: typeof row.rest_seconds === 'number' ? row.rest_seconds : 60,
        tactical_focus: tacticalFocus,
      },
    ];
  });

  if (rounds.length === 0) return undefined;

  const rounds_structure =
    structureFromPayload.length > 0
      ? structureFromPayload
      : deriveRoundsStructureFromRounds(rounds);

  return { rounds_structure, rounds };
}

function parseRecoveryZones(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

function parseSpiritPrescription(raw: unknown): SpiritBlockPrescription | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const record = raw as Record<string, unknown>;
  const mode = record.mode === 'flow' ? 'flow' : 'breathwork';

  const asanasRaw = record.asanas;
  const asanas = Array.isArray(asanasRaw)
    ? asanasRaw.flatMap((item, index) => {
        if (!item || typeof item !== 'object') return [];
        const row = item as Record<string, unknown>;
        const asanaId =
          typeof row.asana_id === 'string'
            ? row.asana_id
            : typeof row.session_id === 'string'
              ? row.session_id
              : null;
        if (!asanaId) return [];
        return [
          {
            asana_id: asanaId,
            slug: typeof row.slug === 'string' ? row.slug : '',
            name:
              typeof row.name === 'string'
                ? row.name
                : typeof row.session_name === 'string'
                  ? row.session_name
                  : 'Asana',
            order: typeof row.order === 'number' ? row.order : index + 1,
            hold_seconds:
              typeof row.hold_seconds === 'number'
                ? row.hold_seconds
                : typeof row.default_hold_seconds === 'number'
                  ? row.default_hold_seconds
                  : 45,
            target_recovery_zones: parseRecoveryZones(row.target_recovery_zones),
            is_dynamic_flow: row.is_dynamic_flow === true,
          },
        ];
      })
    : undefined;

  if (mode === 'flow') {
    if (!asanas?.length) return undefined;
    return {
      mode: 'flow',
      duration_minutes:
        typeof record.duration_minutes === 'number' ? record.duration_minutes : 15,
      prescribed_reason:
        typeof record.prescribed_reason === 'string' ? record.prescribed_reason : undefined,
      recovery_focus_zones: parseRecoveryZones(
        record.recovery_focus_zones ?? record.recovery_zones,
      ),
      asanas,
    };
  }

  if (typeof record.tempo_id !== 'string') return undefined;

  return {
    mode: 'breathwork',
    tempo_id: record.tempo_id,
    duration_minutes:
      typeof record.duration_minutes === 'number' ? record.duration_minutes : 15,
    prescribed_reason:
      typeof record.prescribed_reason === 'string' ? record.prescribed_reason : undefined,
    recovery_focus_zones: parseRecoveryZones(
      record.recovery_focus_zones ?? record.recovery_zones,
    ),
  };
}

export function parseDailyGameplanPayload(payload: unknown): DailyGameplan | null {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const blocksRaw = record.blocks;
  if (!Array.isArray(blocksRaw) || blocksRaw.length === 0) return null;

  const blocks = blocksRaw.flatMap((item, index): GameplanBlock[] => {
    if (!item || typeof item !== 'object') return [];
    const block = item as Record<string, unknown>;
    if (!isWorkoutPillar(block.pillar)) return [];

    const parsed: GameplanBlock = {
      id: typeof block.id === 'string' ? block.id : `block-${index}`,
      pillar: block.pillar,
      title: typeof block.title === 'string' ? block.title : 'Ritual Block',
      subtitle: typeof block.subtitle === 'string' ? block.subtitle : '',
      duration_minutes:
        typeof block.duration_minutes === 'number' ? block.duration_minutes : 20,
      order: typeof block.order === 'number' ? block.order : index,
      status: 'pending',
    };

    const iron = parseIronPrescription(block.iron);
    const combat = parseCombatPrescription(block.combat);
    const spirit = parseSpiritPrescription(block.spirit);

    if (iron) parsed.iron = iron;
    if (combat) parsed.combat = combat;
    if (spirit) parsed.spirit = spirit;

    return [parsed];
  });

  if (blocks.length === 0) return null;

  return {
    date: typeof record.date === 'string' ? record.date : new Date().toISOString().slice(0, 10),
    blocks,
    generated_at:
      typeof record.generated_at === 'string' ? record.generated_at : new Date().toISOString(),
  };
}
