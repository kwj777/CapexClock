import ImportDraftPrompt from "@/components/account/ImportDraftPrompt";
import Portfolio from "@/components/account/Portfolio";
import PortfolioHeader from "@/components/account/PortfolioHeader";
import { getLibrary } from "@/lib/library/source";
import { fetchAllRows } from "@/lib/properties/load";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "./account";

export default async function PortfolioPage() {
  const supabase = await createClient();
  // Any failed or partial read throws to error.tsx: a missing list would show as $0.
  const [properties, components, account, library] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase.from("properties").select("*", { count: "exact" }).order("created_at").order("id").range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase.from("components").select("*", { count: "exact" }).order("id").range(from, to),
    ),
    getAccount(),
    getLibrary(),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      <PortfolioHeader library={library} properties={properties.map(({ id, name }) => ({ id, name }))} />

      <ImportDraftPrompt />

      {properties.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <p className="text-lg font-medium text-slate-900 dark:text-white">No properties yet</p>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Add your first building to see its replacement forecast and monthly reserve, or import a spreadsheet of
            your buildings.
          </p>
        </div>
      ) : (
        <Portfolio
          properties={properties}
          components={components}
          userId={account.id}
          serverYear={new Date().getFullYear()}
        />
      )}
    </div>
  );
}
