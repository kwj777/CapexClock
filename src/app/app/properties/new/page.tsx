import type { Metadata } from "next";
import Link from "next/link";
import PropertyEditorLoader from "@/components/account/PropertyEditorLoader";
import { getLibrary } from "@/lib/library/source";
import { EMPTY_DRAFT } from "@/components/calculator/draft";

function heading(from: string | string[] | undefined): string {
  return from === "calculator" ? "Save your calculator work" : "Add a property";
}

export async function generateMetadata({ searchParams }: PageProps<"/app/properties/new">): Promise<Metadata> {
  const params = await searchParams;
  return { title: `${heading(params.from)} | CapexClock` };
}

export default async function NewPropertyPage({ searchParams }: PageProps<"/app/properties/new">) {
  const params = await searchParams;
  const fromCalculator = params.from === "calculator";
  const library = await getLibrary();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6">
      <Link href="/app" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        ← My properties
      </Link>
      <h1 className="mt-2 mb-6 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
        {heading(params.from)}
      </h1>
      <PropertyEditorLoader
        library={library} initialName="" initialDraft={EMPTY_DRAFT} importFromCalculator={fromCalculator} />
    </div>
  );
}
