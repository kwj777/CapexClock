// Shown at once while a signed-in page reads its data (My properties, a property,
// Add a property), so a tap visibly does something. It also lets Next prefetch these pages.
export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6" role="status" aria-label="Loading">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-900" aria-hidden="true" />
      <div className="mt-8 grid gap-4 md:grid-cols-2" aria-hidden="true">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
      </div>
    </div>
  );
}
