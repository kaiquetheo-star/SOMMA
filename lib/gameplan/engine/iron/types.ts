import type { IronMovementPattern } from '@/lib/gameplan/engine/iron/taxonomy/movementPatterns';
import type {
  ExerciseCueCard,
  ExerciseTempo,
  IntensityTechnique as CatalogIntensityTechnique,
  JointStressProfile,
  AxialLoading,
  ResistanceProfile,
  SpecificExerciseCues,
  StabilityDemand,
  TacticalExerciseRole,
} from '@/types/catalog';
import type { EnginePerformanceRow } from '@/lib/gameplan/engine/performanceLogs';
import type { EquipmentTag } from '@/store/useSommaStore';
import type { DailyIronFocus } from '@/lib/gameplan/engine/iron/dupLogic';
import type { MesocyclePhase } from '@/types/biological';

export type SplitDayKey = 'push' | 'pull' | 'legs';

export type ShoulderRegion = 'anterior' | 'lateral' | 'posterior';

export type IntensityTechnique =
  | 'standard'
  | 'myo_reps'
  | 'rest_pause'
  | 'drop_set'
  | 'lengthened_partials'
  | 'slow_eccentric';

export interface TechniqueParams {
  activationReps?: number;
  miniSets?: number;
  miniSetReps?: number;
  intraSetRestSeconds?: number;
  tempo?: string;
  dropPercent?: number;
  note?: string;
}

/** Normalized row mirroring `library_exercises` / `seed_hypertrophy.sql` */
export interface CatalogExercise {
  id: string;
  slug: string;
  name: string;
  biomechanical_instructions: Record<string, string>;
  movement_pattern: IronMovementPattern;
  primary_muscle: string;
  synergist_muscles: readonly string[];
  cns_fatigue_cost: number;
  /** 1 (basic) → 5 (elite). Used for mastery filtering and exercise rotation quality. */
  complexity_level: 1 | 2 | 3 | 4 | 5;
  joint_stress_profile: JointStressProfile | null;
  equipment_required: readonly string[];
  default_sets: number;
  default_reps: number;
  stretch_mediated_hypertrophy: boolean;
  intensity_compatibility?: readonly CatalogIntensityTechnique[];
  requires_loading?: boolean;
  selection_score: number;
  tempo: ExerciseTempo;
  cue_card: ExerciseCueCard;
  tactical_role?: TacticalExerciseRole;
  stability_demand?: StabilityDemand;
  axial_loading?: AxialLoading;
  resistance_profile?: ResistanceProfile;
  specific_cues?: SpecificExerciseCues;
  /** ABCDEF specialization slot used to prevent conceptual duplicates. */
  slot_category?: string;
}

export interface ExerciseCatalog {
  readonly exercises: readonly CatalogExercise[];
  readonly byId: ReadonlyMap<string, CatalogExercise>;
  readonly bySlug: ReadonlyMap<string, CatalogExercise>;
  readonly byPattern: ReadonlyMap<IronMovementPattern, readonly CatalogExercise[]>;
  readonly byPrimaryMuscle: ReadonlyMap<string, readonly CatalogExercise[]>;
}

export interface CatalogValidationIssue {
  exerciseId: string;
  slug: string;
  field: 'movement_pattern' | 'primary_muscle' | 'synergist_muscles';
  severity: 'error' | 'warning';
  message: string;
}

export interface SolverSlot {
  slotId: string;
  day: SplitDayKey;
  /** Specialization taxonomy used by ABCDEF splits for precise exercise matching. */
  category?: string;
  requiredPatterns: readonly IronMovementPattern[];
  /** Optional muscle filter for slot (e.g. rear_delts) */
  primaryMuscleHint?: string;
  isolationOnly?: boolean;
  defaultSets: number;
  intensity_technique?: IntensityTechnique;
  technique_params?: TechniqueParams;
}

export interface SolverConstraints {
  /** Preferred V8 equipment contract. */
  available_equipment?: readonly EquipmentTag[];
  /** Legacy engine alias retained for existing callers. */
  equipment: readonly EquipmentTag[];
  blockedJointProfiles: readonly string[];
  maxSessionCns: number;
  /** 1 = beginner … 5 = elite (Mr. Olympia). */
  iron_mastery: 1 | 2 | 3 | 4 | 5;
  /** Intended session duration (minutes). Used for finishers + coherence autocorrect. */
  available_time_minutes: number;
  weekStartDate: string;
  previousDayWasHiit?: boolean;
  usedExerciseIds?: ReadonlySet<string>;
  dailyIronFocus?: DailyIronFocus;
  /** Profile readiness score, 0-100. High values bias stable machine/cable work. */
  cns_fatigue_score?: number | null;
  /** Current mesocycle phase for dynamic volume budgets. */
  mesocycle_phase?: MesocyclePhase | null;
  /** Current mesocycle week. Weeks 4/6 force deload budgets. */
  mesocycle_week?: number | null;
}

export interface SolverState {
  usedExerciseIds: ReadonlySet<string>;
  weeklyVolume: WeeklyVolumeSnapshot;
  synergistLoad: SynergistLoadMatrix;
  isRecoveryMode: boolean;
  sessionCnsAccum: number;
  sessionAxialLoad: number;
  shoulderSets: ShoulderVolumeLedger;
  previousDayIndex: number | null;
  previousDayHadAxialLoad: boolean;
  /** Same-day conceptual movement families already selected. */
  usedConceptKeys?: ReadonlySet<string>;
}

export interface SolverResult {
  slotId: string;
  exerciseId: string;
  prescribedSets: number;
  score: number;
  diagnostic_reason?: string;
  intensity_technique?: IntensityTechnique;
  technique_params?: TechniqueParams;
  targetRepRange?: string;
  targetRIR?: number;
}

/** One prescribed exercise in a PPL microcycle day (pre-gameplan / engine draft). */
export interface MicrocyclePick {
  slotId: string;
  exerciseId: string;
  prescribedSets: number;
  diagnostic_reason?: string;
  intensity_technique?: IntensityTechnique;
  technique_params?: TechniqueParams;
  targetRepRange?: string;
  targetRIR?: number;
}

/** Draft iron day — validated and corrected before `DailyGameplan` serialization. */
export interface MicrocycleDayPlan {
  day: SplitDayKey;
  picks: MicrocyclePick[];
}

export interface WeeklyVolumeSnapshot {
  /** Working sets in rolling 7d + projected plan */
  byMuscle: ReadonlyMap<string, number>;
  mev: number;
  mrvSoft: number;
  mrvHard: number;
}

export interface ShoulderVolumeLedger {
  anterior: number;
  lateral: number;
  posterior: number;
}

export interface SynergistLoadMatrix {
  /** Accumulated effective sets per normalized muscle from synergists */
  byMuscle: ReadonlyMap<string, number>;
}

export interface CoherenceViolation {
  code:
    | 'MISSING_PATTERN'
    | 'SHOULDER_IMBALANCE'
    | 'PUSH_PULL_RATIO'
    | 'WEEKLY_MRV_EXCEEDED'
    | 'SYNERGIST_OVERLAP';
  severity: 'error' | 'warning';
  slotId?: string;
  exerciseId?: string;
  detail: string;
}

export interface CoherenceReport {
  ok: boolean;
  violations: readonly CoherenceViolation[];
  swaps: readonly { fromExerciseId: string; toExerciseId: string; reason: string }[];
}

export interface IronMicrocycleInput {
  protocolDate: string;
  frequencyIron: number;
  equipment: readonly EquipmentTag[];
  constraints: SolverConstraints;
  catalog: ExerciseCatalog;
  ironLogs7d: readonly EnginePerformanceRow[];
  ironLogs21d: readonly EnginePerformanceRow[];
}
