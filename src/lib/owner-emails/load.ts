import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, EmailSwitches } from "@/lib/supabase/database.types";
import { switchesFrom } from "./kinds";

/**
 * What My properties shows under Email settings:
 * - member: the three switches,
 * - not_member: that the emails come with the founding membership,
 * - unavailable: 0006 hasn't run yet, or the read failed (the rest of the page still works).
 */
export type EmailSettingsView =
  | { state: "member"; switches: EmailSwitches }
  | { state: "not_member" }
  | { state: "unavailable" };

export async function loadEmailSettings(
  supabase: SupabaseClient<Database>,
  userId: string | null,
): Promise<EmailSettingsView> {
  if (!userId) return { state: "unavailable" };
  try {
    const [membership, settings] = await Promise.all([
      supabase.from("memberships").select("active").eq("user_id", userId).maybeSingle(),
      supabase
        .from("email_settings")
        .select("reminders, budget_summary, condition_report")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (membership.error || settings.error) return { state: "unavailable" };
    if (!membership.data?.active) return { state: "not_member" };
    return { state: "member", switches: switchesFrom(settings.data) };
  } catch {
    return { state: "unavailable" };
  }
}
