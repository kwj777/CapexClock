"use client";

import { useActionState } from "react";
import { unsubscribedText, type UnsubscribeKind } from "@/lib/owner-emails/kinds";
import { CONTACT_EMAIL } from "@/lib/site";
import { unsubscribeAction, type UnsubscribeState } from "./actions";

const button =
  "rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200";

export default function UnsubscribeForm({ token, kind }: { token: string; kind: UnsubscribeKind }) {
  const [state, action, pending] = useActionState<UnsubscribeState, FormData>(unsubscribeAction, "idle");

  if (state === "done") {
    return (
      <p role="status" className="mt-6 text-lg text-slate-700 dark:text-slate-200">
        Done. {unsubscribedText(kind)} You can turn emails back on any time in My properties.
      </p>
    );
  }

  return (
    <>
      <form action={action} className="mt-6 flex flex-wrap gap-3">
        <input type="hidden" name="t" value={token} />
        <input type="hidden" name="k" value={kind} />
        <button type="submit" className={button} disabled={pending}>
          {pending ? "Unsubscribing…" : "Unsubscribe"}
        </button>
      </form>
      {kind !== "all" && (
        <form action={action} className="mt-3">
          <input type="hidden" name="t" value={token} />
          <input type="hidden" name="k" value="all" />
          <button
            type="submit"
            disabled={pending}
            className="text-sm text-slate-600 underline underline-offset-2 hover:text-slate-900 dark:text-slate-300"
          >
            Turn off all three emails instead
          </button>
        </form>
      )}
      {state === "not_found" && (
        <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">
          This link doesn&apos;t match an account any more. Turn emails off in My properties, or email {CONTACT_EMAIL}.
        </p>
      )}
      {state === "error" && (
        <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">
          That didn&apos;t go through. Please try again, or email {CONTACT_EMAIL} and we&apos;ll turn it off.
        </p>
      )}
    </>
  );
}
