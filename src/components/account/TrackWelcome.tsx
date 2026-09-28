"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { identifyUser, trackAccountCreated } from "@/lib/analytics";

/**
 * Identifies the signed-in owner in analytics (by user id, never email) and
 * sends account_created after the first sign-in (the callback adds ?welcome=1
 * once per account).
 */
export default function TrackWelcome({ userId }: { userId: string | null }) {
  const welcome = useSearchParams().get("welcome") === "1";
  useEffect(() => {
    if (welcome) {
      // Drop the flag so a reload or Back doesn't count the account again.
      const url = new URL(window.location.href);
      url.searchParams.delete("welcome");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    if (!userId) return;
    void (async () => {
      await identifyUser(userId);
      if (welcome) await trackAccountCreated(userId);
    })();
  }, [welcome, userId]);
  return null;
}
