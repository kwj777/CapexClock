"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/analytics";

/** Sends account_created once after the first magic-link sign-in (the callback adds ?welcome=1). */
export default function TrackWelcome() {
  const welcome = useSearchParams().get("welcome") === "1";
  useEffect(() => {
    if (welcome) void track("account_created", {});
  }, [welcome]);
  return null;
}
