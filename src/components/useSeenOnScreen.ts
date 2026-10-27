"use client";

import { useEffect } from "react";

/** Calls onSeen once at least half the element has been on screen. */
export function useSeenOnScreen(element: HTMLElement | null, onSeen: (() => void) | null) {
  useEffect(() => {
    if (!element || !onSeen || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        onSeen();
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, onSeen]);
}
