"use client";

import type { FormEvent } from "react";
import { resetAnalytics } from "@/lib/analytics";

/**
 * A plain sign-out form (it still works before JavaScript loads) that first
 * clears the analytics identity, so the next person on this browser isn't
 * counted as the same owner.
 */
export default function SignOutButton({ className }: { className: string }) {
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
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
