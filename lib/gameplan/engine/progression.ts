// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.

import type { ClinicalExitInterview, ClinicalReviewTrigger } from '@/types/clinical';

export const CLINICAL_REVIEW_TRIGGER_TYPE = 'clinical_exit_interview' as const;

/** Legacy hook retained for callers; automatic progression no longer uses manual week fields. */
export function buildClinicalReviewTrigger(_unused: unknown, interviewSubmitted: boolean): ClinicalReviewTrigger | null {
  if (interviewSubmitted) return null;
  return null;

}

export function isMesocycleMonthComplete(
  _unused: unknown,
  interview: ClinicalExitInterview | null | undefined,
): boolean {
  return interview != null;
}

/**
 * Month 2 progressive overload from Exit Interview — strength-based, not guesswork.
 * Uses athlete-reported 1RM when provided; otherwise scales prior target.
 */
export function adjustTargetWeightForMonth2(
  currentTargetKg: number | null,
  review: ClinicalExitInterview,
  targetReps = 8,
  targetRir = 2,
): number | null {
  const pctForReps = Math.max(0.65, 1 - (targetReps + targetRir) * 0.025);

  let base: number | null = null;
  if (review.estimated_1rm_kg != null && review.estimated_1rm_kg > 0) {
    base = review.estimated_1rm_kg * pctForReps;
  } else if (currentTargetKg != null && currentTargetKg > 0) {
    base = currentTargetKg;
  }

  if (base == null) return null;

  if (review.perceived_fatigue >= 8 || review.average_rpe >= 8.5) {
    return Math.round(base * 0.95 * 10) / 10;
  }
  if (review.average_rpe <= 7 && review.perceived_fatigue <= 5) {
    return Math.round(base * 1.025 * 10) / 10;
  }
  return Math.round(base * 10) / 10;
}

export function nextMesocycleWeekAfterReview(): number {
  return 1;
}
