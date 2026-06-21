// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.

export {
  type ClinicalPhase,
  type ClinicalExerciseMeta,
  classifyClinicalPhase,
  applyFivePhaseClinicalMatrix,
} from '@/lib/shared/exerciseClassification';
