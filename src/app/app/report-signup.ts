"use server";

import { CAME_FROM_FIELDS, cleanTag, type CameFromField } from "@/lib/came-from";
import { reportSignup } from "@/lib/gosocially";
import { createClient } from "@/lib/supabase/server";

/**
 * Makes sure GoSocially has counted the signed-in account (src/lib/gosocially.ts).
 * TrackWelcome calls it once per browser, so a new account is counted after its
 * first sign-in, with the link tags this browser remembered, and accounts made
 * before this existed are counted too, on the day they first signed in. Sending
 * the same account again is safe: GoSocially counts it once.
 *
 * Returns the account id once GoSocially has it, so the browser stops asking.
 */
export async function reportSignupAction(input: { cameFrom?: Record<string, unknown> | null; tester?: boolean }): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const cameFrom: Partial<Record<CameFromField, string>> = {};
  for (const field of CAME_FROM_FIELDS) {
    const value = cleanTag(input?.cameFrom?.[field]);
    if (value) cameFrom[field] = value;
  }
  const sent = await reportSignup({
    userId: user.id,
    firstSignInAt: user.email_confirmed_at || user.created_at,
    cameFrom,
    tester: input?.tester === true,
  });
  return sent ? user.id : null;
}
