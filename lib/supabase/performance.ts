import { isSupabaseConfigured } from '@/lib/config';
import { parseDailyGameplanPayload } from '@/lib/gameplan/parseGameplan';
import { getSupabase } from '@/lib/supabase/client';
import type { DailyGameplan } from '@/types/gameplan';
import type { FocusPreference, EquipmentTag } from '@/store/useSommaStore';
import type { PerformanceQueueItem } from '@/types/performance';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toNullableUuid(value: string | null | undefined): string | null {
  if (!value || !UUID_RE.test(value)) return null;
  return value;
}

export interface SyncPerformanceResult {
  insertedCount: number;
  gameplan: DailyGameplan | null;
  source: 'ai' | 'fallback' | 'deterministic' | 'stub' | null;
}

function mapQueueItemToRow(userId: string, item: PerformanceQueueItem) {
  const session = item.session;
  const input = item.input;

  let exercise_id: string | null = input.exercise_id ?? null;
  let weight_used: number | null = input.weight_used ?? null;
  let reps_completed: number | null = input.reps_completed ?? null;
  let rpe_score: number | null = input.rpe_score ?? null;
  let actual_rest_seconds: number | null = input.actual_rest_seconds ?? null;
  let volume: number | null = input.volume ?? null;

  if (session?.iron) {
    exercise_id = session.iron.exercise_id;
    const lastSet = session.iron.sets[session.iron.sets.length - 1];
    if (lastSet) {
      weight_used = lastSet.weight_kg;
      reps_completed = lastSet.reps;
      actual_rest_seconds = lastSet.rest_seconds_used;
    }
    volume = session.iron.sets.reduce((sum, set) => sum + set.reps, 0);
  }

  if (session?.combat) {
    rpe_score = session.combat.rpe_score ?? rpe_score;
    volume = session.combat.rounds.reduce((sum, round) => sum + round.work_seconds, 0);
  }

  if (session?.spirit) {
    volume = session.spirit.total_seconds;
    rpe_score = rpe_score ?? 6;
  }

  return {
    user_id: userId,
    pillar: input.pillar,
    exercise_id: toNullableUuid(exercise_id),
    block_id: input.block_id,
    weight_used,
    reps_completed,
    rpe_score,
    actual_rest_seconds,
    volume,
    payload: session ?? { input },
    timestamp: item.created_at,
  };
}

/** Insert queued performance rows, then invoke AI recalibration Edge Function. */
export async function syncPerformanceQueueAndRecalibrate(
  queue: PerformanceQueueItem[],
  context: {
    focus: FocusPreference;
    equipment: EquipmentTag[];
  },
): Promise<SyncPerformanceResult> {
  try {
    if (!isSupabaseConfigured || queue.length === 0) {
      return { insertedCount: 0, gameplan: null, source: null };
    }

    const supabase = getSupabase();
    if (!supabase) {
      return { insertedCount: 0, gameplan: null, source: null };
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user?.id) {
      console.warn('[SOMMA] Performance sync skipped — no session');
      return { insertedCount: 0, gameplan: null, source: null };
    }

    const userId = session.user.id;
    const rows = queue.map((item) => mapQueueItemToRow(userId, item));

    const { error: insertError } = await supabase.from('performance_logs').insert(rows);

    if (insertError) {
      console.warn('[SOMMA] performance_logs insert failed:', insertError.message);
      return { insertedCount: 0, gameplan: null, source: 'fallback' };
    }

    const { data, error: fnError } = await supabase.functions.invoke('generate_daily_protocol', {
      body: {
        focus_preference: context.focus,
        available_equipment: context.equipment,
      },
    });

    if (fnError) {
      console.warn('[SOMMA] Recalibration invoke failed:', fnError.message);
      return { insertedCount: rows.length, gameplan: null, source: 'fallback' };
    }

    const gameplan = parseDailyGameplanPayload(data);
    const source =
      typeof data === 'object' && data !== null && 'source' in data
        ? (data as { source: SyncPerformanceResult['source'] }).source
        : 'ai';

    return {
      insertedCount: rows.length,
      gameplan,
      source: gameplan ? source : null,
    };
  } catch (err) {
    console.warn(
      '[SOMMA] Performance sync error:',
      err instanceof Error ? err.message : err,
    );
    return { insertedCount: 0, gameplan: null, source: 'fallback' };
  }
}
