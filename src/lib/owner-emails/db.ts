// The daily run's EmailStore on Supabase, with the server-only secret key. Only
// netlify/functions/owner-emails.mts uses it; the secret key never reaches a browser.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/properties/load";
import type { Database } from "@/lib/supabase/database.types";
import { switchesFrom } from "./kinds";
import type { EmailStore, Member } from "./run";

export function secretClient(url: string, secretKey: string): SupabaseClient<Database> {
  return createClient<Database>(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? "no data"}`);
}

export function supabaseStore(db: SupabaseClient<Database>): EmailStore {
  return {
    async members() {
      const memberships = await fetchAllRows((from, to) =>
        db.from("memberships").select("user_id", { count: "exact" }).eq("active", true).order("user_id").range(from, to),
      );
      const members: Member[] = [];
      for (const { user_id: userId } of memberships) {
        const { data: user, error: userError } = await db.auth.admin.getUserById(userId);
        if (userError || !user.user?.email) continue;
        let { data: settings, error } = await db.from("email_settings").select("*").eq("user_id", userId).maybeSingle();
        if (error) fail("Reading email settings", error);
        if (!settings) {
          // First run for this member: make the row, all on, with its unsubscribe token.
          ({ data: settings, error } = await db
            .from("email_settings")
            .upsert({ user_id: userId }, { onConflict: "user_id" })
            .select("*")
            .single());
          if (error || !settings) fail("Making email settings", error);
        }
        members.push({
          userId,
          email: user.user.email,
          switches: switchesFrom(settings),
          unsubscribeToken: settings.unsubscribe_token,
        });
      }
      return members;
    },

    async ownerData(userId) {
      const properties = await fetchAllRows((from, to) =>
        db.from("properties").select("*", { count: "exact" }).eq("user_id", userId).order("created_at").order("id").range(from, to),
      );
      if (properties.length === 0) return { properties, components: [] };
      const ids = properties.map((p) => p.id);
      const components = await fetchAllRows((from, to) =>
        db.from("components").select("*", { count: "exact" }).in("property_id", ids).order("sort_order").order("id").range(from, to),
      );
      return { properties, components };
    },

    async sentLog(userId) {
      return fetchAllRows((from, to) =>
        db
          .from("email_log")
          .select("kind, year, component_id, sent_at", { count: "exact" })
          .eq("user_id", userId)
          .order("id")
          .range(from, to),
      );
    },

    async record(userId, entries) {
      if (entries.length === 0) return;
      const { error } = await db
        .from("email_log")
        .upsert(
          entries.map((e) => ({ user_id: userId, kind: e.kind, year: e.year, component_id: e.component_id })),
          { onConflict: "user_id,kind,year,component_id", ignoreDuplicates: true },
        );
      if (error) fail("Logging sent emails", error);
    },
  };
}
