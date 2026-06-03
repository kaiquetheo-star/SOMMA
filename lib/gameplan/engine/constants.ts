/** Hardcoded periodization constants — Head Coach local engine ($0 API) */

export const MESOCYCLE_DAYS = 21;
export const WEEKLY_VOLUME_DAYS = 7;

export const HYPERTROPHY_MEV_SETS = 10;
export const HYPERTROPHY_MRV_SOFT = 18;
export const HYPERTROPHY_MRV_HARD = 20;

export const HIGH_CNS_SWAP_THRESHOLD = 4;
export const LOW_CNS_SWAP_MAX = 2;

export const MICROCYCLE_FOCUS_ROTATIONS: Record<number, string[]> = {
  3: ['Iron: Full Body A', 'Iron: Full Body B', 'Iron: Full Body C'],
  4: ['Iron: Upper', 'Iron: Lower', 'Iron: Full Body A', 'Iron: Full Body B'],
  5: ['Iron: Push', 'Iron: Pull', 'Iron: Legs', 'Iron: Upper', 'Iron: Lower'],
  6: ['Iron: Push', 'Iron: Pull', 'Iron: Legs', 'Iron: Push', 'Iron: Pull', 'Iron: Legs'],
  7: [
    'Iron: Push',
    'Iron: Pull',
    'Iron: Legs',
    'Iron: Upper',
    'Iron: Upper',
    'Iron: Lower',
    'Iron: Full Body',
  ],
};
