import type { Metadata } from "next";
import Link from "next/link";
import PropertyEditorLoader from "@/components/account/PropertyEditorLoader";
import { getLibrary, getTypicalCosts } from "@/lib/library/source";
import { EMPTY_DRAFT } from "@/components/calculator/draft";
import { getAccount } from "../../account";

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
  const [library, typicalCosts, account] = await Promise.all([getLibrary(), getTypicalCosts(), getAccount()]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6">
      <Link href="/app" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        ← My properties
      </Link>
      <h1 className="mt-2 mb-6 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
        {heading(params.from)}
      </h1>
      <PropertyEditorLoader
        library={library}
        typicalCosts={typicalCosts}
        userId={account.id}
        userEmail={account.email}
        initialName=""
        initialDraft={EMPTY_DRAFT}
        importFromCalculator={fromCalculator}
      />
    </div>
  );
}
