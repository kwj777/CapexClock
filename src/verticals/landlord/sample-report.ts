// The sample condition report on /pricing is made from the calculator's
// example building (Load an example), with made-up conditions and notes of
// the kind an owner would send. scripts/sample-report.tsx renders it.

import type { Component } from "@/engine";
import { reportRows, type ReportRow } from "./condition-report";
import { toComponents } from "./draft/components";
import { exampleDraft } from "./draft/example";
import type { ComponentCondition } from "./draft/model";
import { parseUnitCount } from "./draft/rows";
import { landlordForecast, type LandlordForecast } from "./forecast";

/** The owner's ratings and notes for each example component, by library slug. */
const SAMPLE_CONDITIONS: Record<string, { condition: ComponentCondition; notes: string }> = {
  "asphalt-shingle-roof": { condition: "fair", notes: "Some granule loss on the south slope. No leaks reported." },
  "gas-furnace": { condition: "good", notes: "Serviced every fall. No repairs in the last two years." },
  "tank-water-heater": { condition: "fair", notes: "Rust at the fittings in units 3 and 7." },
  refrigerator: { condition: "fair", notes: "Replaced one at a time over the years; install dates weren't kept." },
  carpet: { condition: "poor", notes: "Worn through in the hallways of units 2, 5 and 9." },
  "parking-lot-seal-coat": { condition: "good", notes: "Cracks filled in 2025." },
};

export const SAMPLE_NOTE =
  "This is a sample. It uses the CapexClock calculator's example building, and the building, conditions and notes are made up.";

export interface SampleReport {
  propertyName: string;
  unitCount: number;
  yearBuilt: number;
  rows: ReportRow[];
  forecast: LandlordForecast;
  components: Component[];
}

export function sampleReport(year: number): SampleReport {
  const draft = exampleDraft();
  const { components, problems } = toComponents(draft, year);
  if (Object.keys(problems).length > 0) throw new Error("The calculator's example has rows the forecast can't use.");
  const unitCount = parseUnitCount(draft.unitCount);
  const inputs = components.map((component) => {
    const row = draft.rows.find((r) => r.id === component.id);
    const sample = row?.librarySlug ? SAMPLE_CONDITIONS[row.librarySlug] : undefined;
    if (!row || !sample) throw new Error(`No sample condition for ${component.name}.`);
    return { component, unitLabel: row.unitLabel, condition: sample.condition, notes: sample.notes };
  });
  return {
    propertyName: `${unitCount}-unit apartment building`,
    unitCount,
    yearBuilt: Number(draft.yearBuilt),
    rows: reportRows(inputs, year),
    forecast: landlordForecast(components, unitCount, year),
    components,
  };
}
