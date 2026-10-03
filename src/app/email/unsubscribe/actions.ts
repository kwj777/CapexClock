"use server";

import { readUnsubscribeLink } from "@/lib/owner-emails/kinds";
import { unsubscribe, type UnsubscribeResult } from "@/lib/owner-emails/unsubscribe";

export type UnsubscribeState = UnsubscribeResult | "idle";

/** The unsubscribe page's button. The token is the only proof needed, as in the email's own link. */
export async function unsubscribeAction(_prev: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const link = readUnsubscribeLink(formData.get("t")?.toString(), formData.get("k")?.toString());
  if (!link) return "not_found";
  return unsubscribe(link.token, link.kind);
}
