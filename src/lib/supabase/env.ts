/**
 * Public Supabase settings. Both values are safe to expose to the browser: the
 * publishable (or legacy anon) key only grants what Row Level Security allows.
 * No service-role key is used anywhere in this app.
 */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function requireSupabaseEnv(): { url: string; key: string } {
  const env = supabaseEnv();
  if (!env) throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).');
  return env;
}
