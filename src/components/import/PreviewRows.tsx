"use client";

import { memo, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { FixField, Preview, PreviewRow, RowStatus } from "@/lib/import/preview";
import { clip } from "@/lib/import/text";
import { detailsText, FIX_LABEL, rowNumbers, skippedLines, STATUS_TEXT } from "@/lib/import/wording";

const inputClass =
  "block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 tabular-nums placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400";
const headingClass = "text-sm font-semibold text-slate-950 dark:text-white";

const SECTIONS: { status: RowStatus; blurb: string; badge: string }[] = [
  {
    status: "needs_you",
    blurb: "Fix these here, or after adding them. The calculator points out anything still missing.",
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  {
    status: "changed",
    blurb: "We read these a little differently from the sheet. Check what changed.",
    badge: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-300",
  },
  {
    status: "ready",
    blurb: "Read just as the sheet has them.",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
];

/** Long lists show this many rows until the owner asks for the rest. */
const SHOWN_AT_FIRST = 50;

export interface PreviewRowsProps {
  preview: Preview;
  /** Rows whose item is already in the draft. */
  duplicateIds: ReadonlySet<string>;
  /** Where focus goes when the last row that needed fixing is fixed. */
  fallbackFocusId: string;
  onFix: (row: PreviewRow, values: Partial<Record<FixField, string>>) => void;
}

/** The preview's rows by status, Needs you first, then the skipped rows. */
function PreviewRows({ preview, duplicateIds, fallbackFocusId, onFix }: PreviewRowsProps) {
  const baseId = useId();
  const formId = (rowId: string) => `${baseId}-${rowId}-fix`;
  // After a fix, focus stays with the row if it still needs something, else moves to the next one.
  const pendingFocus = useRef<{ fixed: string; next: string | null } | null>(null);
  const needsYou = preview.rows.filter((r) => r.status === "needs_you");

  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    const stillNeeds = needsYou.some((r) => r.id === pending.fixed);
    const form = document.getElementById(formId(stillNeeds ? pending.fixed : (pending.next ?? "")));
    const target = form?.querySelector<HTMLElement>("input, button") ?? document.getElementById(fallbackFocusId);
    target?.focus();
  });

  function fix(row: PreviewRow, values: Partial<Record<FixField, string>>) {
    const at = needsYou.findIndex((r) => r.id === row.id);
    pendingFocus.current = { fixed: row.id, next: needsYou[at + 1]?.id ?? needsYou[at - 1]?.id ?? null };
    onFix(row, values);
  }

  const skipped = skippedLines(preview.skipped);
  return (
    <div className="space-y-6">
      {SECTIONS.map(({ status, blurb, badge }) => {
        const rows = preview.rows.filter((r) => r.status === status);
        if (rows.length === 0) return null;
        return (
          <RowSection key={status} title={STATUS_TEXT[status]} count={rows.length} blurb={blurb} badge={badge}>
            {(shown) =>
              rows.slice(0, shown).map((r) => (
                <Row key={r.id} row={r} duplicate={duplicateIds.has(r.id)} formId={formId(r.id)} onFix={fix} />
              ))
            }
          </RowSection>
        );
      })}
      {skipped.length > 0 && (
        <section aria-labelledby={`${baseId}-skipped`}>
          <h4 id={`${baseId}-skipped`} className={headingClass}>
            Skipped ({preview.counts.skipped.toLocaleString("en-US")})
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">These rows aren&apos;t added.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
            {skipped.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default memo(PreviewRows);

function RowSection({
  title,
  count,
  blurb,
  badge,
  children,
}: {
  title: string;
  count: number;
  blurb: string;
  badge: string;
  children: (shown: number) => ReactNode;
}) {
  const id = useId();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? count : SHOWN_AT_FIRST;
  return (
    <section aria-labelledby={id}>
      <h4 id={id} className={headingClass}>
        <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>{title}</span>
        {count.toLocaleString("en-US")} {count === 1 ? "row" : "rows"}
      </h4>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{blurb}</p>
      <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">{children(shown)}</ul>
      {count > SHOWN_AT_FIRST && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 text-sm font-medium text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400"
        >
          Show all {count.toLocaleString("en-US")} rows
        </button>
      )}
    </section>
  );
}

function Row({
  row,
  duplicate,
  formId,
  onFix,
}: {
  row: PreviewRow;
  duplicate: boolean;
  formId: string;
  onFix: (row: PreviewRow, values: Partial<Record<FixField, string>>) => void;
}) {
  const { name, notes } = row.row;
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="text-sm font-medium break-words text-slate-900 dark:text-white">
          {name || "No name yet"}
          {duplicate && (
            <>
              {" "}
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                Already in your list
              </span>
            </>
          )}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{rowNumbers(row.sheetRows)}</p>
      </div>
      <p className="mt-0.5 text-sm break-words text-slate-600 dark:text-slate-300">{detailsText(row.row, row.lifeIsTypical)}</p>
      {notes && (
        <p className="mt-0.5 text-xs whitespace-pre-line break-words text-slate-500 dark:text-slate-400">
          Notes: {clip(notes, 300)}
        </p>
      )}
      {row.changes.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs break-words text-slate-600 dark:text-slate-400">
          {row.changes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      {row.status === "needs_you" && <FixForm row={row} formId={formId} onFix={onFix} />}
    </li>
  );
}

/** What a row needs, with a box for each field the owner can fix here. */
function FixForm({
  row,
  formId,
  onFix,
}: {
  row: PreviewRow;
  formId: string;
  onFix: (row: PreviewRow, values: Partial<Record<FixField, string>>) => void;
}) {
  const [values, setValues] = useState<Partial<Record<FixField, string>>>({});
  // A name question is answered above; its words are shown here without a box.
  const asked = row.question ? row.issues.filter((i) => i.field === "name") : [];
  const fixable = row.issues.filter((i) => !asked.includes(i));
  const fields = [...new Set(fixable.map((i) => i.field))];

  function submit(event: FormEvent) {
    event.preventDefault();
    onFix(row, values);
  }

  return (
    <form
      id={formId}
      onSubmit={submit}
      className="mt-2 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30"
    >
      {asked.map((issue) => (
        <p key={issue.text} className="text-sm text-amber-900 dark:text-amber-200">
          {issue.text}
        </p>
      ))}
      {fields.map((field) => {
        const inputId = `${formId}-${field}`;
        const textId = `${inputId}-why`;
        return (
          <div key={field} className="mt-2 first:mt-0">
            <label htmlFor={inputId} className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {FIX_LABEL[field]}
            </label>
            <input
              id={inputId}
              className={`${inputClass} mt-1 sm:max-w-xs`}
              inputMode={field === "name" ? undefined : field === "costEach" || field === "quantity" ? "decimal" : "numeric"}
              value={values[field] ?? ""}
              aria-invalid="true"
              aria-describedby={textId}
              onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
            />
            <p id={textId} className="mt-1 text-sm text-amber-900 dark:text-amber-200">
              {fixable
                .filter((i) => i.field === field)
                .map((i) => i.text)
                .join(" ")}
            </p>
          </div>
        );
      })}
      {fields.length > 0 && (
        <button
          type="submit"
          className="mt-3 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:hover:bg-slate-800"
        >
          Apply
        </button>
      )}
    </form>
  );
}
