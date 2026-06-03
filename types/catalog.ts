/**

 * SOMMA Encyclopedia catalog types — `library_exercises`

 * Text-only Elite: coaching copy lives in `biomechanical_instructions` JSONB.

 */



/** Known joint stress tags — DB allows any text; extend as catalog grows */

export type JointStressProfile =

  | 'low_impact'

  | 'moderate_knee_stress'

  | 'high_knee_shear'

  | 'lumbar_shear'

  | 'spinal_axial_load'

  | 'rotator_cuff_heavy'

  | 'shoulder_impingement_risk'

  | 'hip_flexion_intense'

  | 'wrist_stress'

  | 'cervical_load'

  | (string & {});



export type MovementPattern =

  | 'push'

  | 'pull'

  | 'hinge'

  | 'squat'

  | 'lunge'

  | 'carry'

  | 'isolation'

  | (string & {});


export type ExerciseTempo = [number, number, string | number, number];


export type ExerciseFailureType = 'technical' | 'concentric';


export interface ExerciseCueCard {

  setup: string;

  vector: string;

  catch: string;

  anti_pattern: string;

  failure_type: ExerciseFailureType;

}


export interface XFrameCatalogMetadata {

  /** Aesthetic priority weight for deterministic X-Frame selection. */

  selection_score: number;

  /** Cadence: eccentric, stretch pause, concentric, peak contraction. */

  tempo: ExerciseTempo;

  cue_card: ExerciseCueCard;

}



/** Biomechanical metadata for Elite Hypertrophy coaching / AI Experts */

export interface IronExerciseBiomechanics {

  primary_muscle: string | null;

  synergist_muscles: string[];

  /** 1 = minimal CNS cost · 5 = heavy axial / compound fatigue */

  cns_fatigue_cost: number | null;

  joint_stress_profile: JointStressProfile | null;

  /** Peak tension biased toward lengthened position (stretch-mediated hypertrophy) */

  stretch_mediated_hypertrophy: boolean;

}



export interface LibraryExerciseBase {

  id: string;

  slug: string;

  name: string;

  biomechanical_instructions: Record<string, string>;

  equipment_required: string[];

  default_sets: number;

  default_reps: number;

  movement_pattern: MovementPattern | null;

}



export type LibraryExercise = LibraryExerciseBase & IronExerciseBiomechanics;


export type CatalogExercise = LibraryExercise & XFrameCatalogMetadata;



export function formatCnsFatigueCost(cost: number | null): string {

  if (cost == null) return '—';

  const labels: Record<number, string> = {

    1: 'Minimal',

    2: 'Low',

    3: 'Moderate',

    4: 'High',

    5: 'Severe',

  };

  return `${cost} · ${labels[cost] ?? 'Unknown'}`;

}



export function formatJointStress(profile: string | null): string {

  if (!profile) return '—';

  return profile.replace(/_/g, ' ');

}



/** Dynamic rest from catalog CNS fatigue cost (Elite hypertrophy) */

export function computeRestSecondsFromCns(cnsFatigueCost: number | null): number {

  const cost = cnsFatigueCost ?? 3;

  if (cost >= 5) return 180;

  if (cost >= 4) return 150;

  if (cost >= 3) return 105;

  if (cost >= 2) return 75;

  return 60;

}



export const HYPERTROPHY_MEV_SETS = 10;

export const HYPERTROPHY_MRV_SOFT = 18;

export const HYPERTROPHY_MRV_HARD = 20;


