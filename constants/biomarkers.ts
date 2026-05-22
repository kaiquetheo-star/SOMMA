export type BiomarkerCategory = 'metabolic' | 'cardio' | 'recovery' | 'inflammation';

export interface BiomarkerPlaceholder {
  id: string;
  name: string;
  category: BiomarkerCategory;
  unit: string;
  optimalHint: string;
}

/** Catalog marker ids — must match `biomarker_readings.marker_id` */
export const BIOMARKER_PLACEHOLDERS: BiomarkerPlaceholder[] = [
  {
    id: 'hba1c',
    name: 'HbA1c',
    category: 'metabolic',
    unit: '%',
    optimalHint: 'Longevity band · 4.8–5.4%',
  },
  {
    id: 'fasting_glucose',
    name: 'Fasting glucose',
    category: 'metabolic',
    unit: 'mg/dL',
    optimalHint: 'Metabolic flexibility anchor',
  },
  {
    id: 'resting_hr',
    name: 'Resting heart rate',
    category: 'cardio',
    unit: 'bpm',
    optimalHint: 'Autonomic reserve signal',
  },
  {
    id: 'hrv',
    name: 'HRV (RMSSD)',
    category: 'recovery',
    unit: 'ms',
    optimalHint: 'Recovery readiness',
  },
  {
    id: 'vo2max',
    name: 'VO₂ max',
    category: 'cardio',
    unit: 'mL/kg/min',
    optimalHint: 'Aerobic capacity ceiling',
  },
  {
    id: 'hs_crp',
    name: 'hs-CRP',
    category: 'inflammation',
    unit: 'mg/L',
    optimalHint: 'Systemic inflammation load',
  },
];

export const BIOMARKER_CATEGORY_LABELS: Record<BiomarkerCategory, string> = {
  metabolic: 'Metabolic',
  cardio: 'Cardio',
  recovery: 'Recovery',
  inflammation: 'Inflammation',
};
