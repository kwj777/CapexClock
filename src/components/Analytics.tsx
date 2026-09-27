"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

export default function Analytics() {
  useEffect(() => {
    const start = () => void initAnalytics();
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 2000);
    return () => clearTimeout(id);
  }, []);
  return null;
}
