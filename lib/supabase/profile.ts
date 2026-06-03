import type { BiologicalProfile } from '@/types/biological';
import {
  clampPillarTimeMinutes,
  clampPillarFrequency,
  clampCnsFatigueProfile,
  clampMesocycleWeekProfile,
  DEFAULT_AVAILABLE_TIME_IRON,
  DEFAULT_FREQUENCY_IRON,
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
  'focus_preference, date_of_birth, weight_kg, height_cm, body_fat_percentage, current_injuries, baseline_stress_level, training_days_per_week, goal_iron, available_time_iron, frequency_iron, mesocycle_week, cns_fatigue_score';

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
      date_of_birth: null,
      weight_kg: null,
      height_cm: null,
      body_fat_percentage: null,
      current_injuries: null,
      baseline_stress_level: null,
      goal_iron: null,
      nutrition_goal: null,
      training_days_per_week: null,
      experience_level: null,
      available_time_iron: null,
      iron_mastery: null,
      frequency_iron: null,
      mesocycle_week: null,
      cns_fatigue_score: null,
      clinical_exit_interview: null,
      current_body_fat_estimate: null,
      target_archetype: null,
    };
  }

  const goalText = (key: string) =>
    typeof row[key] === 'string' && row[key].trim() ? row[key].trim() : null;

  const trainingDaysRaw = row.training_days_per_week;
  const training_days_per_week =
    trainingDaysRaw != null
      ? Math.min(7, Math.max(1, Math.round(Number(trainingDaysRaw))))
      : null;

  return {
    date_of_birth: typeof row.date_of_birth === 'string' ? row.date_of_birth : null,
    weight_kg: row.weight_kg != null ? Number(row.weight_kg) : null,
    height_cm: row.height_cm != null ? Number(row.height_cm) : null,
    body_fat_percentage:
      row.body_fat_percentage != null ? Number(row.body_fat_percentage) : null,
    current_injuries:
      typeof row.current_injuries === 'string' ? row.current_injuries : null,
    baseline_stress_level:
      row.baseline_stress_level != null ? Number(row.baseline_stress_level) : null,
    goal_iron: goalText('goal_iron'),
    nutrition_goal: goalText('nutrition_goal'),
    training_days_per_week: Number.isFinite(training_days_per_week)
      ? training_days_per_week
      : null,
    experience_level:
      row.experience_level === 'beginner' ||
      row.experience_level === 'intermediate' ||
      row.experience_level === 'advanced'
        ? row.experience_level
        : null,
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
        : null,
    frequency_iron: clampPillarFrequency(
      row.frequency_iron != null ? Number(row.frequency_iron) : null,
      DEFAULT_FREQUENCY_IRON,
    ),
    mesocycle_week: clampMesocycleWeekProfile(
      row.mesocycle_week != null ? Number(row.mesocycle_week) : null,
    ),
    cns_fatigue_score: clampCnsFatigueProfile(
      row.cns_fatigue_score != null ? Number(row.cns_fatigue_score) : null,
    ),
    clinical_exit_interview: null,
    current_body_fat_estimate:
      row.current_body_fat_estimate != null ? Number(row.current_body_fat_estimate) : null,
    target_archetype:
      typeof row.target_archetype === 'string' &&
      ['AESTHETIC_V_TAPER', 'POWERBUILDER_BULK', 'LEAN_RECOMP'].includes(row.target_archetype)
        ? (row.target_archetype as BiologicalProfile['target_archetype'])
        : null,
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
      date_of_birth: payload.biological.date_of_birth,
      weight_kg: payload.biological.weight_kg,
      height_cm: payload.biological.height_cm,
      body_fat_percentage: payload.biological.body_fat_percentage,
      current_injuries: payload.biological.current_injuries,
      baseline_stress_level: payload.biological.baseline_stress_level,
      goal_iron: payload.biological.goal_iron,
      training_days_per_week: payload.biological.training_days_per_week,
      available_time_iron: payload.biological.available_time_iron,
      frequency_iron: payload.biological.frequency_iron,
      mesocycle_week: payload.biological.mesocycle_week,
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
    date_of_birth: biological.date_of_birth,
    weight_kg: biological.weight_kg,
    height_cm: biological.height_cm,
    body_fat_percentage: biological.body_fat_percentage,
    current_injuries: biological.current_injuries,
    baseline_stress_level: biological.baseline_stress_level,
    goal_iron: biological.goal_iron,
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
