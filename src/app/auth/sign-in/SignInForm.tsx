"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CAPTCHA_FAILED_TEXT,
  CAPTCHA_WAIT_TEXT,
  captchaReducer,
  initialCaptcha,
  sendErrorMessage,
  sendPlan,
  TURNSTILE_SCRIPT_URL,
  turnstileSiteKey,
  widgetSize,
  type SendError,
} from "@/lib/turnstile";

// Baked in at build time. Unset means no CAPTCHA, and the form works as before.
const SITE_KEY = turnstileSiteKey(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

// If the script hasn't loaded by then, say so instead of waiting forever.
const SCRIPT_TIMEOUT_MS = 20_000;

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; email: string }
  | { kind: "error"; message: string; detail: string };

export default function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const sentRef = useRef<HTMLDivElement>(null);
  const [captcha, dispatch] = useReducer(captchaReducer, SITE_KEY, initialCaptcha);
  const [scriptReady, setScriptReady] = useState(false);
  // In state, not a ref, so the widget is drawn whenever the box appears.
  const [captchaBox, setCaptchaBox] = useState<HTMLDivElement | null>(null);
  const widgetId = useRef<string | null>(null);
  // Sign-in was pressed before the check finished.
  const [waitShown, setWaitShown] = useState(false);

  useEffect(() => {
    if (!SITE_KEY || scriptReady) return;
    const timer = window.setTimeout(() => dispatch({ type: "failed" }), SCRIPT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [scriptReady]);

  // Draws the widget once the script is ready and the form is on the page, and
  // removes it when the form goes (after the link is sent).
  useEffect(() => {
    if (!SITE_KEY || !scriptReady || !captchaBox) return;
    const turnstile = window.turnstile;
    if (!turnstile) {
      dispatch({ type: "failed" });
      return;
    }
    dispatch({ type: "cleared" });
    let id: string | null = null;
    try {
      id =
        turnstile.render(captchaBox, {
          sitekey: SITE_KEY,
          action: "sign-in",
          theme: "auto",
          size: widgetSize(captchaBox.clientWidth),
          callback: (token) => {
            dispatch({ type: "token", token });
            setWaitShown(false);
          },
          "expired-callback": () => dispatch({ type: "cleared" }),
          "timeout-callback": () => dispatch({ type: "cleared" }),
          "error-callback": () => {
            dispatch({ type: "failed" });
            // Handled: Turnstile keeps retrying on its own.
            return true;
          },
        }) ?? null;
    } catch {
      dispatch({ type: "failed" });
      return;
    }
    widgetId.current = id;
    return () => {
      widgetId.current = null;
      if (id) turnstile.remove(id);
    };
  }, [scriptReady, captchaBox]);

  /** Tokens are single-use, so the widget starts over after every attempt. */
  function resetCaptcha() {
    if (!SITE_KEY) return;
    dispatch({ type: "cleared" });
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }

  // The form goes away once the link is sent, so move focus to the message
  // instead of letting it drop to the top of the page.
  useEffect(() => {
    if (status.kind === "sent") sentRef.current?.focus();
  }, [status.kind]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === "sending") return;
    const plan = sendPlan(captcha);
    if (!plan.send) {
      setWaitShown(true);
      return;
    }
    setWaitShown(false);
    setStatus({ kind: "sending" });
    const callback = new URL("/auth/callback", window.location.origin);
    // A link like /app#email-settings reaches this page with its #part still on, but
    // the server never sees it: put it back so the magic link lands in the same place.
    const hash = window.location.hash;
    callback.searchParams.set("next", hash && !next.includes("#") ? `${next}${hash}` : next);
    let error: SendError | null;
    try {
      ({ error } = await createClient().auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: callback.toString(),
          shouldCreateUser: true,
          ...(plan.token ? { captchaToken: plan.token } : {}),
        },
      }));
    } catch (thrown) {
      // A setup or network failure that Supabase threw instead of returning.
      error = { message: thrown instanceof Error ? thrown.message : String(thrown) };
    }
    resetCaptcha();
    if (error) {
      console.error("Sign-in link failed", error.status, error.code, error.message);
      setStatus({
        kind: "error",
        // Supabase's own reason, so a setup problem (email sender, URL settings) can be diagnosed.
        detail: [error.status, error.code, error.message].filter(Boolean).join(" · "),
        message: sendErrorMessage(error),
      });
      return;
    }
    setStatus({ kind: "sent", email: email.trim() });
  }

  return (
    <>
      {/* Loaded on this page only, and only when CAPTCHA is on. */}
      {SITE_KEY && (
        <Script
          src={TURNSTILE_SCRIPT_URL}
          strategy="afterInteractive"
          onReady={() => setScriptReady(true)}
          onError={() => dispatch({ type: "failed" })}
        />
      )}
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
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400"
              placeholder="you@example.com"
            />
          </label>
          {SITE_KEY && (
            <div>
              {/* Holds the widget's height while it loads, so the button doesn't jump. */}
              <div ref={setCaptchaBox} className={captcha.kind === "failed" ? undefined : "min-h-[65px]"} />
              {captcha.kind === "failed" && (
                <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
                  {CAPTCHA_FAILED_TEXT}
                </p>
              )}
              {waitShown && captcha.kind !== "failed" && (
                <p role="alert" className="mt-2 text-sm text-amber-800 dark:text-amber-300">
                  {CAPTCHA_WAIT_TEXT}
                </p>
              )}
            </div>
          )}
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
