/** Set in the user's metadata on the first successful sign-in, so account_created is counted once. */
export const WELCOMED_KEY = "welcomed_at";

// Accounts older than this without the flag were made before it existed and
// were already counted then.
const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type SignedInUser = { created_at: string; user_metadata?: Record<string, unknown> | null };

/**
 * True the first time a new account signs in successfully, whichever link,
 * browser or device that happens on.
 */
export function isFirstSignIn(user: SignedInUser, now = Date.now()): boolean {
  if (user.user_metadata?.[WELCOMED_KEY]) return false;
  const created = Date.parse(user.created_at);
  return Number.isFinite(created) && now - created < NEW_ACCOUNT_WINDOW_MS;
}
