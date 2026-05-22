/** Supabase is optional until EXPO_PUBLIC_* keys are set in `.env` */
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  '';

export const isSupabaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_SUPABASE_URL?.length && supabaseAnonKey.length,
);

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export { supabaseAnonKey };
