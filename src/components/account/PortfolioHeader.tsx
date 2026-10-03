"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import SetupOffer from "@/components/import/SetupOffer";
import type { LibraryComponent } from "@/lib/library/components";

// The importer (and the readers it loads) only once the owner opens it.
const PortfolioImport = dynamic(() => import("./PortfolioImport"), {
  ssr: false,
  loading: () => <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Loading the importer…</p>,
});

/** My properties' heading, with Add a property and the spreadsheet import. */
export default function PortfolioHeader({
  library,
  properties,
}: {
  library: LibraryComponent[];
  /** The account's properties, so the importer can tell which buildings are already here. */
  properties: { id: string; name: string }[];
}) {
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">My properties</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => (open ? close() : setOpen(true))}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-800"
          >
            Import a spreadsheet
          </button>
          <Link
            href="/app/properties/new"
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
          >
            Add a property
          </Link>
        </div>
      </div>
      {open && (
        <>
          <SetupOffer where="my_properties" className="mt-6" />
          <PortfolioImport id={panelId} library={library} existing={properties} onClose={close} />
        </>
      )}
    </>
  );
}
