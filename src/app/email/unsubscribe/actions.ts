"use server";

import { readUnsubscribeLink, type UnsubscribeKind } from "@/lib/owner-emails/kinds";
import { unsubscribe, type UnsubscribeResult } from "@/lib/owner-emails/unsubscribe";

/** The result, and which emails the pressed button was for (one, or all three). */
export type UnsubscribeState = { result: UnsubscribeResult; kind: UnsubscribeKind | null } | "idle";

/** The unsubscribe page's button. The token is the only proof needed, as in the email's own link. */
export async function unsubscribeAction(_prev: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const link = readUnsubscribeLink(formData.get("t")?.toString(), formData.get("k")?.toString());
  if (!link) return { result: "not_found", kind: null };
  return { result: await unsubscribe(link.token, link.kind), kind: link.kind };
}
