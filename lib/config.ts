/** SOMMA runs as a 100% local-first PWA — no Supabase, auth, or Edge in production. */
export const LOCAL_FIRST_MODE = true;

/** Always false in local-first mode; legacy call sites gate cloud paths. */
export const isSupabaseConfigured = false;

export const supabaseUrl = '';
export const supabaseAnonKey = '';
