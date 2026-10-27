"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

/** Whether the browser holds a Supabase sign-in cookie (sb-<project>-auth-token, maybe split into .0, .1…). */
export function hasSignInCookie(cookie: string): boolean {
  return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=[^;]/.test(cookie);
}

const noSubscribe = () => () => {};

/**
 * The header's link to /app: "Sign in", or "My properties" once the page loads
 * in a browser that's signed in. Reading the cookie here keeps public pages static.
 */
export default function AccountLink({ className }: { className: string }) {
  const signedIn = useSyncExternalStore(noSubscribe, () => hasSignInCookie(document.cookie), () => false);
  return (
    // No prefetch: /app runs the auth proxy, which public pages shouldn't trigger.
    <Link href="/app" prefetch={false} className={className}>
      {signedIn ? "My properties" : "Sign in"}
    </Link>
  );
}
