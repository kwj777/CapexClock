// Sends one email through Resend's API (https://resend.com/docs/api-reference/emails/send-email).
// Resend already sends the sign-in links, so capexclock.com is verified there.

import { CONTACT_EMAIL } from "@/lib/site";
import type { EmailContent } from "./templates";

export const FROM = "CapexClock <reminders@capexclock.com>";

export interface Attachment {
  readonly filename: string;
  /** Base64. */
  readonly content: string;
}

export interface OutgoingEmail extends EmailContent {
  readonly to: string;
  /** The one-click unsubscribe address for the List-Unsubscribe header. */
  readonly oneClickUrl: string;
  readonly attachments?: readonly Attachment[];
  /** Resend drops a second send with the same key within 24 hours. */
  readonly idempotencyKey?: string;
}

export type SendEmail = (email: OutgoingEmail) => Promise<void>;

/** A sender bound to an API key. Throws when Resend refuses, with its message. */
export function resendSender(apiKey: string, fetchImpl: typeof fetch = fetch): SendEmail {
  return async (email) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (email.idempotencyKey) headers["Idempotency-Key"] = email.idempotencyKey;
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: FROM,
        to: [email.to],
        reply_to: CONTACT_EMAIL,
        subject: email.subject,
        html: email.html,
        text: email.text,
        headers: {
          "List-Unsubscribe": `<${email.oneClickUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        ...(email.attachments?.length
          ? { attachments: email.attachments.map((a) => ({ filename: a.filename, content: a.content })) }
          : {}),
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Resend refused the email (${response.status}): ${detail.slice(0, 300)}`);
    }
  };
}
