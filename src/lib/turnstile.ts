// Cloudflare Turnstile on the sign-in form, so bots can't use up the sign-in
// email quota. It's on only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. Supabase
// checks the token only once CAPTCHA is switched on there (Authentication →
// Attack Protection), and ignores it until then, so the key goes live first.

import { CONTACT_EMAIL } from "@/lib/site";

/** Explicit rendering: the widget is drawn by our code, not found in the page by Turnstile. */
export const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** The site key, or null when CAPTCHA is off. A blank setting counts as off. */
export function turnstileSiteKey(setting: string | undefined): string | null {
  return setting?.trim() || null;
}

/** The parts of window.turnstile we use. */
export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileOptions): string | null | undefined;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}

export interface TurnstileOptions {
  sitekey: string;
  action?: string;
  theme?: "auto" | "light" | "dark";
  size?: "normal" | "flexible" | "compact";
  callback?: (token: string) => void;
  "error-callback"?: (code: string) => boolean | void;
  "expired-callback"?: () => void;
  "timeout-callback"?: () => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/**
 * The normal and flexible widgets are at least 300px wide, which would scroll
 * a 320px phone sideways, so narrower spaces get the compact one (150px).
 */
export function widgetSize(availableWidth: number): "flexible" | "compact" {
  return availableWidth >= 300 ? "flexible" : "compact";
}

/** Where the check stands. A token is single-use, so every sign-in attempt resets it. */
export type Captcha =
  | { kind: "off" }
  | { kind: "loading" }
  | { kind: "waiting" }
  | { kind: "ready"; token: string }
  | { kind: "failed" };

export type CaptchaEvent =
  | { type: "token"; token: string }
  /** The token expired or was used, or the widget was reset or timed out: wait for a new one. */
  | { type: "cleared" }
  /** The script didn't load, or the widget reported an error. */
  | { type: "failed" };

export function initialCaptcha(siteKey: string | null): Captcha {
  return siteKey ? { kind: "loading" } : { kind: "off" };
}

export function captchaReducer(state: Captcha, event: CaptchaEvent): Captcha {
  if (state.kind === "off") return state;
  switch (event.type) {
    case "token":
      return { kind: "ready", token: event.token };
    case "cleared":
      // A widget that failed to load can't produce a new token, so it stays failed.
      return state.kind === "failed" ? state : { kind: "waiting" };
    case "failed":
      return { kind: "failed" };
  }
}

/**
 * What a press of the sign-in button does: send with the token, send without
 * one (CAPTCHA off here, or the check failed, so Supabase decides), or wait.
 */
export function sendPlan(state: Captcha): { send: true; token?: string } | { send: false } {
  switch (state.kind) {
    case "off":
    case "failed":
      return { send: true };
    case "ready":
      return { send: true, token: state.token };
    case "loading":
    case "waiting":
      return { send: false };
  }
}

export const CAPTCHA_WAIT_TEXT = "The security check isn't finished yet. Wait for it to show a tick, then try again.";

export const CAPTCHA_FAILED_TEXT = `The security check didn't load. Check your connection, allow challenges.cloudflare.com if you use a blocker, and reload the page. If it still doesn't work, email ${CONTACT_EMAIL}.`;

/** Supabase's error, as far as the sign-in form reads it. */
export interface SendError {
  status?: number;
  code?: string;
  message: string;
}

/** Plain words for a failed sign-in email. */
export function sendErrorMessage(error: SendError): string {
  if (error.status === 429) return "Too many sign-in emails just now. Please wait a minute and try again.";
  if (error.code === "captcha_failed" || /captcha/i.test(error.message)) {
    return `The security check didn't pass. Please try again. If it keeps happening, reload the page or email ${CONTACT_EMAIL}.`;
  }
  return `We couldn't send the link. Check the address, or email ${CONTACT_EMAIL}.`;
}
