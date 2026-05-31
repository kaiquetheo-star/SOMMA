/** Strict primary-muscle vocabulary for deterministic split routing */
export const STANDARD_PRIMARY_MUSCLES = [
  'chest',
  'back',
  'quads',
  'hamstrings',
  'calves',
  'glutes',
  'biceps',
  'triceps',
  'shoulders',
  'core',
  'rear delt',
] as const;

export type StandardPrimaryMuscle = (typeof STANDARD_PRIMARY_MUSCLES)[number];

const ALIAS_MAP: Record<string, StandardPrimaryMuscle | 'rear delt'> = {
  lats: 'back',
  lat: 'back',
  'mid back': 'back',
  'lower back': 'back',
  traps: 'back',
  trapezius: 'back',
  'rear delts': 'rear delt',
  'rear deltoid': 'rear delt',
  delts: 'shoulders',
  deltoids: 'shoulders',
  shoulder: 'shoulders',
  pecs: 'chest',
  pectorals: 'chest',
  quadriceps: 'quads',
  hams: 'hamstrings',
  hamstring: 'hamstrings',
  glute: 'glutes',
  gluteus: 'glutes',
  hips: 'glutes',
  hip: 'glutes',
  abs: 'core',
  abdominals: 'core',
  obliques: 'core',
  calf: 'calves',
  bicep: 'biceps',
  tricep: 'triceps',
};

export function normalizePrimaryMuscle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().trim().replace(/_/g, ' ').replace(/\s+/g, ' ');
  if (!normalized) return null;

  const aliased = ALIAS_MAP[normalized];
  if (aliased) return aliased;

  if ((STANDARD_PRIMARY_MUSCLES as readonly string[]).includes(normalized)) {
    return normalized;
  }

  return normalized;
}
