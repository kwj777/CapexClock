import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import PropertyEditorLoader from "@/components/account/PropertyEditorLoader";
import { getLibrary, getTypicalCosts } from "@/lib/library/source";
import { draftFromRows } from "@/lib/properties/convert";
import { fetchAllRows } from "@/lib/properties/load";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "../../account";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shared by the title and the page, so the property is read once per request.
const getProperty = cache(async (id: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Couldn't load property: ${error.message}`);
  return data;
});

export async function generateMetadata({ params }: PageProps<"/app/properties/[id]">): Promise<Metadata> {
  const { id } = await params;
  // null: no such property (or not this account's), as not-found.tsx says. undefined: it couldn't be read.
  const property = UUID.test(id) ? await getProperty(id).catch(() => undefined) : null;
  if (property === null) return { title: "Property not found | CapexClock" };
  return { title: `${property?.name ?? "Property"} | CapexClock` };
}

export default async function PropertyPage({ params }: PageProps<"/app/properties/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  // A failed or partial read throws to error.tsx. Editing from a partial list would
  // delete the missing components on the next save.
  // The property (with its version) is read before its components. If a save lands
  // in between, the older version goes with the newer components, so the editor's
  // next save is refused instead of overwriting that save.
  const property = await getProperty(id);
  // Row Level Security returns nothing for someone else's property, so this is also the access check.
  if (!property) notFound();
  const [components, library, typicalCosts, account] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("components")
        .select("*", { count: "exact" })
        .eq("property_id", id)
        .order("sort_order")
        .order("id")
        .range(from, to),
    ),
    getLibrary(),
    getTypicalCosts(),
    getAccount(),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6">
      <Link href="/app" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        ← My properties
      </Link>
      <h1 className="mt-2 mb-6 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{property.name}</h1>
      <PropertyEditorLoader
        library={library}
        typicalCosts={typicalCosts}
        // Keeps its own state after a save; a new mount only for another property.
        key={property.id}
        userId={account.id}
        userEmail={account.email}
        propertyId={property.id}
        initialName={property.name}
        initialUpdatedAt={property.updated_at}
        initialDraft={draftFromRows(property, components)}
      />
    </div>
  );
}
