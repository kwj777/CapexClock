"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { reportSignupAction } from "@/app/app/report-signup";
import { identifyUser, trackAccountCreated } from "@/lib/analytics";
import { CAME_FROM_KEY, parseCameFrom } from "@/lib/came-from";
import { COUNT_ME_KEY } from "@/lib/count-me";

const REPORTED_KEY = "capexclock:gosocially-reported:v1";

/** Once per browser and account, makes sure GoSocially has counted the account (report-signup.ts). */
function reportOnce(userId: string) {
  let cameFrom = null;
  let tester = false;
  try {
    if (window.localStorage.getItem(REPORTED_KEY) === userId) return;
    cameFrom = parseCameFrom(window.localStorage.getItem(CAME_FROM_KEY), Date.now());
    tester = window.localStorage.getItem(COUNT_ME_KEY) === "off";
  } catch {
    // Storage blocked: don't ask on every page.
    return;
  }
  reportSignupAction({ cameFrom, tester })
    .then((reported) => {
      if (reported) window.localStorage.setItem(REPORTED_KEY, reported);
    })
    .catch(() => {});
}

/**
 * Identifies the signed-in owner in analytics (by user id, never email) and
 * sends account_created after the first sign-in (the callback adds ?welcome=1
 * once per account). Also makes sure GoSocially counts the account.
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
    reportOnce(userId);
    void (async () => {
      await identifyUser(userId);
      if (welcome) await trackAccountCreated(userId);
    })();
  }, [welcome, userId]);
  return null;
}
