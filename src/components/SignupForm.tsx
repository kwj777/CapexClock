"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { track } from "@/lib/analytics";
import { CONTACT_EMAIL } from "@/lib/site";

// Field names and options must match public/__forms.html, which is the copy
// Netlify registers at deploy time. Posting to that file (with form-name) is
// what reaches Netlify Forms, with or without JavaScript.
const FORM_NAME = "early-access";
const FORM_ACTION = "/__forms.html";

const UNIT_OPTIONS = ["1–4", "5–20", "21–50", "51–100", "100+"] as const;
const METHOD_OPTIONS = [
  "Spreadsheet",
  "Property management software",
  "Nothing formal",
  "Other",
] as const;

type Status = "idle" | "submitting" | "success" | "error";

const fieldClass =
  "mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 shadow-sm placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400";

export default function SignupForm() {
  const [status, setStatus] = useState<Status>("idle");
  const successRef = useRef<HTMLDivElement>(null);

  // The form goes away on success, so move focus to the message instead of
  // letting it drop to the top of the page.
  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");

    // Includes the hidden form-name field.
    const body = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string") body.append(key, value);
    }

    try {
      const res = await fetch(FORM_ACTION, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.ok) throw new Error(`Form submission failed: ${res.status}`);
      setStatus("success");
      void track("early_access_signup", {
        units: body.get("units") ?? "",
        current_method: body.get("current_method") ?? "",
      });
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      {/* Always in the page, so screen readers announce the message when it appears. */}
      <div role="status">
        {status === "success" && (
          <div
            ref={successRef}
            tabIndex={-1}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center focus:outline-none dark:border-emerald-900 dark:bg-emerald-950"
          >
            <p className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">
              You&apos;re on the list.
            </p>
            <p className="mt-2 text-emerald-800 dark:text-emerald-200">
              We&apos;ll email you when reminders and condition reports are ready.
            </p>
            {/* Everything else is usable today, so give them somewhere to go. */}
            <div className="mt-6 flex flex-col items-center gap-3">
              <Link
                href="/app"
                prefetch={false}
                className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-5 py-2.5 text-base font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-emerald-950"
              >
                Save your property with a free account
              </Link>
              <Link
                href="/capex-calculator"
                className="text-sm font-medium text-emerald-900 underline underline-offset-2 hover:text-emerald-950 dark:text-emerald-100 dark:hover:text-white"
              >
                Run the free calculator
              </Link>
            </div>
          </div>
        )}
      </div>
      {status !== "success" && <EarlyAccessForm status={status} onSubmit={handleSubmit} />}
    </>
  );
}

function EarlyAccessForm({
  status,
  onSubmit,
}: {
  status: Status;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      name={FORM_NAME}
      method="POST"
      action={FORM_ACTION}
      data-netlify="true"
      netlify-honeypot="bot-field"
      onSubmit={onSubmit}
      className="space-y-5"
    >
      <input type="hidden" name="form-name" value={FORM_NAME} />
      <p className="hidden" aria-hidden="true">
        <label>
          Don&apos;t fill this out: <input name="bot-field" tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      <div>
        <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={fieldClass}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="units" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            How many units do you own?
          </label>
          <select id="units" name="units" defaultValue="" className={fieldClass}>
            <option value="" disabled>
              Select…
            </option>
            {UNIT_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="current_method" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            How do you plan for big replacements today?
          </label>
          <select
            id="current_method"
            name="current_method"
            defaultValue=""
            className={fieldClass}
          >
            <option value="" disabled>
              Select…
            </option>
            {METHOD_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="biggest_worry" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          What replacement worries you most right now?{" "}
          <span className="font-normal text-slate-500 dark:text-slate-400">(optional)</span>
        </label>
        <input
          id="biggest_worry"
          name="biggest_worry"
          type="text"
          maxLength={200}
          placeholder="e.g. the roof on our 12-unit"
          className={fieldClass}
        />
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-lg bg-amber-500 px-6 py-3 text-base font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 disabled:cursor-wait disabled:opacity-70"
      >
        {status === "submitting" ? "Signing you up…" : "Get early access"}
      </button>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        See how we handle your answers on our{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
          privacy page
        </Link>
        .
      </p>

      {status === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          Something went wrong. Please try again, or email us at{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      )}
    </form>
  );
}
