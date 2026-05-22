import { isSupabaseConfigured } from '@/lib/config';
import { generateStubGameplan } from '@/lib/gameplan/generateStubGameplan';
import { parseDailyGameplanPayload } from '@/lib/gameplan/parseGameplan';
import { getSupabase } from '@/lib/supabase/client';
import type { DailyGameplan } from '@/types/gameplan';
import type { FocusPreference, EquipmentTag } from '@/store/useSommaStore';

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchProtocolFromTable(userId: string): Promise<DailyGameplan | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('daily_protocols')
    .select('blocks, generated_at, protocol_date')
    .eq('user_id', userId)
    .eq('protocol_date', todayDateKey())
    .maybeSingle();

  if (error || !data) return null;

  return parseDailyGameplanPayload({
    date: data.protocol_date,
    blocks: data.blocks,
    generated_at: data.generated_at,
  });
}

async function invokeGenerateEdgeFunction(
  focus: FocusPreference,
  equipment: EquipmentTag[],
): Promise<DailyGameplan | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.functions.invoke('generate_daily_protocol', {
    body: {
      focus_preference: focus,
      available_equipment: equipment,
    },
  });

  if (error) {
    console.warn('[SOMMA] Edge function error:', error.message);
    return null;
  }

  return parseDailyGameplanPayload(data);
}

export interface FetchDailyGameplanInput {
  focus: FocusPreference;
  equipment: EquipmentTag[];
  userId?: string | null;
  forceRefresh?: boolean;
}

/** AI Edge Function → Postgres cache → local stub fallback (SAD §3.3) */
export async function fetchDailyGameplan({
  focus,
  equipment,
  userId,
  forceRefresh = false,
}: FetchDailyGameplanInput): Promise<DailyGameplan> {
  if (isSupabaseConfigured && userId) {
    if (!forceRefresh) {
      const cached = await fetchProtocolFromTable(userId);
      if (cached) return cached;
    }

    const fromEdge = await invokeGenerateEdgeFunction(focus, equipment);
    if (fromEdge) return fromEdge;
  }

  return generateStubGameplan(focus, equipment);
}
