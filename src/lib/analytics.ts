import type { CaptureOptions, CaptureResult, PostHog } from "posthog-js";
import { applyCountMe, COUNT_ME_EVENT } from "./count-me";

/**
 * Where PostHog sends from the browser by default: this site, which passes it on to
 * PostHog (netlify/edge-functions/posthog-relay.ts), so tracker blockers that block
 * PostHog's own domains don't drop visits. Must match RELAY_PREFIX there.
 */
export const RELAY_PATH = "/clockwork";

/** PostHog's app, for links back to it (the toolbar). It can't be worked out from the relay. */
export const POSTHOG_UI_HOST = "https://us.posthog.com";

/**
 * PostHog's hosts. A blank setting (as in .env.example) means the relay. A host that is
 * set is used as it is, such as https://us.i.posthog.com when running the site without
 * Netlify, where the relay doesn't exist.
 */
export function posthogHosts(value: string | undefined): { api_host: string; ui_host?: string } {
  const host = value?.trim();
  return host ? { api_host: host } : { api_host: RELAY_PATH, ui_host: POSTHOG_UI_HOST };
}

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOSTS = posthogHosts(process.env.NEXT_PUBLIC_POSTHOG_HOST);

const LAST_VISIT_KEY = "capexclock:last-visit:v1";

let client: Promise<PostHog | null> | null = null;

// Loads PostHog lazily so it never blocks first paint. No-op without a key.
export function initAnalytics(): Promise<PostHog | null> {
  if (!KEY || typeof window === "undefined") return Promise.resolve(null);
  // A browser marked with ?count-me=off never loads PostHog (see count-me.ts).
  if (!client && !countsThisBrowser()) return Promise.resolve(null);
  client ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        ...HOSTS,
        defaults: "2025-05-24",
        person_profiles: "identified_only",
        // Property names are often street addresses. Clicks are recorded
        // without the text or attributes of what was clicked, page titles
        // are dropped, and screens are never recorded.
        mask_all_text: true,
        mask_all_element_attributes: true,
        disable_session_recording: true,
        before_send: withoutPageTitle,
      });
      recordVisit(posthog, () => window.localStorage, new Date());
      return posthog;
    })
    .catch(() => null);
  return client;
}

let counted: boolean | null = null;

/** Applies ?count-me= once per page load, then remembers the answer. */
function countsThisBrowser(): boolean {
  if (counted === null) {
    counted = applyCountMe(
      window.location,
      () => window.localStorage,
      (href) => window.history.replaceState(window.history.state, "", href),
    );
    window.dispatchEvent(new Event(COUNT_ME_EVENT));
  }
  return counted;
}

/** Event properties: counts and labels only, never names, emails, addresses or anything typed. */
export type EventProperties = Record<string, string | number | boolean>;

/**
 * PostHog's options for an event. `sendNow` is for a click that leaves the page
 * (Buy now) or opens another app (the photo offer's email link): the event skips
 * PostHog's batch and goes at once as a beacon, which the browser delivers even as
 * the page changes or is paused. An ordinary request cut off by
 * the page change is sent again by PostHog, so one click could count twice.
 */
export function captureOptions(sendNow: boolean): CaptureOptions | undefined {
  return sendNow ? { send_instantly: true, transport: "sendBeacon" } : undefined;
}

/** Sends an event. See captureOptions for `sendNow`. */
export async function track(event: string, properties?: EventProperties, { sendNow = false } = {}) {
  const posthog = await initAnalytics();
  posthog?.capture(event, properties, captureOptions(sendNow));
}

/** Page titles can name a property, so they never leave the browser. */
export function withoutPageTitle(event: CaptureResult | null): CaptureResult | null {
  if (event) delete event.properties.title;
  return event;
}

/** Local calendar date as YYYY-MM-DD. */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole days since the last visit, or null when this isn't a return visit. */
export function daysSinceLastVisit(lastVisit: string | null, today: string): number | null {
  if (!lastVisit || !/^\d{4}-\d{2}-\d{2}$/.test(lastVisit)) return null;
  const days = Math.round((Date.parse(today) - Date.parse(lastVisit)) / 86_400_000);
  return days >= 1 ? days : null;
}

/** Sends return_visit at most once a day, and only for a browser that has been here before. */
export function recordVisit(
  posthog: Pick<PostHog, "capture">,
  storage: () => Pick<Storage, "getItem" | "setItem">,
  now: Date,
): void {
  try {
    const store = storage();
    const today = localDay(now);
    const last = store.getItem(LAST_VISIT_KEY);
    if (last === today) return;
    store.setItem(LAST_VISIT_KEY, today);
    const days = daysSinceLastVisit(last, today);
    if (days !== null) posthog.capture("return_visit", { days_since_last_visit: days });
  } catch {
    // Storage blocked: return visits can't be told apart, so none are sent.
  }
}

type Identity = Pick<PostHog, "get_property" | "get_distinct_id" | "reset" | "identify">;

/** Ties events to the account by its Supabase user id. Never the email. */
export function identifyPerson(posthog: Identity, userId: string): void {
  // Someone else was signed in on this browser and didn't sign out: start a
  // new person so the two accounts aren't merged.
  if (posthog.get_property("$user_state") === "identified" && posthog.get_distinct_id() !== userId) {
    posthog.reset();
  }
  posthog.identify(userId);
}

export async function identifyUser(userId: string): Promise<void> {
  const posthog = await initAnalytics();
  if (posthog) identifyPerson(posthog, userId);
}

/** On sign-out: forget the person, so whoever uses this browser next starts anonymous. */
export async function resetAnalytics(): Promise<void> {
  const posthog = await initAnalytics();
  posthog?.reset();
}

/** account_created, at most once per account in this browser even if the welcome link is opened again. */
export async function trackAccountCreated(userId: string): Promise<void> {
  try {
    const key = `capexclock:account-created:${userId}`;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    // Storage blocked: the server still only sends the welcome flag once.
  }
  await track("account_created", {});
}
