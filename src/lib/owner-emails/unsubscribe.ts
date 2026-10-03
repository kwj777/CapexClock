import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { supabaseEnv } from "@/lib/supabase/env";
import type { UnsubscribeKind } from "./kinds";

export type UnsubscribeResult = "done" | "not_found" | "error";

/** The one call an unsubscribe makes, so tests can stand in for Supabase. */
export type UnsubscribeRpc = (args: {
  p_token: string;
  p_kind: string;
}) => PromiseLike<{ data: boolean | null; error: unknown }>;

/**
 * Turns off one email (or all three) for the account the link's token belongs to.
 * No sign-in is needed: email_unsubscribe (0006) finds the account by its token.
 */
export async function unsubscribe(
  token: string,
  kind: UnsubscribeKind,
  rpc: UnsubscribeRpc | null = defaultRpc(),
): Promise<UnsubscribeResult> {
  if (!rpc) return "error";
  try {
    const { data, error } = await rpc({ p_token: token, p_kind: kind });
    if (error) return "error";
    return data ? "done" : "not_found";
  } catch {
    return "error";
  }
}

function defaultRpc(): UnsubscribeRpc | null {
  const env = supabaseEnv();
  if (!env) return null;
  // No cookies: the link works the same signed in or not, in any browser.
  const client = createSupabaseClient<Database>(env.url, env.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return (args) => client.rpc("email_unsubscribe", args);
}
