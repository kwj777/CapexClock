"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { loadDraft, saveDraft, withImport, type Draft, type DraftImport } from "@/components/calculator/draft";
import type { LibraryComponent } from "@/lib/library/components";

// The importer (and the readers it loads) only once the owner opens it.
const ImportPanel = dynamic(() => import("./ImportPanel"), {
  ssr: false,
  loading: () => <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">Loading the importer…</p>,
});

/**
 * The template page's import box. Rows go into the free calculator's list in this
 * browser, after any already there, and the owner is taken to the calculator.
 */
export default function TemplateImport({
  library,
  accountsEnabled,
}: {
  library: LibraryComponent[];
  accountsEnabled: boolean;
}) {
  const router = useRouter();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  // The calculator's list, read when the panel opens, for duplicates and CapexClock IDs.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState("");

  function open() {
    setDraft(loadDraft());
  }

  function close() {
    setDraft(null);
    buttonRef.current?.focus();
  }

  function apply(change: DraftImport, said: string) {
    // Read again, in case the calculator changed in another tab meanwhile.
    saveDraft(withImport(loadDraft(), change));
    setStatus(`${said} Opening the calculator…`);
    router.push("/capex-calculator");
  }

  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={draft !== null}
        aria-controls={draft ? panelId : undefined}
        onClick={() => (draft ? close() : open())}
        className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
      >
        Import your spreadsheet
      </button>
      <p role="status" className="mt-2 text-sm text-slate-700 empty:hidden dark:text-slate-300">
        {status}
      </p>
      {draft && (
        <ImportPanel
          id={panelId}
          library={library}
          draft={draft}
          onApply={apply}
          onClose={close}
          where="template_page"
          accountsEnabled={accountsEnabled}
        />
      )}
    </div>
  );
}
