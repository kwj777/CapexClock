"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalculatorView, type RowNote } from "@/components/calculator/Calculator";
import { loadDraft, saveDraft } from "@/components/calculator/draft-storage";
import { track } from "@/lib/analytics";
import {
  draftFromRows,
  SAVE_PROBLEM_TEXT,
  saveProblemFields,
  toSaveInput,
  type SaveInput,
  type SaveProblem,
} from "@/lib/properties/convert";
import {
  compareSaved,
  detailsDropped,
  DETAILS_NOT_SAVED_TEXT,
  FUNCTION_NOT_FOUND,
  SAVE_FAILURE_TEXT,
  saveFailure,
  sendsDetails,
  versionFromReadBack,
  withSavedIds,
  type ReadBack,
  type SaveFailure,
} from "@/lib/properties/save";
import { createClient } from "@/lib/supabase/client";
import type { ComponentRow } from "@/lib/supabase/database.types";
import { EMPTY_DRAFT, type Draft, type LibraryComponent, type TypicalCost } from "@/verticals/landlord";
import { isSignedOut, readBack } from "./read-back";
import {
  clearUnsaved,
  keepUnsaved,
  loadUnsaved,
  nothingToRestore,
  opensAnotherApp,
  unsavedKey,
  wasDropped,
  type UnsavedEdits,
} from "./unsaved";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving"; creating: boolean }
  | { kind: "saved" }
  // Saved, but the database has no update 0004, so condition and notes were dropped.
  | { kind: "saved_without_details" }
  // A new property was saved and its own page is loading.
  | { kind: "opening" }
  | { kind: "failed"; failure: SaveFailure }
  | { kind: "delete_failed"; signedOut: boolean };

// These stay on screen while the owner keeps editing, until they act on them.
const STICKY: SaveFailure[] = ["signed_out", "conflict", "deleted"];

// How long after a page opens a status meant for it is set, so screen readers announce it.
const ANNOUNCE_DELAY_MS = 500;

// Set once the database turns out not to have migration 0002's version check.
let versionCheckMissing = false;
function noteVersionCheckMissing() {
  versionCheckMissing = true;
}

// A new property whose condition and notes the database dropped (no update 0004 yet).
// Its own page opens next and says so.
let detailsNotSavedFor: string | null = null;
function noteDetailsNotSaved(propertyId: string | null) {
  detailsNotSavedFor = propertyId;
}

// A new property that was just saved. Its own page opens next and says "Saved".
let createdNow: string | null = null;
function noteCreated(propertyId: string | null) {
  createdNow = propertyId;
}

/** No components, units or year built: nothing came over from the calculator. */
function isEmptyDraft(draft: Draft): boolean {
  return draft.rows.length === 0 && draft.unitCount.trim() === "" && draft.yearBuilt.trim() === "";
}

/** Row ids as saved, in the order the rows were sent. */
function savedIds(components: ComponentRow[]): string[] {
  return [...components].sort((a, b) => a.sort_order - b.sort_order).map((c) => c.id);
}

export interface PropertyEditorProps {
  propertyId?: string;
  initialName: string;
  /** The property's updated_at when the page loaded, so a save can tell if it changed since. */
  initialUpdatedAt?: string;
  initialDraft: Draft;
  /** New property started from the public calculator's work in this browser. */
  importFromCalculator?: boolean;
  library: LibraryComponent[];
  typicalCosts: TypicalCost[];
  /** The signed-in account, so unsaved edits kept in this browser only come back for it. */
  userId: string | null;
  /** The account's email, filled in on the paid-idea "tell me first" forms. */
  userEmail?: string | null;
}

export default function PropertyEditor({
  propertyId,
  initialName,
  initialUpdatedAt,
  initialDraft,
  importFromCalculator = false,
  library,
  typicalCosts,
  userId,
  userEmail,
}: PropertyEditorProps) {
  const router = useRouter();
  const backupKey = unsavedKey(userId, propertyId, importFromCalculator);
  const [currentYear] = useState(() => new Date().getFullYear());
  // Rendered client-only (see PropertyEditorLoader), so localStorage is safe here.
  // An import starts from the calculator's work in this browser as it is now. With
  // none (the link was opened in another browser), it starts from the same blank
  // draft as the saved copy, so it isn't "Unsaved changes" before any edit.
  const [calculator] = useState(() => {
    if (!importFromCalculator) return null;
    const work = loadDraft();
    // The calculator's optional property name becomes this property's name.
    const { name: workName, ...workDraft } = work;
    const empty = isEmptyDraft(workDraft);
    return {
      draft: empty ? initialDraft : workDraft,
      name: (workName ?? "").trim(),
      stored: JSON.stringify(work),
      empty,
    };
  });
  const startingDraft = calculator?.draft ?? initialDraft;
  const startingName = calculator?.name || initialName;
  const [restored, setRestored] = useState(() => {
    const kept = loadUnsaved(backupKey);
    // Not over newer calculator work, and not when it matches what's already here.
    if (!kept || (calculator && kept.calculator !== calculator.stored)) return null;
    return nothingToRestore(kept, startingName, startingDraft, currentYear) ? null : kept;
  });
  const [name, setName] = useState(() => restored?.name ?? startingName);
  const [draft, setDraft] = useState<Draft>(() => restored?.draft ?? startingDraft);
  // The copy in the database. Restored edits keep the version they started from, so
  // saving them over a newer copy is caught.
  const [saved, setSaved] = useState(() => ({
    name: initialName,
    draft: initialDraft,
    updatedAt: restored ? restored.baseUpdatedAt : (initialUpdatedAt ?? null),
  }));
  const [savedId, setSavedId] = useState(propertyId);
  // A new property that just opened here after its condition and notes were dropped:
  // the kept edits hold them, and the message replaces "We brought back changes".
  const [arrivedDetailsDropped] = useState(() => propertyId !== undefined && detailsNotSavedFor === propertyId);
  const [arrivedCreated] = useState(() => propertyId !== undefined && createdNow === propertyId);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [showProblems, setShowProblems] = useState(false);
  // Counts blocked saves, so each one moves focus to the first row to fix.
  const [blockedSaves, setBlockedSaves] = useState(0);
  const form = useRef<HTMLFieldSetElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const leaving = useRef(false);
  const mounted = useRef(true);
  // The unsaved edits last kept in this browser; null when there are none.
  const lastKept = useRef<Omit<UnsavedEdits, "keptAt"> | null>(null);

  const dirty = name !== saved.name || draft !== saved.draft;
  const signedOut =
    (save.kind === "failed" && save.failure === "signed_out") || (save.kind === "delete_failed" && save.signedOut);

  // After a blocked save, problems update as the owner fixes them, next to each row.
  const { problems, propertyProblems } = useMemo(
    () =>
      showProblems
        ? toSaveInput(name, draft, currentYear, savedId)
        : { problems: {} as Record<string, SaveProblem>, propertyProblems: [] as SaveProblem[] },
    [showProblems, name, draft, currentYear, savedId],
  );
  // Both of the property's own problems, then the rows'.
  const propertyTexts = [...new Set(propertyProblems.map((p) => SAVE_PROBLEM_TEXT[p]))];
  const rowTexts = [
    ...new Set(
      Object.entries(problems)
        .filter(([id]) => id !== "property")
        .map(([, p]) => SAVE_PROBLEM_TEXT[p]),
    ),
  ];
  const problemTexts = [...propertyTexts, ...rowTexts];
  // On a long property the row to fix can be far down the page, so the alert names it.
  const badRows = draft.rows.filter((row) => row.id in problems);
  const firstBad = badRows.length > 0 ? badRows[0].name.trim() || `row ${draft.rows.indexOf(badRows[0]) + 1}` : "";
  const badRowsText =
    badRows.length === 0
      ? null
      : badRows.length === 1
        ? `1 row needs fixing: ${firstBad}.`
        : `${badRows.length} rows need fixing. The first is ${firstBad}.`;
  const rowNotes = Object.fromEntries(
    Object.entries(problems)
      .filter(([id]) => id !== "property")
      .map(([id, p]): [string, RowNote] => [id, { text: SAVE_PROBLEM_TEXT[p], fields: saveProblemFields(p) }]),
  );

  useEffect(() => {
    if (!dirty) return;
    // A mail link opens the mail app and this page stays, but Chrome still fires
    // beforeunload for it. That one is let through, if it comes within a second.
    let openingApp = false;
    let openingTimer: ReturnType<typeof setTimeout> | undefined;
    const letAppOpen = () => {
      openingApp = true;
      clearTimeout(openingTimer);
      openingTimer = setTimeout(() => {
        openingApp = false;
      }, 1000);
    };
    const warn = (event: BeforeUnloadEvent) => {
      if (openingApp) {
        openingApp = false;
        return;
      }
      if (!leaving.current) event.preventDefault();
    };
    const askToLeave = (event: Event) => {
      if (window.confirm("You have unsaved changes. Leave without saving them?")) {
        leaving.current = true;
        clearUnsaved(backupKey);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };
    // Links inside the app change pages without unloading this one, so ask here too.
    const confirmLeave = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      if (opensAnotherApp(link.href)) {
        letAppOpen();
        return;
      }
      if (link.hasAttribute("download") || link.hasAttribute("data-keeps-edits")) return;
      if (link.target && link.target !== "_self") return;
      const to = new URL(link.href);
      const here = window.location;
      if (to.origin !== here.origin || (to.pathname === here.pathname && to.search === here.search)) return;
      askToLeave(event);
    };
    // Forms that go to another page (Sign out) ask the same way, before signing out
    // drops the kept copy. Forms marked data-keeps-edits (the paid-idea sign-ups) stay here.
    const confirmSubmit = (event: SubmitEvent) => {
      if (event.defaultPrevented) return;
      const form = event.target;
      if (form instanceof HTMLFormElement && form.hasAttribute("action") && !form.hasAttribute("data-keeps-edits")) {
        askToLeave(event);
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", confirmLeave, true);
    document.addEventListener("submit", confirmSubmit, true);
    return () => {
      clearTimeout(openingTimer);
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", confirmLeave, true);
      document.removeEventListener("submit", confirmSubmit, true);
    };
  }, [dirty, backupKey]);

  // Said once: opening this property again later starts as usual. The message is set
  // just after the page appears, not in its first render, because a live region reads
  // out what changes in it, not what it starts with.
  useEffect(() => {
    if (!arrivedDetailsDropped) return;
    noteDetailsNotSaved(null);
    const timer = window.setTimeout(
      () => setSave((s) => (s.kind === "idle" ? { kind: "saved_without_details" } : s)),
      ANNOUNCE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [arrivedDetailsDropped]);

  // Same for a property just created: screen readers hear "Saved" once its page opens.
  useEffect(() => {
    if (!arrivedCreated) return;
    noteCreated(null);
    const timer = window.setTimeout(() => setSave((s) => (s.kind === "idle" ? { kind: "saved" } : s)), ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [arrivedCreated]);

  // After a blocked save, the first field to fix is brought to the middle of the screen and
  // focused: Rental units or Year built if either has a problem (they come first), else the first bad row.
  useEffect(() => {
    if (blockedSaves === 0) return;
    let field: HTMLElement | null | undefined = null;
    if (propertyProblems.length > 0) {
      field = form.current?.querySelector<HTMLElement>('input[aria-invalid="true"]');
    } else {
      const first = draft.rows.find((row) => row.id in problems);
      if (!first) return;
      field = form.current?.querySelector<HTMLElement>(
        `[aria-invalid="true"][aria-describedby*="-${CSS.escape(first.id)}-problem"]`,
      );
    }
    if (!field) return;
    field.scrollIntoView({ block: "center" });
    field.focus({ preventScroll: true });
    // Only when a save is blocked, not as the owner fixes rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockedSaves]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Unsaved edits are kept in this browser, so leaving another way (Back, a lost
  // session, an error page taking over) doesn't lose them. They come back next time
  // this property (or a new one) is opened.
  useEffect(() => {
    if (!dirty) {
      lastKept.current = null;
      clearUnsaved(backupKey);
      return;
    }
    const edits = {
      name,
      draft,
      baseUpdatedAt: saved.updatedAt,
      ...(calculator ? { calculator: calculator.stored } : {}),
    };
    lastKept.current = edits;
    keepUnsaved(backupKey, edits);
    // Another tab can drop this copy: signing out drops every copy, and saving the
    // same property drops its copy. These edits are still here unsaved, so keep them again.
    const keepAgain = (event: StorageEvent) => {
      if (!leaving.current && wasDropped(event, backupKey)) keepUnsaved(backupKey, edits);
    };
    window.addEventListener("storage", keepAgain);
    // Kept again on the way out too.
    return () => {
      window.removeEventListener("storage", keepAgain);
      if (!leaving.current) keepUnsaved(backupKey, edits);
    };
  }, [dirty, backupKey, name, draft, saved.updatedAt, calculator]);

  /** Makes sure the edits are kept after a failed save, as the message says. */
  function keepAfterFailure() {
    if (!leaving.current && lastKept.current) keepUnsaved(backupKey, lastKept.current);
  }

  function edited() {
    setSave((s) =>
      s.kind === "saved" ||
      s.kind === "saved_without_details" ||
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
      setBlockedSaves((n) => n + 1);
      return;
    }
    setShowProblems(false);
    busy.current = true;
    const sent = { name, draft };
    setSave({ kind: "saving", creating: !id });

    let expected = id && !versionCheckMissing ? saved.updatedAt : null;
    if (id && !versionCheckMissing && !expected) {
      // The last save here couldn't read back the new version, so check it now
      // rather than save without the check.
      const checked = versionFromReadBack(
        toSaveInput(saved.name, saved.draft, currentYear, id),
        await readBack(id),
      );
      if ("failure" in checked) {
        busy.current = false;
        const out = checked.failure !== "conflict" && (await isSignedOut());
        keepAfterFailure();
        setSave({ kind: "failed", failure: out ? "signed_out" : checked.failure });
        return;
      }
      expected = checked.updatedAt;
    }

    const supabase = createClient();
    const args = { p_property: input.property, p_components: input.components };
    let result = await supabase.rpc("save_property", expected ? { ...args, p_expected_updated_at: expected } : args);
    if (expected && result.error?.code === FUNCTION_NOT_FOUND) {
      // The database hasn't had migration 0002 yet: save without the version check.
      noteVersionCheckMissing();
      result = await supabase.rpc("save_property", args);
    }
    const { data: newId, error, status } = result;
    if (error || !newId) {
      busy.current = false;
      let failure = saveFailure(error, status);
      if (failure === "network" && (await isSignedOut())) failure = "signed_out";
      keepAfterFailure();
      setSave({ kind: "failed", failure });
      return;
    }

    void track("property_saved", {
      components: String(input.components.length),
      source: importFromCalculator ? "calculator" : id ? "edit" : "new",
    });
    // Only the calculator work this came from: newer work there (from another tab) stays.
    if (calculator && JSON.stringify(loadDraft()) === calculator.stored) saveDraft(EMPTY_DRAFT);
    // The kept copy goes once nothing is unsaved (see the effect above).
    setRestored(null);

    // A database without update 0004 drops condition and notes without an error. For a
    // new property they're kept in this browser for its own page, which says so.
    let droppedFromNew: Omit<UnsavedEdits, "keptAt"> | null = null;
    if (!id && sendsDetails(input)) {
      const back = await readBack(newId);
      if (back?.property && compareSaved(input, back.property, back.components) === "without_details") {
        droppedFromNew = {
          name: sent.name,
          draft: withSavedIds(sent.draft, sent.draft, savedIds(back.components)),
          baseUpdatedAt: back.property.updated_at,
        };
      }
    }

    if (!mounted.current && !id) {
      // The owner left while it saved, and the form was locked, so the copy kept on
      // the way out is what was just saved. Stay where they went.
      busy.current = false;
      if (!leaving.current) clearUnsaved(backupKey);
      if (droppedFromNew) keepUnsaved(unsavedKey(userId, newId), droppedFromNew);
      router.refresh();
      return;
    }

    if (!id) {
      if (droppedFromNew) {
        keepUnsaved(unsavedKey(userId, newId), droppedFromNew);
        noteDetailsNotSaved(newId);
      } else {
        noteCreated(newId);
      }
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
    if (!mounted.current) {
      settleAfterLeaving(input, sent, back);
      router.refresh();
      return;
    }
    if (!back?.property) {
      // Saved, but its new version is unknown. The next save checks it first.
      setSaved({ name: sent.name, draft: sent.draft, updatedAt: null });
    } else {
      const match = compareSaved(input, back.property, back.components);
      const lastSaved = toSaveInput(saved.name, saved.draft, currentYear, id);
      if (match === "different" || (match === "without_details" && !detailsDropped(lastSaved, back.components))) {
        // Another tab or device saved right after this one, maybe only condition or notes.
        setSave({ kind: "failed", failure: "conflict" });
        return;
      }
      const ids = savedIds(back.components);
      const savedDraft = withSavedIds(sent.draft, sent.draft, ids);
      setDraft((current) => (current === sent.draft ? savedDraft : withSavedIds(current, sent.draft, ids)));
      if (match === "without_details") {
        // The database holds everything but the condition and notes. They stay on
        // screen as unsaved changes (kept in this browser), to save once it's updated.
        setSaved({
          name: sent.name,
          draft: draftFromRows(back.property, back.components),
          updatedAt: back.property.updated_at,
        });
        setSave({ kind: "saved_without_details" });
        router.refresh();
        return;
      }
      setSaved({ name: sent.name, draft: savedDraft, updatedAt: back.property.updated_at });
    }
    setSave({ kind: "saved" });
    router.refresh();
  }

  /**
   * The owner left while a save was in flight, and the copy kept on the way out
   * still starts from the old version. Drop it if it's what was saved, or move edits
   * made during the save onto the new version.
   */
  function settleAfterLeaving(input: SaveInput, sent: { name: string; draft: Draft }, back: ReadBack | null) {
    const left = lastKept.current;
    if (leaving.current || !left) return;
    const match = back?.property ? compareSaved(input, back.property, back.components) : null;
    if (left.name === sent.name && left.draft === sent.draft && match !== "without_details") {
      clearUnsaved(backupKey);
    } else if (back?.property && match !== "different") {
      // Edits made during the save, or condition and notes the database dropped.
      keepUnsaved(backupKey, {
        ...left,
        draft: withSavedIds(left.draft, sent.draft, savedIds(back.components)),
        baseUpdatedAt: back.property.updated_at,
      });
    }
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
    leaving.current = true;
    clearUnsaved(backupKey);
    setSaved({ name, draft, updatedAt: null });
    router.push("/app");
    router.refresh();
  }

  function discardRestored() {
    clearUnsaved(backupKey);
    setRestored(null);
    setName(initialName);
    setDraft(startingDraft);
    setSaved((s) => ({ ...s, updatedAt: initialUpdatedAt ?? null }));
    setSave({ kind: "idle" });
  }

  function reload() {
    if (dirty && !window.confirm("Reload the latest version? The changes you made here will be lost.")) return;
    leaving.current = true;
    clearUnsaved(backupKey);
    window.location.reload();
  }

  const failure = save.kind === "failed" ? save.failure : null;
  const status =
    save.kind === "saving"
      ? "Saving…"
      : save.kind === "opening"
        ? "Saved. Opening it…"
        : save.kind === "saved_without_details"
          ? DETAILS_NOT_SAVED_TEXT
          : dirty
            ? "Unsaved changes"
            : save.kind === "saved"
              ? "Saved"
              : "";
  const actionClass =
    "mt-2 inline-block rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-red-800 ring-1 ring-red-300 hover:bg-red-100 dark:bg-transparent dark:text-red-200 dark:ring-red-400/40 dark:hover:bg-red-500/10";

  // On phones Save is far above most rows, so a bar at the bottom carries it while there's something to save.
  const showSaveBar = (dirty || save.kind === "saving") && save.kind !== "opening";
  const notSaved = problemTexts.length > 0 || failure !== null;
  const saveButton = (
    <button
      type="button"
      onClick={() => onSave()}
      // aria-disabled, not disabled, while saving: a disabled button drops keyboard focus to the page.
      // onSave ignores clicks while a save is in flight.
      aria-disabled={save.kind === "saving"}
      disabled={save.kind === "opening"}
      className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60 aria-disabled:opacity-60"
    >
      {propertyId ? "Save changes" : "Save property"}
    </button>
  );

  const header = (
    <div ref={headerRef} className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
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
          className="mt-1 block w-full rounded-md border border-slate-500 bg-white px-2.5 py-2 text-base font-medium text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-500 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400"
        />
        {importFromCalculator && !name.trim() && (
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Give it a name so you can find it later.
          </span>
        )}
      </label>
      {/* Wraps, so a long status (the 0004 message) moves the button below it on phones. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span
          className={`max-w-xs text-sm ${
            save.kind === "saved_without_details"
              ? "font-medium text-amber-800 dark:text-amber-300"
              : "text-slate-500 dark:text-slate-400"
          }`}
          aria-live="polite"
        >
          {status}
        </span>
        {saveButton}
      </div>
      {calculator?.empty && !restored && (
        <p className="w-full text-sm text-slate-600 dark:text-slate-300">
          No calculator work found in this browser. Add your property below, or open the calculator where you used it
          and choose Save to my account.
        </p>
      )}
      {restored && !arrivedDetailsDropped && (
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
              {dirty ? "Reload and lose my changes" : "Reload"}
            </button>
          )}
          {failure === "deleted" && (
            <button type="button" onClick={() => onSave(true)} className={actionClass}>
              Save as a new property
            </button>
          )}
          {propertyTexts.map((text) => (
            <p key={text}>{text}</p>
          ))}
          {badRowsText && <p className="font-medium">{badRowsText}</p>}
          {rowTexts.map((text) => (
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
      ref={form}
      disabled={save.kind === "opening" || (save.kind === "saving" && save.creating)}
      className="min-w-0 space-y-8"
    >
      <CalculatorView
        draft={draft}
        setDraft={updateDraft}
        header={header}
        quickSummary={savedId !== undefined}
        exportName={name.trim() || "My property"}
        listName={name.trim()}
        importWhere="editor"
        accountsEnabled
        library={library}
        typicalCosts={typicalCosts}
        rowNotes={rowNotes}
        unitCountProblem={propertyProblems.includes("unit_count") ? SAVE_PROBLEM_TEXT.unit_count : undefined}
        where="property"
        ownerEmail={userEmail}
      />
      {propertyId && (
        <div className="border-t border-slate-200 pt-6 dark:border-slate-800">
          <button
            type="button"
            onClick={onDelete}
            className="-mx-2 rounded-md px-2 py-2 text-sm font-medium text-red-700 hover:text-red-800 dark:text-red-400"
          >
            Delete this property
          </button>
        </div>
      )}
      {/* Sticky, not fixed: past the end of the editor it settles below "Delete this property"
          instead of covering it or the footer. */}
      {showSaveBar && (
        <div className="sticky bottom-0 z-30 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:hidden dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex items-center justify-between gap-3">
            {/* Not a live region: the status at the top already announces changes. */}
            {notSaved && save.kind !== "saving" ? (
              <button
                type="button"
                onClick={() => headerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="text-left text-sm font-medium text-red-700 underline underline-offset-2 dark:text-red-400"
              >
                Not saved. See why
              </button>
            ) : (
              <span className="text-sm text-slate-600 dark:text-slate-300">{status}</span>
            )}
            {saveButton}
          </div>
        </div>
      )}
    </fieldset>
  );
}
