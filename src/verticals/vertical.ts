// The extension point for audiences. A vertical turns its own inputs into engine
// Components, calls the engine, and adds its own derived metrics. The engine
// never imports a vertical. Only the landlord vertical exists today.

import type { AssetGroup, ForecastOptions, ForecastResult } from "@/engine";

/** A word in its singular and plural forms. */
export interface Noun {
  readonly one: string;
  readonly many: string;
}

/** The words a vertical's generated text and future shared UI use. */
export interface VerticalLabels {
  /** One asset group: "property" (landlord), later "association" or "campus". */
  readonly assetGroup: Noun;
  /** What a group's reserve is divided by in derived metrics: "unit" (landlord). */
  readonly divisor: Noun;
  /** Other audience words, by key (landlord: unit, door, apartment, building). */
  readonly terms: Readonly<Record<string, Noun>>;
}

/** One entry in a vertical's built-in component library. */
export interface LibraryEntry {
  readonly slug: string;
  readonly category: string;
  readonly name: string;
  /** Typical useful life in whole years, 1 to 100, lifeLow <= lifeHigh. */
  readonly lifeLow: number;
  readonly lifeHigh: number;
}

/** The rules a vertical passes to the engine on every call (never left to engine defaults). */
export type VerticalRules = Required<Omit<ForecastOptions, "startYear" | "adjustments">>;

/** One asset group, the engine's forecast of it, and what only the vertical knows about it. */
export interface VerticalGroup<TFacts> {
  /** Id, name and components (so a metric such as "percent funded" can read ages and lives). */
  readonly group: AssetGroup;
  readonly result: ForecastResult;
  /** Landlord: the unit count. */
  readonly facts: TFacts;
}

/**
 * What every vertical provides.
 * TEntry: its library entry type. TFacts: what it knows about one asset group that
 * the engine doesn't (landlord: unit count). TMetrics / TRollup: its derived metrics
 * for one group and across groups.
 */
export interface Vertical<TEntry extends LibraryEntry, TFacts, TMetrics, TRollup> {
  /** Stable key, e.g. "landlord". */
  readonly id: string;
  readonly labels: VerticalLabels;
  /** Built-in library: the default components and their useful-life ranges. */
  readonly library: readonly TEntry[];
  /** Useful life used when the owner hasn't typed one. */
  defaultLife(entry: TEntry): number;
  /** Horizon, reserve look-ahead, at-risk window, inflation, starting balance. */
  readonly rules: VerticalRules;
  /** Derived metrics for one group, from engine output plus vertical facts. Never computed inside the engine. */
  derivedMetrics(group: VerticalGroup<TFacts>): TMetrics;
  /** Derived metrics across groups (a portfolio), in the order given. */
  rollupMetrics(groups: readonly VerticalGroup<TFacts>[]): TRollup;
}
