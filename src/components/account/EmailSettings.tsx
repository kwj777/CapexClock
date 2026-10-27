"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { track } from "@/lib/analytics";
import { EMAIL_KIND_TEXT, EMAIL_KINDS, type EmailKind } from "@/lib/owner-emails/kinds";
import type { EmailSettingsView } from "@/lib/owner-emails/load";
import { CONTACT_EMAIL } from "@/lib/site";
import { createClient } from "@/lib/supabase/client";
import type { EmailSwitches } from "@/lib/supabase/database.types";
import { isSignedOut } from "./read-back";

const card = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900";
const link = "text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400";

/** Email settings in My properties: three switches for founding members. */
export default function EmailSettings({ view }: { view: EmailSettingsView }) {
  const headingId = useId();
  return (
    // The emails' "change your email settings" link points at this id.
    <section id="email-settings" aria-labelledby={headingId} className={`${card} mt-10`}>
      <h2 id={headingId} className="text-lg font-semibold text-slate-950 dark:text-white">
        Email settings
      </h2>
      {view.state === "member" && <Switches initial={view.switches} />}
      {view.state === "not_member" && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Replacement reminders, a yearly budget summary and a yearly condition report, made from the properties you
          save here, come with the{" "}
          <Link href="/pricing" className={link}>
            founding membership
          </Link>
          .
        </p>
      )}
      {view.state === "unavailable" && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Email settings aren&apos;t available right now. To change them, email {CONTACT_EMAIL}.
        </p>
      )}
    </section>
  );
}

function Switches({ initial }: { initial: EmailSwitches }) {
  const [switches, setSwitches] = useState(initial);
  const [saving, setSaving] = useState<EmailKind | null>(null);
  const [failed, setFailed] = useState<"error" | "signed_out" | null>(null);
  const [saved, setSaved] = useState(false);

  async function change(kind: EmailKind, on: boolean) {
    // Clicks while a save runs are ignored rather than disabling the switches,
    // which would drop keyboard focus to the top of the page.
    if (saving !== null) return;
    setSaved(false);
    const before = switches;
    const next = { ...switches, [kind]: on };
    setSwitches(next);
    setSaving(kind);
    setFailed(null);
    // All three go every time, so the first save makes the row with the right values.
    const { error } = await createClient().from("email_settings").upsert(next, { onConflict: "user_id" });
    if (error) {
      // Retrying can't help once the session has gone, so say so (as the property editor does).
      const out = await isSignedOut();
      setSaving(null);
      setSwitches(before);
      setFailed(out ? "signed_out" : "error");
      return;
    }
    setSaving(null);
    void track("email_setting_changed", { kind, on });
    setSaved(true);
  }

  return (
    <>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        Sent to the email you sign in with, made from the properties you save here.
      </p>
      <ul className="mt-4 space-y-4">
        {EMAIL_KINDS.map((kind) => (
          <li key={kind}>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-amber-600"
                checked={switches[kind]}
                onChange={(e) => void change(kind, e.target.checked)}
              />
              <span>
                <span className="block font-medium text-slate-950 dark:text-white">{EMAIL_KIND_TEXT[kind].label}</span>
                <span className="block text-sm text-slate-600 dark:text-slate-400">{EMAIL_KIND_TEXT[kind].when}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p role="status" className="mt-3 text-sm text-slate-600 empty:hidden dark:text-slate-400">
        {saved ? "Saved." : ""}
      </p>
      {failed === "error" && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          That change didn&apos;t save. Please try again.
        </p>
      )}
      {failed === "signed_out" && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          You&apos;ve been signed out, so this wasn&apos;t changed.{" "}
          <Link href="/auth/sign-in?next=%2Fapp" className="font-semibold underline underline-offset-2">
            Sign in again
          </Link>
        </p>
      )}
    </>
  );
}
