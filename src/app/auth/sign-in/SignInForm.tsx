"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { CONTACT_EMAIL } from "@/lib/site";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string; detail: string };

export default function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "sending" });
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback.toString(), shouldCreateUser: true },
    });
    if (error) {
      console.error("Sign-in link failed", error.status, error.code, error.message);
      setStatus({
        kind: "error",
        // Supabase's own reason, so a setup problem (email sender, URL settings) can be diagnosed.
        detail: [error.status, error.code, error.message].filter(Boolean).join(" · "),
        message:
          error.status === 429
            ? "Too many sign-in emails just now. Please wait a minute and try again."
            : `We couldn't send the link. Check the address, or email ${CONTACT_EMAIL}.`,
      });
      return;
    }
    setStatus({ kind: "sent", email: email.trim() });
  }

  if (status.kind === "sent") {
    return (
      <div className="rounded-2xl bg-emerald-50 p-6 text-emerald-900 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30">
        <p className="font-semibold">Check your email</p>
        <p className="mt-1 text-sm">
          We sent a sign-in link to {status.email}. Open it in this browser to continue.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400"
          placeholder="you@example.com"
        />
      </label>
      <button
        type="submit"
        disabled={status.kind === "sending"}
        className="w-full rounded-lg bg-amber-500 px-4 py-3 font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
      >
        {status.kind === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {status.kind === "error" && (
        <div role="alert" className="text-sm text-red-700 dark:text-red-400">
          <p>{status.message}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Details: {status.detail}</p>
        </div>
      )}
    </form>
  );
}
