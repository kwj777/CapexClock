"use client";

import dynamic from "next/dynamic";
import type { PropertyEditorProps } from "./PropertyEditor";

// Uses today's date and (for imports) localStorage, so it renders only in the browser.
const PropertyEditor = dynamic(() => import("./PropertyEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-64 motion-safe:animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" aria-hidden="true" />
  ),
});

export default function PropertyEditorLoader(props: PropertyEditorProps) {
  return <PropertyEditor {...props} />;
}
