const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
];

function getAllowedOrigin(requestOrigin: string | null): string {
  if (!requestOrigin) return ALLOWED_ORIGINS[0];
  if (ALLOWED_ORIGINS.includes(requestOrigin)) return requestOrigin;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(requestOrigin)) return requestOrigin;
  return ALLOWED_ORIGINS[0];
}

export function buildCorsHeaders(requestOrigin: string | null = null) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(requestOrigin),
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-api-version, prefer',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  } as const;
}

/** @deprecated Use buildCorsHeaders(req.headers.get('origin')) for per-request origin checks. */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-api-version, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
