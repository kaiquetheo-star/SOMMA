import type { BiologicalProfile } from '@/types/biological';
import { isBiologicalProfileComplete } from '@/types/biological';
import type {
  EquipmentTag,
  FocusPreference,
  UserStats,
} from '@/store/useSommaStore';
import { useSommaStore } from '@/store/useSommaStore';

import { getSupabase } from '@/lib/supabase/client';

const PROFILE_BIOLOGY_SELECT =
  'focus_preference, date_of_birth, weight_kg, height_cm, body_fat_percentage, current_injuries, baseline_stress_level';

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
    };
  }

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
        body_essence: statsRes.data.body_essence ?? 0,
        mind_essence: statsRes.data.mind_essence ?? 0,
        spirit_essence: statsRes.data.spirit_essence ?? 0,
        combat_mastery: statsRes.data.combat_mastery ?? 0,
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

/** Pull Supabase rows into Zustand for offline-first reads */
export function hydrateLocalStoreFromRemote(snapshot: RemoteUserSnapshot): void {
  const { completeFoundationScan, setUserStats, setUserBiological } = useSommaStore.getState();

  if (snapshot.user_biological) {
    setUserBiological(snapshot.user_biological);
  }

  if (
    snapshot.hasFoundation &&
    snapshot.focus_preference &&
    snapshot.available_equipment.length > 0 &&
    isBiologicalProfileComplete(snapshot.user_biological)
  ) {
    completeFoundationScan({
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
    }),
    supabase.from('user_environment').upsert({
      user_id: authedUserId,
      available_equipment: payload.available_equipment,
      updated_at: updatedAt,
    }),
    supabase.from('user_stats').upsert({
      user_id: authedUserId,
      body_essence: payload.user_stats.body_essence,
      mind_essence: payload.user_stats.mind_essence,
      spirit_essence: payload.user_stats.spirit_essence,
      combat_mastery: payload.user_stats.combat_mastery,
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
  });

  if (error) throw error;
}
