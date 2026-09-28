"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalculatorView } from "@/components/calculator/Calculator";
import { EMPTY_DRAFT, loadDraft, saveDraft, type Draft } from "@/components/calculator/draft";
import { track } from "@/lib/analytics";
import type { LibraryComponent } from "@/lib/library/components";
import { SAVE_PROBLEM_TEXT, toSaveInput } from "@/lib/properties/convert";
import { fetchAllRows } from "@/lib/properties/load";
import {
  FUNCTION_NOT_FOUND,
  matchesSaved,
  SAVE_FAILURE_TEXT,
  saveFailure,
  withSavedIds,
  type SaveFailure,
} from "@/lib/properties/save";
import { createClient } from "@/lib/supabase/client";
import type { ComponentRow, PropertyRow } from "@/lib/supabase/database.types";
import { clearUnsaved, keepUnsaved, loadUnsaved, unsavedKey } from "./unsaved";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving"; creating: boolean }
  | { kind: "saved" }
  // A new property was saved and its own page is loading.
  | { kind: "opening" }
  | { kind: "failed"; failure: SaveFailure }
  | { kind: "delete_failed"; signedOut: boolean };

// These stay on screen while the owner keeps editing, until they act on them.
const STICKY: SaveFailure[] = ["signed_out", "conflict", "deleted"];

// Set once the database turns out not to have migration 0002's version check.
let versionCheckMissing = false;

export interface PropertyEditorProps {
  propertyId?: string;
  initialName: string;
  /** The property's updated_at when the page loaded, so a save can tell if it changed since. */
  initialUpdatedAt?: string;
  initialDraft: Draft;
  /** New property started from the public calculator's work in this browser. */
  importFromCalculator?: boolean;
  library: LibraryComponent[];
}

/** Reads a property back after saving it; null if that fails. */
async function readBack(id: string): Promise<{ property: PropertyRow; components: ComponentRow[] } | null> {
  const supabase = createClient();
  try {
    const [{ data: property, error }, components] = await Promise.all([
      supabase.from("properties").select("*").eq("id", id).maybeSingle(),
      fetchAllRows((from, to) =>
        supabase
          .from("components")
          .select("*", { count: "exact" })
          .eq("property_id", id)
          .order("sort_order")
          .order("id")
          .range(from, to),
      ),
    ]);
    return property && !error ? { property, components } : null;
  } catch {
    return null;
  }
}

/** True only when the browser has definitely lost its session (not when it's offline). */
async function isSignedOut(): Promise<boolean> {
  const { data, error } = await createClient().auth.getSession();
  return !error && !data.session;
}

export default function PropertyEditor({
  propertyId,
  initialName,
  initialUpdatedAt,
  initialDraft,
  importFromCalculator = false,
  library,
}: PropertyEditorProps) {
  const router = useRouter();
  const backupKey = unsavedKey(propertyId);
  // Rendered client-only (see PropertyEditorLoader), so localStorage is safe here.
  const [restored, setRestored] = useState(() => loadUnsaved(backupKey));
  const startingDraft = () => (importFromCalculator ? loadDraft() : initialDraft);
  const [name, setName] = useState(() => restored?.name ?? initialName);
  const [draft, setDraft] = useState<Draft>(() => restored?.draft ?? startingDraft());
  // The copy in the database. Restored edits keep the version they started from, so
  // saving them over a newer copy is caught.
  const [saved, setSaved] = useState(() => ({
    name: initialName,
    draft: initialDraft,
    updatedAt: restored ? restored.baseUpdatedAt : (initialUpdatedAt ?? null),
  }));
  const [savedId, setSavedId] = useState(propertyId);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [showProblems, setShowProblems] = useState(false);
  const [currentYear] = useState(() => new Date().getFullYear());
  const busy = useRef(false);
  const leaving = useRef(false);

  const dirty = name !== saved.name || draft !== saved.draft;
  const signedOut =
    (save.kind === "failed" && save.failure === "signed_out") || (save.kind === "delete_failed" && save.signedOut);

  // After a blocked save, problems update as the owner fixes them, next to each row.
  const problems = useMemo(
    () => (showProblems ? toSaveInput(name, draft, currentYear, savedId).problems : {}),
    [showProblems, name, draft, currentYear, savedId],
  );
  const problemTexts = [...new Set(Object.values(problems).map((p) => SAVE_PROBLEM_TEXT[p]))];
  const rowNotes = Object.fromEntries(
    Object.entries(problems)
      .filter(([id]) => id !== "property")
      .map(([id, p]) => [id, SAVE_PROBLEM_TEXT[p]]),
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!leaving.current) event.preventDefault();
    };
    // Links inside the app change pages without unloading this one, so ask here too.
    const confirmLeave = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.hasAttribute("download") || link.hasAttribute("data-keeps-edits")) return;
      if (link.target && link.target !== "_self") return;
      const to = new URL(link.href);
      const here = window.location;
      if (to.origin !== here.origin || (to.pathname === here.pathname && to.search === here.search)) return;
      if (window.confirm("You have unsaved changes. Leave without saving them?")) {
        clearUnsaved(backupKey);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", confirmLeave, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", confirmLeave, true);
    };
  }, [dirty, backupKey]);

  // Signed out: keep the edits in this browser until the owner signs in to save them.
  useEffect(() => {
    if (signedOut && dirty) keepUnsaved(backupKey, { name, draft, baseUpdatedAt: saved.updatedAt });
  }, [signedOut, dirty, backupKey, name, draft, saved.updatedAt]);

  function edited() {
    setSave((s) =>
      s.kind === "saved" ||
      (s.kind === "failed" && !STICKY.includes(s.failure)) ||
      (s.kind === "delete_failed" && !s.signedOut)
        ? { kind: "idle" }
        : s,
    );
  }

  const updateDraft: typeof setDraft = (value) => {
    setDraft(value);
    edited();
  };

  async function onSave(asNew = false) {
    if (busy.current) return;
    const id = asNew ? undefined : savedId;
    const input = toSaveInput(name, draft, currentYear, id);
    if (Object.keys(input.problems).length > 0) {
      setShowProblems(true);
      return;
    }
    setShowProblems(false);
    busy.current = true;
    const sent = { name, draft };
    setSave({ kind: "saving", creating: !id });

    const supabase = createClient();
    const expected = id && !versionCheckMissing ? saved.updatedAt : null;
    const args = { p_property: input.property, p_components: input.components };
    let result = await supabase.rpc("save_property", expected ? { ...args, p_expected_updated_at: expected } : args);
    if (expected && result.error?.code === FUNCTION_NOT_FOUND) {
      // The database hasn't had migration 0002 yet: save without the version check.
      versionCheckMissing = true;
      result = await supabase.rpc("save_property", args);
    }
    const { data: newId, error, status } = result;
    if (error || !newId) {
      busy.current = false;
      let failure = saveFailure(error, status);
      if (failure === "network" && (await isSignedOut())) failure = "signed_out";
      setSave({ kind: "failed", failure });
      return;
    }

    void track("property_saved", {
      components: String(input.components.length),
      source: importFromCalculator ? "calculator" : id ? "edit" : "new",
    });
    if (importFromCalculator) saveDraft(EMPTY_DRAFT);
    clearUnsaved(backupKey);
    setRestored(null);

    if (!id) {
      // The form stays locked until the property's own page opens, so nothing typed is lost.
      setSavedId(newId);
      setSaved({ name: sent.name, draft: sent.draft, updatedAt: null });
      setSave({ kind: "opening" });
      router.replace(`/app/properties/${newId}`);
      return;
    }

    // Read back the new version (for the next save's check) and the ids of new rows.
    // Anything edited while saving is kept, and stays unsaved.
    const back = await readBack(newId);
    busy.current = false;
    if (!back) {
      setSaved({ name: sent.name, draft: sent.draft, updatedAt: null });
    } else if (!matchesSaved(input, back.property, back.components)) {
      // Another tab or device saved right after this one.
      setSave({ kind: "failed", failure: "conflict" });
      return;
    } else {
      const ids = [...back.components].sort((a, b) => a.sort_order - b.sort_order).map((c) => c.id);
      const savedDraft = withSavedIds(sent.draft, sent.draft, ids);
      setSaved({ name: sent.name, draft: savedDraft, updatedAt: back.property.updated_at });
      setDraft((current) => (current === sent.draft ? savedDraft : withSavedIds(current, sent.draft, ids)));
    }
    setSave({ kind: "saved" });
    router.refresh();
  }

  async function onDelete() {
    if (!savedId || !window.confirm(`Delete ${name || "this property"}? This can't be undone.`)) return;
    const { error, count, status } = await createClient()
      .from("properties")
      .delete({ count: "exact" })
      .eq("id", savedId);
    // Row Level Security turns a signed-out delete into "0 rows deleted", not an error.
    if (error || count === 0) {
      const out = status === 401 || (await isSignedOut());
      if (error || out) {
        setSave({ kind: "delete_failed", signedOut: out });
        return;
      }
      // Signed in and nothing to delete: it was already deleted somewhere else.
    }
    clearUnsaved(backupKey);
    setSaved({ name, draft, updatedAt: null });
    router.push("/app");
    router.refresh();
  }

  function discardRestored() {
    clearUnsaved(backupKey);
    setRestored(null);
    setName(initialName);
    setDraft(startingDraft());
    setSaved((s) => ({ ...s, updatedAt: initialUpdatedAt ?? null }));
    setSave({ kind: "idle" });
  }

  function reload() {
    clearUnsaved(backupKey);
    leaving.current = true;
    window.location.reload();
  }

  const failure = save.kind === "failed" ? save.failure : null;
  const status =
    save.kind === "saving"
      ? "Saving…"
      : save.kind === "opening"
        ? "Saved. Opening it…"
        : dirty
          ? "Unsaved changes"
          : save.kind === "saved"
            ? "Saved"
            : "";
  const actionClass =
    "mt-2 inline-block rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-red-800 ring-1 ring-red-300 hover:bg-red-100 dark:bg-transparent dark:text-red-200 dark:ring-red-400/40 dark:hover:bg-red-500/10";

  const header = (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
      {/* The minimum width makes the Save controls wrap below on phones instead of squeezing the name. */}
      <label className="block min-w-48 flex-1 sm:max-w-md">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Property name</span>
        <input
          value={name}
          maxLength={200}
          placeholder="e.g. 14 Maple Court"
          onChange={(e) => {
            setName(e.target.value);
            edited();
          }}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-base font-medium text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400"
        />
      </label>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
          {status}
        </span>
        <button
          type="button"
          onClick={() => onSave()}
          disabled={save.kind === "saving" || save.kind === "opening"}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
        >
          {propertyId ? "Save changes" : "Save property"}
        </button>
      </div>
      {restored && (
        <div className="w-full rounded-lg bg-amber-50 p-3 text-sm text-slate-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-slate-200 dark:ring-amber-500/30">
          <p>We brought back changes you hadn&apos;t saved. Save to keep them.</p>
          <button
            type="button"
            onClick={discardRestored}
            className="mt-1 font-semibold text-slate-700 underline hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
          >
            Discard them
          </button>
        </div>
      )}
      {(problemTexts.length > 0 || failure || save.kind === "delete_failed") && (
        <div role="alert" className="w-full rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
          {failure && <p>{SAVE_FAILURE_TEXT[failure]}</p>}
          {save.kind === "delete_failed" && (
            <p>
              {save.signedOut
                ? "You've been signed out, so this property wasn't deleted. Sign in again to delete it."
                : "Couldn't delete. Try again."}
            </p>
          )}
          {signedOut && (
            <Link
              href={`/auth/sign-in?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}
              data-keeps-edits
              className={actionClass}
            >
              Sign in again
            </Link>
          )}
          {failure === "conflict" && (
            <button type="button" onClick={reload} className={actionClass}>
              Reload
            </button>
          )}
          {failure === "deleted" && (
            <button type="button" onClick={() => onSave(true)} className={actionClass}>
              Save as a new property
            </button>
          )}
          {problemTexts.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
      )}
    </div>
  );

  return (
    // Locked while a new property is created and its page opens, so nothing typed
    // in that moment is lost.
    <fieldset
      disabled={save.kind === "opening" || (save.kind === "saving" && save.creating)}
      className="min-w-0 space-y-8"
    >
      <CalculatorView
        draft={draft}
        setDraft={updateDraft}
        header={header}
        exportName={name.trim() || "My property"}
        library={library}
        rowNotes={rowNotes}
      />
      {propertyId && (
        <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
          <button
            type="button"
            onClick={onDelete}
            className="text-sm font-medium text-red-700 hover:text-red-800 dark:text-red-400"
          >
            Delete this property
          </button>
        </div>
      )}
    </fieldset>
  );
}
