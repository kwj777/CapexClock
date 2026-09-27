"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalculatorView } from "@/components/calculator/Calculator";
import { EMPTY_DRAFT, loadDraft, saveDraft, type Draft } from "@/components/calculator/draft";
import { track } from "@/lib/analytics";
import { SAVE_PROBLEM_TEXT, toSaveInput, type SaveProblem } from "@/lib/properties/convert";
import { createClient } from "@/lib/supabase/client";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export interface PropertyEditorProps {
  propertyId?: string;
  initialName: string;
  initialDraft: Draft;
  /** New property started from the public calculator's work in this browser. */
  importFromCalculator?: boolean;
}

export default function PropertyEditor({
  propertyId,
  initialName,
  initialDraft,
  importFromCalculator = false,
}: PropertyEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  // Rendered client-only (see PropertyEditorLoader), so localStorage is safe here.
  const [draft, setDraft] = useState<Draft>(() => (importFromCalculator ? loadDraft() : initialDraft));
  const [dirty, setDirty] = useState(importFromCalculator);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [problems, setProblems] = useState<SaveProblem[]>([]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const updateDraft: typeof setDraft = (value) => {
    setDraft(value);
    setDirty(true);
    setSave({ kind: "idle" });
  };

  async function onSave() {
    const input = toSaveInput(name, draft, new Date().getFullYear(), propertyId);
    const found = [...new Set(Object.values(input.problems))];
    setProblems(found);
    if (found.length > 0) return;

    setSave({ kind: "saving" });
    const { data: id, error } = await createClient().rpc("save_property", {
      p_property: input.property,
      p_components: input.components,
    });
    if (error || !id) {
      setSave({ kind: "error", message: "Couldn't save. Check your connection and try again." });
      return;
    }
    void track("property_saved", {
      components: String(input.components.length),
      source: importFromCalculator ? "calculator" : propertyId ? "edit" : "new",
    });
    if (importFromCalculator) saveDraft(EMPTY_DRAFT);
    setDirty(false);
    setSave({ kind: "saved" });
    if (propertyId) router.refresh();
    else router.replace(`/app/properties/${id}`);
  }

  async function onDelete() {
    if (!propertyId || !window.confirm(`Delete ${name || "this property"}? This can't be undone.`)) return;
    const { error } = await createClient().from("properties").delete().eq("id", propertyId);
    if (error) {
      setSave({ kind: "error", message: "Couldn't delete. Try again." });
      return;
    }
    setDirty(false);
    router.push("/app");
    router.refresh();
  }

  const header = (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
      <label className="block min-w-0 flex-1 sm:max-w-md">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Property name</span>
        <input
          value={name}
          maxLength={200}
          placeholder="e.g. 14 Maple Court"
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
            setSave({ kind: "idle" });
          }}
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-base font-medium text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-400"
        />
      </label>
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
          {save.kind === "saving"
            ? "Saving…"
            : save.kind === "saved"
              ? "Saved"
              : dirty
                ? "Unsaved changes"
                : ""}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={save.kind === "saving"}
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
        >
          {propertyId ? "Save changes" : "Save property"}
        </button>
      </div>
      {(problems.length > 0 || save.kind === "error") && (
        <div role="alert" className="w-full rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
          {save.kind === "error" && <p>{save.message}</p>}
          {problems.map((p) => (
            <p key={p}>{SAVE_PROBLEM_TEXT[p]}</p>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <CalculatorView
        draft={draft}
        setDraft={updateDraft}
        header={header}
        exportName={name.trim() || "My property"}
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
    </div>
  );
}
