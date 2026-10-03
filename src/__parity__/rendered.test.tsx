// Today's pages as text, saved: the calculator, the forecast PDF, the condition
// report, the comparison panel, the home page illustration, the portfolio and
// the quick estimate, drawn by the real components. Only the lines that build
// their inputs change when the forecast code moves; the saved text
// (__snapshots__/rendered.test.tsx.snap) must not.

import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Portfolio from "@/components/account/Portfolio";
import { CalculatorView } from "@/components/calculator/Calculator";
import { ComparisonPanel } from "@/components/calculator/CompareAtRisk";
import { exampleDraft, parseUnitCount, toComponents, type Draft, type DraftRow } from "@/components/calculator/draft";
import ForecastPdf from "@/components/export/ForecastPdf";
import ForecastMockup from "@/components/ForecastMockup";
import ConditionReportPdf from "@/components/report/ConditionReportPdf";
import QuickEstimate from "@/components/reserve/QuickEstimate";
import { exportDetails } from "@/lib/export/rows";
import { compareReplaceNow, computeForecast } from "@/lib/forecast";
import { COMPONENT_LIBRARY, TYPICAL_COSTS } from "@/lib/library/components";
import { sampleReport, SAMPLE_NOTE } from "@/lib/report/sample";
import type { ComponentRow, PropertyRow } from "@/lib/supabase/database.types";
import { corpusDraft, mulberry32 } from "./generate";

// The PDF primitives become plain tags, and a bar's width is written out, so the
// text holds every figure and bar the PDF draws.
jest.mock("@react-pdf/renderer", () => {
  const widths = (style: unknown): string => {
    const list = Array.isArray(style) ? style : [style];
    const width = list.map((s) => (s && typeof s === "object" ? (s as { width?: unknown }).width : undefined)).find((w) => typeof w === "string");
    return typeof width === "string" ? `[bar ${width}]` : "";
  };
  const tag = (name: string) =>
    function Primitive({ children, style }: { children?: ReactNode; style?: unknown }) {
      const marker = name === "View" ? widths(style) : "";
      return (
        <div>
          {marker}
          {children}
        </div>
      );
    };
  return {
    Document: tag("Document"),
    Page: tag("Page"),
    View: tag("View"),
    Text: tag("Text"),
    Link: tag("Link"),
    Font: { register: () => undefined, registerHyphenationCallback: () => undefined, load: async () => undefined, getFont: () => ({ data: null }) },
    StyleSheet: { create: <T,>(styles: T) => styles },
    pdf: () => ({ toBlob: async () => new Blob() }),
  };
});

/** The words on the page, one space between each. */
function text(element: ReactElement): string {
  return renderToStaticMarkup(element)
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** Runs `draw` with the clock at mid-June of `year`, for components that read the year themselves. */
function inYear<T>(year: number, draw: () => T): T {
  jest.useFakeTimers({ now: new Date(year, 5, 15, 12) });
  try {
    return draw();
  } finally {
    jest.useRealTimers();
  }
}

// Row ids made from the clock are replaced, so the saved text doesn't depend on when it ran.
function withSteadyIds(draft: Draft): Draft {
  return { ...draft, rows: draft.rows.map((r, i): DraftRow => ({ ...r, id: `row-${i}` })) };
}

const calculator = (draft: Draft) => <CalculatorView draft={draft} setDraft={() => undefined} />;

describe("the calculator", () => {
  for (const year of [2026, 2027, 2040]) {
    it(`with the example building in ${year}`, () => {
      expect(inYear(year, () => text(calculator(withSteadyIds(exampleDraft()))))).toMatchSnapshot();
    });
  }

  it("with 25 made-up buildings", () => {
    const rand = mulberry32(20261003);
    const pages = Array.from({ length: 25 }, (_, i) => {
      const made = corpusDraft(rand, 2026);
      const draft: Draft = {
        ...made,
        rows: made.rows.map((r, j): DraftRow => ({ ...r, id: `b${i}-r${j}`, followsUnitCount: false })),
      };
      return inYear(2026, () => text(calculator(draft)));
    });
    expect(pages).toMatchSnapshot();
  });

  it("with a row that overflows", () => {
    const draft: Draft = {
      unitCount: "12",
      yearBuilt: "1998",
      rows: [
        { id: "big", librarySlug: null, category: "Roofing", name: "Big roof", quantity: "1e200", unitLabel: "per_building", installYear: "2000", usefulLife: "30", costEach: "1e200", scenario: "run_to_failure" },
        { id: "boiler", librarySlug: null, category: "HVAC", name: "Boiler", quantity: "1", unitLabel: "per_building", installYear: "2010", usefulLife: "15", costEach: "9000", scenario: "run_to_failure" },
      ],
    };
    expect(inYear(2026, () => text(calculator(draft)))).toMatchSnapshot();
  });
});

describe("the forecast PDF", () => {
  for (const year of [2026, 2040]) {
    it(`for the example building in ${year}`, () => {
      const draft = withSteadyIds(exampleDraft());
      const { components } = toComponents(draft, year);
      const unitCount = parseUnitCount(draft.unitCount);
      const forecast = computeForecast({ startYear: year, unitCount, components });
      expect(
        text(
          <ForecastPdf
            name="Example building"
            unitCount={unitCount}
            forecast={forecast}
            components={components}
            details={exportDetails(draft.rows, components)}
            generatedOn="June 15, 2026"
          />,
        ),
      ).toMatchSnapshot();
    });
  }
});

describe("the sample condition report", () => {
  it("in 2026", () => {
    const report = inYear(2026, () => sampleReport(2026));
    const ids = new Map(report.rows.map((r) => [r.id, r.name]));
    expect(ids.size).toBe(report.rows.length);
    expect(
      text(
        <ConditionReportPdf
          {...report}
          preparedOn="October 1, 2026"
          informationAsOf="October 2026"
          sampleNote={SAMPLE_NOTE}
        />,
      ),
    ).toMatchSnapshot();
  });
});

describe("the replace-now comparison", () => {
  for (const percent of [0, 25]) {
    it(`on the example building, ${percent}% emergency premium`, () => {
      const draft = withSteadyIds(exampleDraft());
      const { components } = toComponents(draft, 2026);
      const comparison = compareReplaceNow(
        { startYear: 2026, unitCount: parseUnitCount(draft.unitCount), components },
        { emergencyPercent: percent },
      );
      expect(
        text(
          <ComparisonPanel
            baseId="compare"
            applyId="apply"
            startYear={2026}
            comparison={comparison}
            byId={new Map(components.map((c) => [c.id, c]))}
            rows={new Map(draft.rows.map((r) => [r.id, r]))}
            unticked={new Set()}
            onTick={() => undefined}
            percentText={percent ? String(percent) : ""}
            percent={percent}
            showPercentError={false}
            onPercentChange={() => undefined}
            onPercentEditing={() => undefined}
            onApply={() => undefined}
          />,
        ),
      ).toMatchSnapshot();
    });
  }
});

describe("the home page illustration", () => {
  it("in 2026", () => {
    expect(inYear(2026, () => text(<ForecastMockup />))).toMatchSnapshot();
  });
});

describe("the portfolio", () => {
  const property = (id: string, name: string, unitCount: number, yearBuilt: number | null = 2000): PropertyRow => ({
    id,
    user_id: "11111111-1111-1111-1111-111111111111",
    name,
    city: null,
    state: null,
    unit_count: unitCount,
    year_built: yearBuilt,
    created_at: "",
    updated_at: "",
  });
  const component = (id: string, propertyId: string, overrides: Partial<ComponentRow> = {}): ComponentRow => ({
    id,
    property_id: propertyId,
    library_slug: null,
    category: "Roofing",
    name: "Roof",
    quantity: 1,
    unit_label: "per_building",
    install_year: 2016,
    useful_life_years: 20,
    replacement_cost_each: 120_000,
    condition: null,
    notes: null,
    scenario: "run_to_failure",
    sort_order: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  });

  it("with four properties", () => {
    const a = property("a0000000-0000-4000-8000-000000000001", "Ten units", 10);
    const b = property("a0000000-0000-4000-8000-000000000002", "Units not entered", 0);
    const c = property("a0000000-0000-4000-8000-000000000003", "One unit", 1, null);
    const d = property("a0000000-0000-4000-8000-000000000004", "Fractional units", 2.5, 1985);
    const rows = [
      component("c1", a.id),
      component("c2", b.id, { install_year: 2000 }),
      component("c3", a.id, { name: "Boiler", category: "HVAC", install_year: null, useful_life_years: 25, replacement_cost_each: 18000 }),
      component("c4", c.id, { install_year: null }),
      component("c5", c.id, { name: "Water heater", category: "Plumbing", install_year: 2019, useful_life_years: 10, replacement_cost_each: 1400, install_year_is_estimate: true }),
      component("c6", d.id, { name: "Carpet", category: "Flooring", quantity: 2400.5, unit_label: "per_sq_ft", install_year: 2021, useful_life_years: 8, replacement_cost_each: 3.75 }),
      component("c7", d.id, { name: "Seal coat", category: "Site", quantity: 8000, install_year: null, useful_life_years: 4, replacement_cost_each: 0.25, scenario: "replace_now" }),
    ];
    expect(text(<Portfolio properties={[a, b, c, d]} components={rows} userId={null} serverYear={2026} />)).toMatchSnapshot();
  });
});

describe("the quick estimate", () => {
  it("as the page is built", () => {
    expect(inYear(2026, () => text(<QuickEstimate library={COMPONENT_LIBRARY} typicalCosts={TYPICAL_COSTS} />))).toMatchSnapshot();
  });
});
