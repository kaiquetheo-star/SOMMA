import type { CatalogExercise, LibraryExercise } from '@/types/catalog';

type XFrameScorableExercise = Pick<
  LibraryExercise,
  | 'slug'
  | 'name'
  | 'movement_pattern'
  | 'primary_muscle'
  | 'cns_fatigue_cost'
  | 'joint_stress_profile'
> & {
  synergist_muscles: readonly string[];
};

export const XFRAME_BIAS_CONFIG = {
  priorityWeights: {
    deltoid_lateral: 3.0,
    pectoralis_major_clavicular: 2.5,
    latissimus_dorsi_vertical: 2.5,
    quadriceps_vastus_lateral_bias: 2.0,
    hamstrings_glutes: 1.5,
    default: 1.0,
  },
  blacklistPatterns: [
    'lateral_flexion',
    'weighted_oblique_isolation',
    'high_load_rectus_abdominis',
  ],
} as const;

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');
}

function normalizedFields(exercise: XFrameScorableExercise): {
  slug: string;
  name: string;
  movementPattern: string;
  primaryMuscle: string;
  synergists: readonly string[];
} {
  return {
    slug: normalizeToken(exercise.slug),
    name: normalizeToken(exercise.name),
    movementPattern: normalizeToken(exercise.movement_pattern),
    primaryMuscle: normalizeToken(exercise.primary_muscle),
    synergists: exercise.synergist_muscles.map(normalizeToken),
  };
}

function isDeltoidLateral(primaryMuscle: string): boolean {
  return [
    'deltoid_lateral',
    'lateral_deltoid',
    'lateral_delt',
    'side_delt',
    'side_delts',
  ].includes(primaryMuscle);
}

function isClavicularPec(primaryMuscle: string): boolean {
  return [
    'pectoralis_major_clavicular',
    'clavicular_pec',
    'upper_chest',
  ].includes(primaryMuscle);
}

function isLatissimus(primaryMuscle: string): boolean {
  return ['latissimus_dorsi', 'lats', 'lat', 'back'].includes(primaryMuscle);
}

function isVerticalPull(exercise: XFrameScorableExercise): boolean {
  const { slug, name, movementPattern } = normalizedFields(exercise);
  return (
    movementPattern === 'vertical_pull' ||
    /(^|_)pull_?up($|_)/.test(slug) ||
    /(^|_)chin_?up($|_)/.test(slug) ||
    slug.includes('pulldown') ||
    slug.includes('pull_down') ||
    name.includes('pulldown') ||
    name.includes('pull_up')
  );
}

function isQuadricepsVastusLateralBias(exercise: XFrameScorableExercise): boolean {
  const { slug, movementPattern, primaryMuscle } = normalizedFields(exercise);
  const isQuad = [
    'quadriceps',
    'quads',
    'quad',
    'quadriceps_vastus_lateralis',
    'vastus_lateralis',
  ].includes(primaryMuscle);
  const kneeDominant =
    movementPattern === 'knee_dominant' ||
    movementPattern === 'squat' ||
    movementPattern === 'lunge';

  return isQuad && (kneeDominant || /squat|leg_press|leg_extension|hack/.test(slug));
}

function isHamstringsOrGlutes(primaryMuscle: string): boolean {
  return [
    'hamstrings',
    'hamstring',
    'glutes',
    'glute',
    'gluteus_maximus',
  ].includes(primaryMuscle);
}

export function isXFrameBlacklisted(exercise: XFrameScorableExercise): boolean {
  const { slug, name, movementPattern, primaryMuscle, synergists } = normalizedFields(exercise);
  const hasObliques = primaryMuscle === 'obliques' || synergists.includes('obliques');
  const isWeightedOblique =
    hasObliques &&
    (movementPattern === 'isolation' ||
      slug.includes('weighted') ||
      slug.includes('cable') ||
      slug.includes('dumbbell'));
  const isHighLoadRectus =
    ['rectus_abdominis', 'abs', 'abdominals'].includes(primaryMuscle) &&
    (exercise.cns_fatigue_cost ?? 0) >= 4;

  return (
    movementPattern === XFRAME_BIAS_CONFIG.blacklistPatterns[0] ||
    slug.includes('lateral_flexion') ||
    name.includes('lateral_flexion') ||
    isWeightedOblique ||
    isHighLoadRectus
  );
}

export function calculateSelectionScore(exercise: CatalogExercise): number;
export function calculateSelectionScore(exercise: XFrameScorableExercise): number;
export function calculateSelectionScore(exercise: XFrameScorableExercise): number {
  if (isXFrameBlacklisted(exercise)) return 0;

  const { primaryMuscle } = normalizedFields(exercise);
  const { priorityWeights } = XFRAME_BIAS_CONFIG;

  if (isDeltoidLateral(primaryMuscle)) return priorityWeights.deltoid_lateral;
  if (isClavicularPec(primaryMuscle)) return priorityWeights.pectoralis_major_clavicular;
  if (isLatissimus(primaryMuscle) && isVerticalPull(exercise)) {
    return priorityWeights.latissimus_dorsi_vertical;
  }
  if (isQuadricepsVastusLateralBias(exercise)) {
    return priorityWeights.quadriceps_vastus_lateral_bias;
  }
  if (isHamstringsOrGlutes(primaryMuscle)) return priorityWeights.hamstrings_glutes;

  return priorityWeights.default;
}
