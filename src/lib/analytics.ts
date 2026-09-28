import type { CaptureResult, PostHog } from "posthog-js";

export const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

/** A blank setting (as in .env.example) means the default host, not this site's own origin. */
export function posthogHost(value: string | undefined): string {
  return value?.trim() || DEFAULT_POSTHOG_HOST;
}

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = posthogHost(process.env.NEXT_PUBLIC_POSTHOG_HOST);

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
