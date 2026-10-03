"use client";

import { useSyncExternalStore } from "react";
import { COUNT_ME_EVENT, isNotCounted } from "@/lib/count-me";

function subscribe(onChange: () => void) {
  window.addEventListener(COUNT_ME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COUNT_ME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** A quiet footer line, only in a browser marked with ?count-me=off. */
export default function CountMeNote() {
  const off = useSyncExternalStore(subscribe, () => isNotCounted(() => window.localStorage), () => false);
  if (!off) return null;
  return <p className="w-full text-xs">Analytics off in this browser (?count-me=on turns it back on).</p>;
}
