/**
 * Canonical Head Coach entry — 7-day microcycle generation.
 * Zero-Cost Clinical Engine: delegates to deterministic handler in generate_daily_protocol ($0 API).
 *
 * Deploy: supabase functions deploy generate_weekly_microcycle
 */
// CLINICAL ENGINE: DETERMINISTIC ONLY. NO RANDOMNESS ALLOWED. IF INPUTS ARE CONSTANT, OUTPUT MUST BE CONSTANT.
import { buildCorsHeaders } from '../_shared/cors.ts';
import { handleHeadCoachRequest } from '../generate_daily_protocol/index.ts';

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const method = req.method;
  console.log('[generate_weekly_microcycle] Request received', { method });
  try {
    const response = await handleHeadCoachRequest(req);
    console.log('[generate_weekly_microcycle] Handler completed', {
      status: response.status,
    });
    return response;
  } catch (error) {
    console.error('[generate_weekly_microcycle] Unhandled error');
    return new Response(JSON.stringify({ error: 'GENERATION_FAILED', message: 'Internal server error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
