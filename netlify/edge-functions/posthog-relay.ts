// PostHog through capexclock.com. Safari's private windows and ad blockers block
// PostHog's own domains, so the browser sends analytics here and this passes them on
// (src/lib/analytics.ts points PostHog at RELAY_PATH). An edge function rather than a
// netlify.toml proxy rule, because a rule can't drop request headers: it would hand
// this site's cookies, the Supabase sign-in among them, to PostHog. Only the headers
// PostHog needs go, plus the visitor's IP so PostHog can still work out rough location.
// The privacy page (src/app/privacy/page.tsx) promises exactly that, so update it with this.
//
// No imports: Netlify runs this in Deno, and the Jest tests import it directly.

/** Must match RELAY_PATH in src/lib/analytics.ts and the path in `config` below. */
export const RELAY_PREFIX = "/clockwork";

const EVENTS_HOST = "https://us.i.posthog.com";
// Scripts and remote config come from PostHog's assets host, which sends cache headers.
const ASSETS_HOST = "https://us-assets.i.posthog.com";

/**
 * The request headers PostHog's script sends that PostHog uses. x-conversations-token is
 * the public token of PostHog's chat widget, in case it's ever turned on. Cookies and
 * everything else stay here.
 */
const PASSED_ON = ["accept", "content-type", "content-encoding", "user-agent", "x-conversations-token"];

// fetch has already unpacked the body, so its encoding and length no longer apply.
// PostHog has no business setting cookies on this site, nor its HSTS policy: PostHog's
// covers every subdomain, which next.config.ts deliberately doesn't.
const DROPPED_FROM_RESPONSE = [
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "set-cookie",
  "strict-transport-security",
];

/** The PostHog URL for a request to the relay, or null for anything outside it. */
export function upstreamUrl(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  if (!url.pathname.startsWith(`${RELAY_PREFIX}/`)) return null;
  // Always starts with "/", so the host can't be swapped for another.
  const path = url.pathname.slice(RELAY_PREFIX.length);
  const host = path.startsWith("/static/") || path.startsWith("/array/") ? ASSETS_HOST : EVENTS_HOST;
  return `${host}${path}${url.search}`;
}

/** The headers PostHog gets: what it reads, and the visitor's IP. */
export function upstreamHeaders(incoming: Headers, visitorIp: string | undefined): Headers {
  const headers = new Headers();
  for (const name of PASSED_ON) {
    const value = incoming.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (visitorIp) headers.set("x-forwarded-for", visitorIp);
  return headers;
}

/** PostHog's answer, as the browser should get it. */
export function relayedResponse(upstream: Response): Response {
  const headers = new Headers(upstream.headers);
  for (const name of DROPPED_FROM_RESPONSE) headers.delete(name);
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

/** What Netlify passes as the second argument. Only the visitor's IP is used. */
type RelayContext = { ip?: string };

export default async function relay(request: Request, context: RelayContext): Promise<Response> {
  const target = upstreamUrl(request.url);
  if (!target) return new Response(null, { status: 404 });
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: upstreamHeaders(request.headers, context.ip),
      body: hasBody ? await request.arrayBuffer() : undefined,
    });
    return relayedResponse(upstream);
  } catch {
    // PostHog tries batched events again later. Beacons (sendNow clicks, events sent as
    // the page closes) aren't retried, the same as when they went straight to PostHog.
    return new Response(null, { status: 502 });
  }
}

export const config = { path: "/clockwork/*" };
