import type {
    AxialLoading,
    ExerciseCueCard,
    ExerciseTempo,
    ResistanceProfile,
    StabilityDemand,
    TacticalExerciseRole,
} from '@/types/catalog';
import type { ClinicalReviewTrigger } from '@/types/clinical';

export interface AdaptationLogEntry {
  timestamp: string;
  rule_triggered: string;
  action_taken: string;
  exercises_rotated?: string[];
  new_exercises?: string[];
  details?: Record<string, string | number | boolean>;
}

export type WorkoutPillar = 'iron' | 'nutrition' | 'spirit' | 'longevity';

export type GameplanBlockStatus = 'pending' | 'active' | 'completed';

export type IronExecutionTechnique =
  | 'Standard'
  | 'Myo-Reps'
  | 'Rest-Pause'
  | 'Slow Eccentric (4s)'
  | 'Drop Set'
  | 'Cluster Sets'
  | 'DROP_SET'
  | 'REST_PAUSE'
  | 'PRE_EXHAUST'
  | 'BI_SET_ANTAGONIST'
  | 'BI_SET_SAME_MUSCLE'
  | (string & {});

export type LoadingProtocol = 'bodyweight' | 'weighted' | 'assisted';

export interface IronExercisePrescription {
  exercise_id: string;
  slug?: string;
  /** UI-safe label — strips catalog numeric prefixes */
  display_name?: string;
  target_sets: number;
  /** Upper bound of rep range (logging compatibility) */
  target_reps: number;
  target_weight_kg: number | null;
  /** e.g. "8-10 @ 2 RIR" */
  target_rep_range?: string;
  /** Reps in reserve (0–4) */
  target_rir?: number;
  /** Inter-set rest from CNS cost — compounds 120–180s, isolation 60–90s */
  rest_seconds?: number;
  /** Pre-mapped Adapt swap — same primary_muscle, ≤ CNS cost */
  alternative_exercise_id?: string | null;
  progression_note?: string;
  execution_technique?: IronExecutionTechnique;
  loading_protocol?: LoadingProtocol;
  superset_id?: string;
  /** Regra 4.1: eccentric, stretch pause, concentric, peak contraction. */
  tempo?: ExerciseTempo;
  /** Regra 4.2: Text-Only Elite biomechanical cue payload. */
  cue_card?: ExerciseCueCard;
  /** V9 tactical metadata surfaced for audits and coach UI. */
  tactical_role?: TacticalExerciseRole;
  stability_demand?: StabilityDemand;
  axial_loading?: AxialLoading;
  resistance_profile?: ResistanceProfile;
  /** ABCDEF specialization slot surfaced for diagnostics and UI auditability. */
  slot_category?: string;
  /** Audit trail for any solver/recovery volume reduction. */
  diagnostic_reason?: string;
}

export interface IronBlockPrescription {
  routine_id?: string;
  exercises: IronExercisePrescription[];
}

export interface NutritionBlockPrescription {
  goal: string | null;
  note: string;
  nutrition_target?: NutritionTarget;
}

export type HydrationFocus = 'standard' | 'flush_sodium';

export interface NutritionTarget {
  total_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_ml: number;
  peri_workout_carb_ratio: 0.65;
  hydration_focus: HydrationFocus;
  note?: string;
}

export interface SpiritBlockPrescription {
  mode: 'breathwork' | 'active_recovery';
  tempo_id: string;
  duration_minutes: number;
  prescribed_reason: string;
}

export interface LongevityBlockPrescription {
  pillar: 'longevity';
  title: 'Manutenção Biológica';
  duration_minutes: number;
  mobility_focus: string;
  mobility_cues: string[];
  core_exercise: string;
  cardio_prescription: string;
}

export interface GameplanBlock {
  id: string;
  pillar: WorkoutPillar;
  title: string;
  subtitle: string;
  duration_minutes: number;
  order: number;
  status: GameplanBlockStatus;
  completed_at?: string;
  iron?: IronBlockPrescription;
  nutrition?: NutritionBlockPrescription;
  spirit?: SpiritBlockPrescription;
  longevity?: LongevityBlockPrescription;
}

export type WorkoutBlock = GameplanBlock;

/** One day in the 7-day Head Coach microcycle (day_index 1 = Monday … 7 = Sunday) */
export interface MicrocycleDay {
  day_index: number;
  is_rest_day: boolean;
  focus_label: string;
  /** All training blocks completed for this calendar day */
  is_completed?: boolean;
  /** Calendar date (YYYY-MM-DD) when week_start_date is known */
  date?: string;
  blocks: GameplanBlock[];
}

export interface DailyGameplan {
  /** ISO date key (YYYY-MM-DD) — "today" for the command surface */
  date: string;
  /** Monday anchoring the microcycle week */
  week_start_date?: string;
  training_days_per_week?: number;
  /** Full 7-day plan from the AI clinic */
  microcycle: MicrocycleDay[];
  adaptation_logs?: AdaptationLogEntry[];
  /** Optional UI trigger — e.g. End-of-Month Clinical Exit Interview */
  clinical_review_trigger?: ClinicalReviewTrigger | null;
  /** Today's ritual blocks (derived from microcycle or legacy single-day payload) */
  blocks: GameplanBlock[];
  generated_at: string;
}
