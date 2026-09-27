import type { PostHog } from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

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
