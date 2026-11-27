/**
 * Where a new account came from, so GoSocially's Reports can show which posts
 * and profiles bring owners in (src/lib/gosocially.ts).
 *
 * When someone opens any CapexClock page from a link with tracking tags
 * ("utm_source=instagram&utm_campaign=..."), or from another website, the
 * browser remembers it (RememberCameFrom.tsx, in localStorage, never a
 * cookie). The app sends it along after the first sign-in (src/app/app/report-signup.ts).
 *
 * Kept free of browser and server code so it can be tested on its own
 * (__tests__/came-from.test.ts).
 */

/** The browser storage key it's kept under. */
export const CAME_FROM_KEY = "capexclock:came-from:v1";

/** Forgotten after this long: a visit 2 months ago didn't bring this owner in. */
export const CAME_FROM_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** The tags it keeps, as the form fields the welcome page sends. */
export const CAME_FROM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;
export type CameFromField = (typeof CAME_FROM_FIELDS)[number];

export type CameFrom = Partial<Record<CameFromField, string>> & {
  /** When it was seen (milliseconds since 1970). */
  at: number;
  /** True when it's only the website that linked here, not a tagged link. */
  fromSite?: boolean;
};

const MAX_LENGTH = 100;

/** A tag as it's kept: no control characters, no spaces around it, at most 100 letters. */
export function cleanTag(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, MAX_LENGTH);
  return cleaned === "" ? undefined : cleaned;
}

/**
 * The website a visit came from, as a short name: "l.instagram.com" and
 * "www.instagram.com" are both "instagram.com". Null for CapexClock itself, an
 * empty referrer or anything that isn't a web address.
 */
export function referrerSite(referrer: string, ownHost: string): string | null {
  let host: string;
  try {
    const url = new URL(referrer);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    host = url.hostname.toLowerCase();
  } catch {
    return null;
  }
  const strip = (h: string) => h.replace(/^(?:www|m|l|lm|out|t)\./, "");
  host = strip(host);
  const own = strip(ownHost.toLowerCase());
  if (!host || host === own || host.endsWith(`.${own}`) || host.endsWith("capexclock.com")) return null;
  return host;
}

/**
 * What this visit says about where the person came from: the link's tracking
 * tags, or failing that the website that linked here (as utm_source, with
 * utm_medium "referral"). Null when it says nothing (typed in, a bookmark, a
 * page inside CapexClock).
 */
export function cameFromVisit(search: string, referrer: string, ownHost: string, now: number): CameFrom | null {
  const params = new URLSearchParams(search);
  const tags: CameFrom = { at: now };
  let any = false;
  for (const field of CAME_FROM_FIELDS) {
    const value = cleanTag(params.get(field));
    if (value) {
      tags[field] = value;
      any = true;
    }
  }
  if (any) return tags;
  const site = referrerSite(referrer, ownHost);
  return site ? { at: now, utm_source: site, utm_medium: "referral", fromSite: true } : null;
}

/** Reads what the browser kept, or null if it's missing, broken or too old. */
export function parseCameFrom(stored: string | null, now: number): CameFrom | null {
  if (!stored) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(stored);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const at = typeof record.at === "number" && Number.isFinite(record.at) ? record.at : null;
  if (at === null || now - at > CAME_FROM_MAX_AGE_MS || at > now + 60_000) return null;
  const kept: CameFrom = record.fromSite === true ? { at, fromSite: true } : { at };
  let any = false;
  for (const field of CAME_FROM_FIELDS) {
    const value = cleanTag(record[field]);
    if (value) {
      kept[field] = value;
      any = true;
    }
  }
  return any ? kept : null;
}

/**
 * Which one to keep: a visit from a tagged link always replaces what was
 * kept (the latest post that brought them back gets the credit). A visit
 * from another website only fills in when nothing is kept, so a click
 * through Google after an Instagram post still credits the post.
 */
export function chooseCameFrom(kept: CameFrom | null, visit: CameFrom | null): CameFrom | null {
  if (!visit) return kept;
  if (!visit.fromSite || !kept) return visit;
  return kept;
}
