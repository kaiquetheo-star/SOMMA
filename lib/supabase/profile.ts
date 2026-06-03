import type { BiologicalProfile } from '@/types/biological';
import {
  clampPillarTimeMinutes,
  clampPillarFrequency,
  clampCnsFatigueProfile,
  DEFAULT_AVAILABLE_TIME_IRON,
  DEFAULT_FREQUENCY_IRON,
  FIXED_DATE_OF_BIRTH,
  FIXED_GOAL_IRON,
  FIXED_HEIGHT_CM,
  FIXED_NUTRITION_GOAL,
  deriveTrainingDaysFromFrequencies,
  isBiologicalProfileComplete,
} from '@/types/biological';
import type {
  EquipmentTag,
  FocusPreference,
  UserStats,
} from '@/store/useSommaStore';
import { useSommaStore } from '@/store/useSommaStore';

import { getSupabase } from '@/lib/supabase/client';

const PROFILE_BIOLOGY_SELECT =
  'focus_preference, weight_kg, body_fat_percentage, current_injuries, baseline_stress_level, training_days_per_week, available_time_iron, frequency_iron, cns_fatigue_score';

/** Ensures the Supabase client has a JWT before PostgREST calls (avoids opaque 401s). */
async function requireAuthenticatedUserId(expectedUserId?: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  if (!session?.access_token || !session.user?.id) {
    throw new Error('Your session expired. Please sign in again.');
  }

  if (expectedUserId && session.user.id !== expectedUserId) {
    throw new Error('Signed-in user does not match the active session.');
  }

  return session.user.id;
}

function mapProfileBiology(row: Record<string, unknown> | null): BiologicalProfile {
  if (!row) {
    return {
      date_of_birth: FIXED_DATE_OF_BIRTH,
      weight_kg: null,
      height_cm: FIXED_HEIGHT_CM,
      body_fat_percentage: null,
      current_injuries: null,
      baseline_stress_level: null,
      goal_iron: FIXED_GOAL_IRON,
      nutrition_goal: FIXED_NUTRITION_GOAL,
      training_days_per_week: null,
      experience_level: 'advanced',
      available_time_iron: null,
      iron_mastery: 5,
      frequency_iron: null,
      cns_fatigue_score: null,
      clinical_exit_interview: null,
      current_body_fat_estimate: null,
    };
  }

  const trainingDaysRaw = row.training_days_per_week;
  const training_days_per_week =
    trainingDaysRaw != null
      ? Math.min(7, Math.max(1, Math.round(Number(trainingDaysRaw))))
      : null;

  return {
    date_of_birth: FIXED_DATE_OF_BIRTH,
    weight_kg: row.weight_kg != null ? Number(row.weight_kg) : null,
    height_cm: FIXED_HEIGHT_CM,
    body_fat_percentage:
      row.body_fat_percentage != null ? Number(row.body_fat_percentage) : null,
    current_injuries:
      typeof row.current_injuries === 'string' ? row.current_injuries : null,
    baseline_stress_level:
      row.baseline_stress_level != null ? Number(row.baseline_stress_level) : null,
    goal_iron: FIXED_GOAL_IRON,
    nutrition_goal: FIXED_NUTRITION_GOAL,
    training_days_per_week: Number.isFinite(training_days_per_week)
      ? training_days_per_week
      : null,
    experience_level:
      row.experience_level === 'beginner' ||
      row.experience_level === 'intermediate' ||
      row.experience_level === 'advanced'
        ? row.experience_level
        : 'advanced',
    available_time_iron: clampPillarTimeMinutes(
      row.available_time_iron != null ? Number(row.available_time_iron) : null,
      15,
      180,
      DEFAULT_AVAILABLE_TIME_IRON,
    ),
    iron_mastery:
      row.iron_mastery === 1 ||
      row.iron_mastery === 2 ||
      row.iron_mastery === 3 ||
      row.iron_mastery === 4 ||
      row.iron_mastery === 5
        ? row.iron_mastery
        : 5,
    frequency_iron: clampPillarFrequency(
      row.frequency_iron != null ? Number(row.frequency_iron) : null,
      DEFAULT_FREQUENCY_IRON,
    ),
    cns_fatigue_score: clampCnsFatigueProfile(
      row.cns_fatigue_score != null ? Number(row.cns_fatigue_score) : null,
    ),
    clinical_exit_interview: null,
    current_body_fat_estimate:
      row.current_body_fat_estimate != null ? Number(row.current_body_fat_estimate) : null,
  };
}

export interface RemoteUserSnapshot {
  hasFoundation: boolean;
  focus_preference: FocusPreference | null;
  available_equipment: EquipmentTag[];
  user_stats: UserStats | null;
  user_biological: BiologicalProfile;
}

export interface FetchRemoteUserSnapshotOptions {
  /** When true, skip a second getSession() probe (safe after AuthProvider bootstrap). */
  skipSessionProbe?: boolean;
}

export async function fetchRemoteUserSnapshot(
  userId: string,
  options?: FetchRemoteUserSnapshotOptions,
): Promise<RemoteUserSnapshot | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const authedUserId = options?.skipSessionProbe
    ? userId
    : await requireAuthenticatedUserId(userId);

  const [profileRes, environmentRes, statsRes] = await Promise.all([
    supabase.from('profiles').select(PROFILE_BIOLOGY_SELECT).eq('id', authedUserId).maybeSingle(),
    supabase
      .from('user_environment')
      .select('available_equipment')
      .eq('user_id', authedUserId)
      .maybeSingle(),
    supabase.from('user_stats').select('*').eq('user_id', authedUserId).maybeSingle(),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (environmentRes.error) throw environmentRes.error;
  if (statsRes.error) throw statsRes.error;

  const focus_preference = (profileRes.data?.focus_preference as FocusPreference | null) ?? null;
  const user_biological = mapProfileBiology(profileRes.data);
  const available_equipment =
    (environmentRes.data?.available_equipment as EquipmentTag[] | undefined) ?? [];

  const hasFoundation =
    focus_preference !== null &&
    Array.isArray(available_equipment) &&
    available_equipment.length > 0 &&
    isBiologicalProfileComplete(user_biological);

  const user_stats = statsRes.data
    ? {
        iron_sessions_completed: statsRes.data.iron_sessions_completed ?? 0,
        nutrition_checkins_completed: statsRes.data.nutrition_checkins_completed ?? 0,
      }
    : null;

  return {
    hasFoundation,
    focus_preference,
    available_equipment,
    user_stats,
    user_biological,
  };
}

/** Pull Supabase rows into Zustand for offline-first reads (no gameplan mutation). */
export function hydrateLocalStoreFromRemote(snapshot: RemoteUserSnapshot): void {
  const { hydrateFoundationFromRemote, setUserStats, setUserBiological } =
    useSommaStore.getState();

  if (snapshot.user_biological) {
    setUserBiological(snapshot.user_biological);
  }

  if (
    snapshot.hasFoundation &&
    snapshot.focus_preference &&
    snapshot.available_equipment.length > 0 &&
    isBiologicalProfileComplete(snapshot.user_biological)
  ) {
    hydrateFoundationFromRemote({
      focus_preference: snapshot.focus_preference,
      available_equipment: snapshot.available_equipment,
      biological: snapshot.user_biological,
    });
  }

  if (snapshot.user_stats) {
    setUserStats(snapshot.user_stats);
  }
}

export async function syncFoundationToSupabase(
  userId: string,
  payload: {
    focus_preference: FocusPreference;
    available_equipment: EquipmentTag[];
    user_stats: UserStats;
    biological: BiologicalProfile;
  },
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const authedUserId = await requireAuthenticatedUserId(userId);
  const updatedAt = new Date().toISOString();

  const [profileRes, environmentRes, statsRes] = await Promise.all([
    supabase.from('profiles').upsert({
      id: authedUserId,
      focus_preference: payload.focus_preference,
      date_of_birth: FIXED_DATE_OF_BIRTH,
      weight_kg: payload.biological.weight_kg,
      height_cm: FIXED_HEIGHT_CM,
      body_fat_percentage: payload.biological.body_fat_percentage,
      current_injuries: payload.biological.current_injuries,
      baseline_stress_level: payload.biological.baseline_stress_level,
      goal_iron: FIXED_GOAL_IRON,
      training_days_per_week: payload.biological.training_days_per_week,
      available_time_iron: payload.biological.available_time_iron,
      frequency_iron: payload.biological.frequency_iron,
      cns_fatigue_score: payload.biological.cns_fatigue_score,
    }),
    supabase.from('user_environment').upsert({
      user_id: authedUserId,
      available_equipment: payload.available_equipment,
      updated_at: updatedAt,
    }),
    supabase.from('user_stats').upsert({
      user_id: authedUserId,
      iron_sessions_completed: payload.user_stats.iron_sessions_completed,
      nutrition_checkins_completed: payload.user_stats.nutrition_checkins_completed,
    }),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (environmentRes.error) throw environmentRes.error;
  if (statsRes.error) throw statsRes.error;
}

/** Update biological passport columns on `profiles` (Analytics tab edits). */
export async function upsertBiologicalPassport(
  userId: string,
  biological: BiologicalProfile,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const authedUserId = await requireAuthenticatedUserId(userId);

  const { error } = await supabase.from('profiles').upsert({
    id: authedUserId,
    date_of_birth: FIXED_DATE_OF_BIRTH,
    weight_kg: biological.weight_kg,
    height_cm: FIXED_HEIGHT_CM,
    body_fat_percentage: biological.body_fat_percentage,
    current_injuries: biological.current_injuries,
    baseline_stress_level: biological.baseline_stress_level,
    goal_iron: FIXED_GOAL_IRON,
    training_days_per_week: biological.training_days_per_week,
    available_time_iron: biological.available_time_iron,
    frequency_iron: biological.frequency_iron,
  });

  if (error) throw error;
}

/** Command Center steering wheel — granular frequencies + time budgets. */
export async function upsertSteeringWheelSettings(
  userId: string,
  biological: BiologicalProfile,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const authedUserId = await requireAuthenticatedUserId(userId);
  const training_days_per_week = deriveTrainingDaysFromFrequencies(biological);

  const { error } = await supabase.from('profiles').upsert({
    id: authedUserId,
    frequency_iron: biological.frequency_iron,
    available_time_iron: biological.available_time_iron,
    training_days_per_week,
  });

  if (error) throw error;
}
