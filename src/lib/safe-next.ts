// Any origin works here: it only tells us whether a value would leave the site.
const BASE = "https://capexclock.invalid";

/**
 * Only same-site paths are allowed as post-sign-in destinations. Returns the
 * path, query and hash as the URL parser reads them, or the fallback.
 */
export function safeNext(value: string | null | undefined, fallback = "/app"): string {
  // URL parsing drops tabs and newlines and treats "\" like "/", so
  // "/<tab>/evil.com" would become "//evil.com". Refuse them outright.
  if (!value || /[\u0000-\u001F\u007F\\]/.test(value)) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return fallback;
  }
  // Dot segments can still collapse to "//host" ("/.//evil.com").
  if (url.origin !== BASE || url.pathname.startsWith("//")) return fallback;
  return url.pathname + url.search + url.hash;
}
