import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { AUTH_COOKIE_OPTIONS, requireSupabaseEnv } from "./env";

export function createClient() {
  const { url, key } = requireSupabaseEnv();
  return createBrowserClient<Database>(url, key, { cookieOptions: AUTH_COOKIE_OPTIONS });
}
