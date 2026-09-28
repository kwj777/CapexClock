import type { CaptureResult, PostHog } from "posthog-js";

export const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

/** A blank setting (as in .env.example) means the default host, not this site's own origin. */
export function posthogHost(value: string | undefined): string {
  return value?.trim() || DEFAULT_POSTHOG_HOST;
}

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = posthogHost(process.env.NEXT_PUBLIC_POSTHOG_HOST);

const LAST_VISIT_KEY = "capexclock:last-visit:v1";

let client: Promise<PostHog | null> | null = null;

// Loads PostHog lazily so it never blocks first paint. No-op without a key.
export function initAnalytics(): Promise<PostHog | null> {
  if (!KEY || typeof window === "undefined") return Promise.resolve(null);
  client ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
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

export async function track(event: string, properties?: Record<string, string>) {
  const posthog = await initAnalytics();
  posthog?.capture(event, properties);
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
