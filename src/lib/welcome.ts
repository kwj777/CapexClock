/** Set in the user's metadata on the first successful sign-in, so account_created is counted once. */
export const WELCOMED_KEY = "welcomed_at";

// Accounts first confirmed longer ago than this without the flag were made
// before it existed and were already counted then.
const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type SignedInUser = {
  created_at: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/**
 * True the first time a new account signs in successfully, whichever link,
 * browser or device that happens on.
 */
export function isFirstSignIn(user: SignedInUser, now = Date.now()): boolean {
  if (user.user_metadata?.[WELCOMED_KEY]) return false;
  // Supabase makes the account when the first link is requested, which can be
  // long before one is opened. The email is confirmed by the first link that
  // works, so measure from then.
  const firstSignIn = Date.parse(user.email_confirmed_at || user.created_at);
  return Number.isFinite(firstSignIn) && now - firstSignIn < NEW_ACCOUNT_WINDOW_MS;
}
