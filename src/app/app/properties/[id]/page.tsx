import Link from "next/link";
import { notFound } from "next/navigation";
import PropertyEditorLoader from "@/components/account/PropertyEditorLoader";
import { draftFromRows } from "@/lib/properties/convert";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PropertyPage({ params }: PageProps<"/app/properties/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: property }, { data: components }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase.from("components").select("*").eq("property_id", id),
  ]);
  // Row Level Security returns nothing for someone else's property, so this is also the access check.
  if (!property) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6">
      <Link href="/app" className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        ← My properties
      </Link>
      <h1 className="mt-2 mb-6 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{property.name}</h1>
      <PropertyEditorLoader
        // Remount with fresh ids from the database after each save.
        key={property.updated_at}
        propertyId={property.id}
        initialName={property.name}
        initialDraft={draftFromRows(property, components ?? [])}
      />
    </div>
  );
}
