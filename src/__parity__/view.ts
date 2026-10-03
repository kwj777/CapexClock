// Turns results into short lines of text for the saved "today's numbers". Every
// number is written in full (String(n) gives back the exact same number), so a
// change of even the last bit shows up. Ids made from the clock are swapped for
// stable keys.

import type { AtRiskComponent, LandlordForecast, Replacement } from "@/verticals/landlord";

/** A number written so it reads back exactly; -0 is kept apart from 0. */
export function n(x: number | null | undefined): string {
  if (x === null) return "null";
  if (x === undefined) return "undefined";
  return Object.is(x, -0) ? "-0" : String(x);
}

export type KeyOf = (componentId: string) => string;
export const ownId: KeyOf = (id) => id;

function replacement(r: Replacement, key: KeyOf): string {
  return `${key(r.componentId)}|${r.name}|${r.category}@${r.year}=${n(r.cost)}${r.overdue ? " overdue" : ""}${r.estimated.installYear ? " est" : ""}`;
}

function atRisk(a: AtRiskComponent, key: KeyOf): string {
  return `${key(a.componentId)}|${a.name}|${a.category} eol ${a.endOfLifeYear} left ${n(a.yearsRemaining)} ${a.status}${a.estimated.installYear ? " est" : ""}`;
}

/** Every figure of a forecast, one fact per line. */
export function forecastLines(f: LandlordForecast, key: KeyOf = ownId): string[] {
  const lines = [
    `window ${f.startYear}-${f.endYear}`,
    `monthly ${n(f.monthlyReserve)} perUnit ${n(f.monthlyReservePerUnit)}`,
    `neededNow ${n(f.neededNow)} total ${n(f.horizonTotal)}`,
  ];
  for (const y of f.years) {
    const cats = Object.entries(y.byCategory).map(([c, v]) => `${c}:${n(v)}`).join(", ");
    lines.push(`${y.year} total ${n(y.total)} [${cats}]`);
    for (const r of y.replacements) lines.push(`  ${replacement(r, key)}`);
  }
  for (const r of f.savingAhead) lines.push(`ahead ${replacement(r, key)}`);
  for (const a of f.atRisk) lines.push(`risk ${atRisk(a, key)}`);
  return lines;
}

/** The headline figures on one line, for the big corpus. */
export function compactLine(f: LandlordForecast, key: KeyOf = ownId): string {
  const years = f.years.map((y) => n(y.total)).join(",");
  const ahead = f.savingAhead.map((r) => `${key(r.componentId)}@${r.year}`).join(",");
  const risk = f.atRisk.map((a) => `${key(a.componentId)}:${n(a.yearsRemaining)}${a.estimated.installYear ? "e" : ""}`).join(",");
  const firstYear = f.years[0].replacements
    .map((r) => `${key(r.componentId)}=${n(r.cost)}${r.overdue ? "o" : ""}${r.estimated.installYear ? "e" : ""}`)
    .join(",");
  return `m ${n(f.monthlyReserve)} pu ${n(f.monthlyReservePerUnit)} now ${n(f.neededNow)} tot ${n(f.horizonTotal)} | years ${years} | y1 ${firstYear} | ahead ${ahead} | risk ${risk}`;
}
