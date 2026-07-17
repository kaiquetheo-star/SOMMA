import { equipmentMatches } from '@/lib/gameplan/engine/periodization';
import type { EquipmentTag } from '@/store/useSommaStore';
import type { BiologicalProfile } from '@/types/biological';
import type { LibraryExercise } from '@/types/catalog';

export interface IronInjuryConstraintState {
  blocked_joint_profiles: string[];
  swaps_applied: { from_exercise_id: string; to_exercise_id: string; reason: string }[];
}

function parseBlockedJointProfiles(injuries: string | null): string[] {
  if (!injuries?.trim()) return [];
  const text = injuries.toLowerCase();
  const blocked: string[] = [];
  if (/knee|patella|acl|meniscus/.test(text)) blocked.push('high_knee_shear', 'moderate_knee_stress');
  if (/shoulder|rotator|impingement|labrum/.test(text)) blocked.push('rotator_cuff_heavy', 'shoulder_impingement_risk');
  if (/lumbar|lower back|disc|spine|back/.test(text)) blocked.push('lumbar_shear', 'spinal_axial_load');
  if (/wrist|elbow/.test(text)) blocked.push('wrist_stress');
  if (/neck|cervical/.test(text)) blocked.push('cervical_load');
  return [...new Set(blocked)];
}

export function detectIronInjuryConstraints(
  biological: BiologicalProfile,
): IronInjuryConstraintState {
  return {
    blocked_joint_profiles: parseBlockedJointProfiles(biological.current_injuries),
    swaps_applied: [],
  };
}

function isExerciseBlocked(exercise: LibraryExercise, blocked: readonly string[]): boolean {
  return Boolean(
    exercise.joint_stress_profile &&
      blocked.includes(exercise.joint_stress_profile),
  );
}

export function applyIronInjuryConstraints(
  baseRoutineIds: string[],
  catalog: LibraryExercise[],
  equipment: EquipmentTag[],
  constraints: IronInjuryConstraintState,
): string[] {
  return baseRoutineIds.map((exerciseId) => {
    const exercise = catalog.find((row) => row.id === exerciseId);
    if (!exercise || !isExerciseBlocked(exercise, constraints.blocked_joint_profiles)) {
      return exerciseId;
    }

    return catalog.find(
      (candidate) =>
        candidate.primary_muscle === exercise.primary_muscle &&
        candidate.id !== exerciseId &&
        !isExerciseBlocked(candidate, constraints.blocked_joint_profiles) &&
        equipmentMatches(candidate, equipment),
    )?.id ?? exerciseId;
  });
}
