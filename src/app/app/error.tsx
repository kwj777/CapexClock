"use client";

// Shown when a signed-in page can't load its data. Nothing is shown half-loaded, so
// a property can't be edited (and saved) from a partial copy.
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <div role="alert" className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          We couldn&apos;t load this page
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Your saved properties are safe. This is usually a brief problem, so please try again in a
          moment.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-6 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
