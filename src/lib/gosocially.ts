import type { CameFromField } from "./came-from";

/**
 * Tells GoSocially (the marketing tool at gosocially.netlify.app) about each
 * new CapexClock account, so its Reports page counts CapexClock signups by
 * week and by where they came from. Called from src/app/app/report-signup.ts.
 *
 * Setting (Netlify environment variable, server-only): GOSOCIALLY_SIGNUP_KEY,
 * CapexClock's signup key from GoSocially (Apps > CapexClock brief >
 * Signups). Without it nothing is sent.
 *
 * Only the account's random id, when it was made and the link tags are sent,
 * never an email address. A browser marked ?count-me=off (Kevin's own, see
 * count-me.ts) sends its account as a test, which GoSocially doesn't count.
 */

export const SIGNUP_URL = "https://gosocially.netlify.app/.netlify/functions/signup";

/** Accounts first signed in longer ago than this get no link tags: today's visit didn't bring them. */
export const SOURCE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type AccountSignup = {
  userId: string;
  /** When the account first signed in (email confirmed), else when it was made. */
  firstSignInAt: string;
  cameFrom?: Partial<Record<CameFromField, string>>;
  tester?: boolean;
};

/** What's sent to GoSocially for one account. */
export function signupBody(signup: AccountSignup, now = Date.now()): Record<string, unknown> {
  if (signup.tester) return { id: signup.userId, tester: true };
  const at = Date.parse(signup.firstSignInAt);
  const recent = Number.isFinite(at) && now - at < SOURCE_WINDOW_MS;
  return {
    id: signup.userId,
    ...(Number.isFinite(at) ? { occurred_at: new Date(at).toISOString() } : {}),
    ...(recent ? (signup.cameFrom ?? {}) : {}),
  };
}

/** Sends one account. Never throws; false when nothing reached GoSocially. */
export async function reportSignup(signup: AccountSignup, key = process.env.GOSOCIALLY_SIGNUP_KEY?.trim()): Promise<boolean> {
  if (!key) return false;
  try {
    const response = await fetch(SIGNUP_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify(signupBody(signup)),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) console.error(`[gosocially] Couldn't report a new account: HTTP ${response.status}`);
    return response.ok;
  } catch (problem) {
    console.error(`[gosocially] Couldn't report a new account: ${problem instanceof Error ? problem.name : "error"}`);
    return false;
  }
}
