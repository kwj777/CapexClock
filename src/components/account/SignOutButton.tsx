"use client";

import type { FormEvent } from "react";
import { resetAnalytics } from "@/lib/analytics";
import { clearAllUnsaved } from "./unsaved";

/**
 * A plain sign-out form (it still works before JavaScript loads). First it drops
 * unsaved edits kept in this browser and clears the analytics identity, so the next
 * person on this browser can't see those edits or be counted as the same owner.
 */
export default function SignOutButton({ className }: { className: string }) {
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      clearAllUnsaved(window.localStorage);
    } catch {
      // Storage blocked: nothing was kept.
    }
    // Don't let a slow or blocked analytics script hold up signing out.
    await Promise.race([resetAnalytics(), new Promise((resolve) => setTimeout(resolve, 1500))]);
    form.submit();
  }

  return (
    <form action="/auth/sign-out" method="post" onSubmit={onSubmit}>
      <button type="submit" className={className}>
        Sign out
      </button>
    </form>
  );
}
