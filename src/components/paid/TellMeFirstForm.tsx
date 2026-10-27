"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { track } from "@/lib/analytics";
import {
  FORMS_ACTION,
  PAID_INTEREST_FORM,
  paidIdeaEvent,
  paidInterestBody,
  UNIT_OPTIONS,
  validatePaidInterest,
  type PaidIdea,
  type PaidWhere,
} from "@/lib/paid-ideas";
import { CONTACT_EMAIL } from "@/lib/site";

const fieldClass =
  "mt-1 block w-full rounded-md border border-slate-500 bg-white px-2.5 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 aria-[invalid=true]:border-red-600 dark:border-slate-500 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400 dark:aria-[invalid=true]:border-red-400";
const labelClass = "text-xs font-medium text-slate-700 dark:text-slate-300";
const errorClass = "mt-1 text-xs text-red-700 dark:text-red-400";

/**
 * The "tell me first" list for one paid idea. Posts to the Netlify form
 * "paid-interest" like the early-access form does: with fetch, or as a normal
 * form post if the script hasn't taken over.
 */
export default function TellMeFirstForm({
  idea,
  where,
  defaultEmail,
  stacked = false,
  onSignedUp,
}: {
  idea: PaidIdea;
  where: PaidWhere;
  /** The signed-in owner's email; it can arrive after the form opens. */
  defaultEmail: string;
  /** One field under the other at every width, for a narrow column. */
  stacked?: boolean;
  onSignedUp: () => void;
}) {
  const id = useId();
  // Null until the owner types, so an email found after opening still fills the box.
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const email = typedEmail ?? defaultEmail;
  const [units, setUnits] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const emailRef = useRef<HTMLInputElement>(null);
  const unitsRef = useRef<HTMLSelectElement>(null);

  // Once a send was tried, the messages follow each fix as it's made.
  const errors = showErrors ? validatePaidInterest({ email, units }) : {};
  const emailErrorId = `${id}-email-error`;
  const unitsErrorId = `${id}-units-error`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    const found = validatePaidInterest({ email, units });
    if (found.email || found.units) {
      setShowErrors(true);
      (found.email ? emailRef : unitsRef).current?.focus();
      return;
    }
    setStatus("submitting");
    const botField = new FormData(event.currentTarget).get("bot-field");
    const body = paidInterestBody({
      email,
      units,
      idea,
      where,
      botField: typeof botField === "string" ? botField : "",
    });
    try {
      const res = await fetch(FORMS_ACTION, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!res.ok) throw new Error(`Form submission failed: ${res.status}`);
      void track("paid_idea_signup", paidIdeaEvent(idea, where));
      onSignedUp();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form
      name={PAID_INTEREST_FORM}
      method="POST"
      action={FORMS_ACTION}
      data-netlify="true"
      netlify-honeypot="bot-field"
      // Not a page change, so the property editor doesn't ask about unsaved edits.
      data-keeps-edits
      noValidate
      onSubmit={onSubmit}
      className="mt-4 space-y-4"
    >
      <input type="hidden" name="form-name" value={PAID_INTEREST_FORM} />
      <input type="hidden" name="idea" value={idea} />
      <input type="hidden" name="where" value={where} />
      <p className="hidden" aria-hidden="true">
        <label>
          Don&apos;t fill this out: <input name="bot-field" tabIndex={-1} autoComplete="off" />
        </label>
      </p>

      <div className={stacked ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
        <div>
          <label htmlFor={`${id}-email`} className={labelClass}>
            Email
          </label>
          <input
            ref={emailRef}
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setTypedEmail(e.target.value)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? emailErrorId : undefined}
            className={fieldClass}
          />
          {errors.email && (
            <p id={emailErrorId} className={errorClass}>
              {errors.email}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${id}-units`} className={labelClass}>
            How many units do you own?
          </label>
          <select
            ref={unitsRef}
            id={`${id}-units`}
            name="units"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            aria-invalid={errors.units ? true : undefined}
            aria-describedby={errors.units ? unitsErrorId : undefined}
            className={fieldClass}
          >
            <option value="" disabled>
              Select…
            </option>
            {UNIT_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          {errors.units && (
            <p id={unitsErrorId} className={errorClass}>
              {errors.units}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="submit"
          // aria-disabled rather than disabled while sending, so keyboard focus stays here.
          aria-disabled={status === "submitting"}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 aria-disabled:cursor-wait aria-disabled:opacity-70"
        >
          {status === "submitting" ? "Sending…" : "Tell me first"}
        </button>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          We&apos;ll only email you about this {where === "pricing" ? "offer" : "idea"}. See our{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
            privacy page
          </Link>
          .
        </p>
      </div>

      {status === "error" && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          Something went wrong. Please try again, or email us at {CONTACT_EMAIL}.
        </p>
      )}
    </form>
  );
}
