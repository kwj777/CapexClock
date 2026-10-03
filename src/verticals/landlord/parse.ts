/**
 * Reads a number typed into a field: "$1,400" and "1 400" read as 1400.
 * Null when blank; NaN when something was typed that isn't a usable number (e.g. "$30k").
 */
export function readNumber(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * The calculator form's reading of a number: like readNumber, except a number too
 * big to hold comes back as Infinity rather than NaN.
 */
export function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  return Number(cleaned);
}
