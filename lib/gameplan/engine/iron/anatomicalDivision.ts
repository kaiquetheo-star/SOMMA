/**
 * Mega divisão muscular anatômica — granularidade por cabeça / região / fibra.
 * Usada pelo Iron ConstraintSolver e WeeklyVolumeTracker para MEV por sub-grupo.
 */

export type MuscleSubGroup =
  // UPPER BODY - CHEST
  | 'chest_horizontal'
  | 'chest_incline'
  | 'chest_decline'
  // UPPER BODY - SHOULDER
  | 'shoulder_anterior'
  | 'shoulder_lateral'
  | 'shoulder_posterior'
  // UPPER BODY - BACK
  | 'back_horizontal'
  | 'back_vertical'
  | 'trapezius_upper'
  | 'trapezius_middle'
  // UPPER BODY - ARMS
  | 'biceps_long_head'
  | 'biceps_short_head'
  | 'brachialis'
  | 'triceps_long_head'
  | 'triceps_lateral_head'
  | 'triceps_medial_head'
  | 'forearm_flexors'
  | 'forearm_extensors'
  // LOWER BODY - QUADS
  | 'quadriceps_rectus'
  | 'quadriceps_vastus_lat'
  | 'quadriceps_vastus_med'
  // LOWER BODY - POSTERIOR
  | 'hamstrings_biceps_fem'
  | 'hamstrings_semi'
  | 'gluteus_maximus'
  | 'gluteus_medius'
  // LOWER BODY - OTHER
  | 'adductors'
  | 'abductors'
  | 'calves_gastrocnemius'
  | 'calves_soleus'
  // CORE
  | 'rectus_abdominis'
  | 'obliques'
  | 'transverse_abdominis'
  | 'erector_spinae';

export interface MuscleGroupDefinition {
  subGroups: MuscleSubGroup[];
  mevPerWeek: number;
  mrvSoftPerWeek: number;
  mrvHardPerWeek: number;
  minSetsPerSession: number;
  priority: 'high' | 'medium' | 'low';
}

function def(
  mev: number,
  soft: number,
  hard: number,
  minSession: number,
  priority: MuscleGroupDefinition['priority'],
  subGroup: MuscleSubGroup,
): MuscleGroupDefinition {
  return {
    subGroups: [subGroup],
    mevPerWeek: mev,
    mrvSoftPerWeek: soft,
    mrvHardPerWeek: hard,
    minSetsPerSession: minSession,
    priority,
  };
}

export const MUSCLE_GROUPS: Record<MuscleSubGroup, MuscleGroupDefinition> = {
  chest_horizontal: def(10, 20, 24, 6, 'high', 'chest_horizontal'),
  chest_incline: def(6, 14, 18, 4, 'high', 'chest_incline'),
  chest_decline: def(4, 10, 14, 3, 'medium', 'chest_decline'),

  shoulder_anterior: def(6, 14, 18, 4, 'medium', 'shoulder_anterior'),
  shoulder_lateral: def(8, 16, 20, 4, 'high', 'shoulder_lateral'),
  shoulder_posterior: def(6, 14, 18, 4, 'high', 'shoulder_posterior'),

  back_horizontal: def(8, 16, 20, 6, 'high', 'back_horizontal'),
  back_vertical: def(8, 16, 20, 6, 'high', 'back_vertical'),
  trapezius_upper: def(4, 12, 16, 3, 'medium', 'trapezius_upper'),
  trapezius_middle: def(4, 12, 16, 3, 'medium', 'trapezius_middle'),

  biceps_long_head: def(6, 14, 18, 3, 'medium', 'biceps_long_head'),
  biceps_short_head: def(6, 14, 18, 3, 'medium', 'biceps_short_head'),
  brachialis: def(4, 10, 14, 3, 'medium', 'brachialis'),
  triceps_long_head: def(6, 14, 18, 3, 'medium', 'triceps_long_head'),
  triceps_lateral_head: def(6, 14, 18, 3, 'medium', 'triceps_lateral_head'),
  triceps_medial_head: def(4, 10, 14, 2, 'low', 'triceps_medial_head'),
  forearm_flexors: def(3, 10, 14, 2, 'low', 'forearm_flexors'),
  forearm_extensors: def(3, 10, 14, 2, 'low', 'forearm_extensors'),

  quadriceps_rectus: def(6, 14, 18, 4, 'high', 'quadriceps_rectus'),
  quadriceps_vastus_lat: def(6, 14, 18, 4, 'high', 'quadriceps_vastus_lat'),
  quadriceps_vastus_med: def(6, 14, 18, 4, 'high', 'quadriceps_vastus_med'),

  hamstrings_biceps_fem: def(6, 14, 18, 4, 'high', 'hamstrings_biceps_fem'),
  hamstrings_semi: def(6, 14, 18, 4, 'high', 'hamstrings_semi'),
  gluteus_maximus: def(8, 16, 20, 4, 'high', 'gluteus_maximus'),
  gluteus_medius: def(3, 10, 14, 2, 'low', 'gluteus_medius'),

  adductors: def(3, 10, 14, 2, 'low', 'adductors'),
  abductors: def(3, 10, 14, 2, 'low', 'abductors'),
  calves_gastrocnemius: def(6, 14, 18, 4, 'medium', 'calves_gastrocnemius'),
  calves_soleus: def(6, 14, 18, 4, 'medium', 'calves_soleus'),

  rectus_abdominis: def(4, 12, 16, 3, 'medium', 'rectus_abdominis'),
  obliques: def(3, 10, 14, 2, 'low', 'obliques'),
  transverse_abdominis: def(2, 8, 12, 2, 'low', 'transverse_abdominis'),
  erector_spinae: def(4, 12, 16, 3, 'medium', 'erector_spinae'),
};

/** Synergist volume fraction — reduced so compounds do not starve isolation MEV. */
export const SUB_GROUP_SYNERGIST_FRACTION = 0.33;

export const ALL_MUSCLE_SUB_GROUPS: readonly MuscleSubGroup[] = Object.keys(
  MUSCLE_GROUPS,
) as MuscleSubGroup[];

export function emptySubGroupLedger(): Record<MuscleSubGroup, number> {
  const ledger = {} as Record<MuscleSubGroup, number>;
  for (const key of ALL_MUSCLE_SUB_GROUPS) {
    ledger[key] = 0;
  }
  return ledger;
}

export function isMuscleSubGroup(value: string): value is MuscleSubGroup {
  return value in MUSCLE_GROUPS;
}
