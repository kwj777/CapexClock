"use client";

import { clearAllUnsaved } from "./unsaved";

/** Signing out also drops unsaved edits kept in this browser, so the next person can't see them. */
export default function SignOutButton({ className }: { className: string }) {
  function forget() {
    try {
      clearAllUnsaved(window.localStorage);
    } catch {
      // Storage blocked: nothing was kept.
    }
  }

  return (
    <form action="/auth/sign-out" method="post" onSubmit={forget}>
      <button type="submit" className={className}>
        Sign out
      </button>
    </form>
  );
}
