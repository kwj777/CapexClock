import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Property not found | CapexClock",
};

// A deleted property, a bad link, or one saved under another email address
// (Row Level Security hides it). The app layout already has the header.
export default function PropertyNotFound() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          We can&apos;t find that property
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          It may have been deleted, or it belongs to a different email address.
        </p>
        <Link
          href="/app"
          className="mt-6 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
        >
          Back to My properties
        </Link>
      </div>
    </div>
  );
}
