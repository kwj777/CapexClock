"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { CONTACT_EMAIL } from "@/lib/site";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string; detail: string };

type SendError = { status?: number; code?: string; message: string };

export default function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const sentRef = useRef<HTMLDivElement>(null);

  // The form goes away once the link is sent, so move focus to the message
  // instead of letting it drop to the top of the page.
  useEffect(() => {
    if (status.kind === "sent") sentRef.current?.focus();
  }, [status.kind]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "sending" });
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    let error: SendError | null;
    try {
      ({ error } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callback.toString(), shouldCreateUser: true },
      }));
    } catch (thrown) {
      // A setup or network failure that Supabase threw instead of returning.
      error = { message: thrown instanceof Error ? thrown.message : String(thrown) };
    }
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

  return (
    <>
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <div role="status">
        {status.kind === "sent" && (
          <div
            ref={sentRef}
            tabIndex={-1}
            className="rounded-2xl bg-emerald-50 p-6 text-emerald-900 ring-1 ring-emerald-200 focus:outline-none dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30"
          >
            <p className="font-semibold">Check your email</p>
            <p className="mt-1 text-sm">
              We sent a sign-in link to {status.email}. Open it in this browser to continue.
            </p>
          </div>
        )}
      </div>
      {status.kind !== "sent" && (
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
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
          <p className="text-sm text-slate-500 dark:text-slate-400">
            See how we handle your email on our{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
              privacy page
            </Link>
            .
          </p>
          {status.kind === "error" && (
            <div role="alert" className="text-sm text-red-700 dark:text-red-400">
              <p>{status.message}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Details: {status.detail}</p>
            </div>
          )}
        </form>
      )}
    </>
  );
}
