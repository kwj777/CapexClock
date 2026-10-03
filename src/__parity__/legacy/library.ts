// FROZEN COPY of src/lib/library/components.ts at commit 94acb55 (main), kept so the engine refactor can be
// checked against today's math bit for bit. Do not edit: the "Today's numbers
// unchanged" check fails on any change here. Excerpt: only the types and defaultLife the quick estimate uses, unchanged.

import type { UnitLabel } from "./types";

export interface LibraryComponent {
  slug: string;
  category: string;
  name: string;
  lifeLow: number;
  lifeHigh: number;
  unitLabel: UnitLabel;
}

export type TypicalCostPer = "apartment" | "sq_ft";

/**
 * A typical installed replacement cost in today's dollars, from a basic job (low)
 * to a typical upper end (high). Only ever shown as a hint or used in the quick
 * estimate, never in a property's forecast.
 */
export interface TypicalCost {
  slug: string;
  low: number;
  high: number;
  per: TypicalCostPer;
}

export function defaultLife(item: LibraryComponent): number {
  return Math.round((item.lifeLow + item.lifeHigh) / 2);
}
