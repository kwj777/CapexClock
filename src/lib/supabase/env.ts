/**
 * Options for the Supabase auth cookies (they hold the refresh token). Secure in
 * production so they're never sent over plain HTTP; `next dev` on http stays usable.
 */
export const AUTH_COOKIE_OPTIONS = { secure: process.env.NODE_ENV === "production" };

/** Supabase settings from the environment. Null when accounts aren't configured. */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

export function requireSupabaseEnv(): { url: string; key: string } {
  const env = supabaseEnv();
  if (!env) {
    throw new Error(
      "Supabase isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return env;
}
