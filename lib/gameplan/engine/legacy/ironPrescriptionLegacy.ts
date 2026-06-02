// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.

/**
 * Legacy iron block builder — seeded pool selection (pre–Iron engine).
 * Used when `frequency_iron !== 6` until additional splits ship in Phase 5.
 */
export {
  applyIronRoutineAutoregulation,
  buildIronBlock,
  detectIronAutoregulation,
} from '@/lib/gameplan/engine/prescription';

export { selectExercisesForSplit } from '@/lib/gameplan/engine/periodization';
export { selectExercisesFromPatternPools } from '@/lib/gameplan/engine/exercisePoolSelection';
