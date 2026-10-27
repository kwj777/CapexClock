import EmailSettings from "@/components/account/EmailSettings";
import ImportDraftPrompt from "@/components/account/ImportDraftPrompt";
import Portfolio from "@/components/account/Portfolio";
import PortfolioHeader from "@/components/account/PortfolioHeader";
import { getLibrary } from "@/lib/library/source";
import { loadEmailSettings } from "@/lib/owner-emails/load";
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
  // Read on its own, after the rest: it never fails the page, even before 0006 has run.
  const emailSettings = await loadEmailSettings(supabase, account.id);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
      {/* The header has no room for the email on phones, so it goes here. */}
      {account.email && (
        <p className="mb-4 truncate text-sm text-slate-500 sm:hidden dark:text-slate-400">
          Signed in as {account.email}
        </p>
      )}
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

      <EmailSettings view={emailSettings} />
    </div>
  );
}
