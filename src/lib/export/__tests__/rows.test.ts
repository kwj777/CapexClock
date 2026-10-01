import { computeForecast, type ForecastComponent } from "@/lib/forecast";
import { formatCostEach, formatPrice, formatQuantity, LONG_WORD, longWordParts, moneyColumn } from "../format";
import {
  ESTIMATED_NOTE,
  exportDetails,
  exportRows,
  GUESS_NOTE,
  guessedYear,
  installYearNote,
  leftOutSummary,
  sumTotals,
  toCents,
  type ExportFormRow,
} from "../rows";

const components: ForecastComponent[] = [
  { id: "furnace", category: "HVAC", name: "Gas furnace", quantity: 12, installYear: 2012, installYearIsEstimate: true, usefulLifeYears: 18, replacementCostEach: 4200 },
  { id: "carpet", category: "Flooring", name: "Carpet", quantity: 9600, installYear: 2020, usefulLifeYears: 8, replacementCostEach: 4 },
  { id: "dw", category: "Appliances", name: "Dishwasher", quantity: 1, installYear: 2023, usefulLifeYears: 3, replacementCostEach: 650.5 },
  { id: "wh", category: "Plumbing", name: "Water heater", quantity: 1, installYear: 2010, installYearIsEstimate: true, usefulLifeYears: 10, replacementCostEach: 1400 },
];
const forecast = computeForecast({ startYear: 2026, unitCount: 12, components });
const rows = exportRows(forecast, components, new Map([["carpet", "per_sq_ft"]]));

describe("export rows", () => {
  it("flags estimated install years on every row, not just at-risk ones", () => {
    // 2012 + 18 = 2030: three years out, so not at risk, but still an estimate.
    expect(forecast.atRisk.map((a) => a.componentId)).not.toContain("furnace");
    expect(rows.find((r) => r.name === "Gas furnace")?.notes).toEqual(["Install year estimated"]);
    expect(rows.find((r) => r.name === "Water heater" && r.year === 2026)?.notes).toEqual([
      "Overdue",
      "Install year estimated",
    ]);
    expect(rows.find((r) => r.name === "Carpet")?.notes).toEqual([]);
  });

  it("carries the unit of measure", () => {
    expect(rows.find((r) => r.name === "Carpet")).toMatchObject({ quantity: 9600, unit: "sq ft", costEach: 4, total: 38400 });
    expect(rows.find((r) => r.name === "Gas furnace")).toMatchObject({ unit: "each" });
  });

  it("adds up to the forecast total", () => {
    const sum = rows.reduce((total, r) => total + r.total, 0);
    expect(toCents(sum)).toBe(toCents(forecast.total));
    expect(rows.filter((r) => r.name === "Dishwasher").map((r) => r.total)).toEqual([650.5, 650.5, 650.5, 650.5]);
  });
});

describe("export totals", () => {
  it("add up the rounded rows, so totals match the table to the cent", () => {
    const striping = ["a", "b", "c"].map(
      (id): ForecastComponent => ({ id, category: "Site", name: `Striping ${id}`, quantity: 3333, installYear: 2020, usefulLifeYears: 5, replacementCostEach: 0.125 }),
    );
    const f = computeForecast({ startYear: 2026, unitCount: 12, components: striping });
    const due = exportRows(f, striping).filter((r) => r.year === 2026);
    expect(due.map((r) => r.total)).toEqual([416.63, 416.63, 416.63]);
    // The unrounded year total, 1249.875, would print as $1,249.88.
    expect(toCents(f.years[0].total)).toBe(1249.88);
    expect(sumTotals(due)).toBe(1249.89);
  });

  it("clear float noise from the sum", () => {
    expect(sumTotals([{ total: 0.1 }, { total: 0.2 }])).toBe(0.3);
    expect(sumTotals(rows)).toBe(toCents(forecast.total));
    expect(sumTotals([])).toBe(0);
  });
});

describe("money in exports", () => {
  it("rounds to cents", () => {
    expect(toCents(3300 * 0.29)).toBe(957);
    expect(toCents(12 * 1400.1)).toBe(16801.2);
    expect(toCents(3 * 0.1)).toBe(0.3);
  });

  it("shows cents on every row once any row has them, so the column adds up", () => {
    const money = moneyColumn(rows.map((r) => r.total));
    const dishwashers = rows.filter((r) => r.name === "Dishwasher").map((r) => money(r.total));
    expect(dishwashers).toEqual(["$650.50", "$650.50", "$650.50", "$650.50"]);
    expect(money(38400)).toBe("$38,400.00");
    expect(moneyColumn([1400, 38400])(38400)).toBe("$38,400");
    expect(moneyColumn([956.9999999999999])(956.9999999999999)).toBe("$957");
  });

  it("prints prices as entered, even below a cent", () => {
    expect(formatPrice(1400)).toBe("$1,400");
    expect(formatPrice(0.25)).toBe("$0.25");
    expect(formatPrice(0.125)).toBe("$0.125");
    expect(formatPrice(1400.1)).toBe("$1,400.10");
  });

  it("puts the unit next to area quantities and prices", () => {
    expect(formatQuantity({ quantity: 9600, unit: "sq ft" })).toBe("9,600 sq ft");
    expect(formatQuantity({ quantity: 12, unit: "each" })).toBe("12");
    expect(formatCostEach({ costEach: 0.125, unit: "sq ft" })).toBe("$0.125/sq ft");
    expect(formatCostEach({ costEach: 4200, unit: "each" })).toBe("$4,200");
    expect(formatCostEach({ costEach: null, unit: "each" })).toBe("");
  });
});

describe("long words in PDF notes", () => {
  it("leaves ordinary words whole", () => {
    expect(longWordParts("furnace")).toEqual(["furnace"]);
    expect(longWordParts("x".repeat(LONG_WORD))).toEqual(["x".repeat(LONG_WORD)]);
  });

  it("splits a long run, such as a link, into pieces that can wrap", () => {
    const link = "https://example.com/photos/unit-3/furnace-label.jpg";
    const parts = longWordParts(link);
    expect(parts.join("")).toBe(link);
    expect(parts.every((p) => p.length <= LONG_WORD)).toBe(true);
    expect(parts).toHaveLength(Math.ceil(link.length / LONG_WORD));
  });

  it("never splits an emoji in half", () => {
    const parts = longWordParts("🙂".repeat(LONG_WORD + 1));
    expect(parts).toEqual(["🙂".repeat(LONG_WORD), "🙂"]);
  });
});

describe("export details", () => {
  const formRows: ExportFormRow[] = [
    { id: "furnace", name: "Gas furnace", category: "HVAC", unitLabel: "per_unit" },
    { id: "carpet", name: "Carpet", category: "Flooring", unitLabel: "per_sq_ft" },
    { id: "boiler", name: "  Boiler ", category: "HVAC", unitLabel: "per_building" },
    { id: "blank", name: "   ", category: "Other", unitLabel: "per_building" },
  ];
  const details = exportDetails(formRows, [{ id: "furnace" }, { id: "carpet" }]);

  it("lists the form rows the forecast left out, in form order", () => {
    expect(details.leftOut).toEqual([
      { name: "Boiler", category: "HVAC", condition: null, notes: "" },
      { name: "Unnamed component", category: "Other", condition: null, notes: "" },
    ]);
    expect(exportDetails(formRows.slice(0, 2), [{ id: "furnace" }, { id: "carpet" }]).leftOut).toEqual([]);
  });

  it("keeps each row's unit, so area items print sq ft", () => {
    expect(details.unitLabels?.get("carpet")).toBe("per_sq_ft");
    const withUnits = exportRows(forecast, components, details.unitLabels);
    expect(withUnits.find((r) => r.name === "Carpet")?.unit).toBe("sq ft");
    expect(withUnits.find((r) => r.name === "Gas furnace")?.unit).toBe("each");
  });
});

describe("condition, notes and guessed install years in exports", () => {
  const formRows: ExportFormRow[] = [
    { id: "furnace", name: "Gas furnace", category: "HVAC", unitLabel: "per_unit", installYear: "2012", installYearIsGuess: true, condition: "fair", notes: "  Noisy fan.  " },
    { id: "carpet", name: "Carpet", category: "Flooring", unitLabel: "per_sq_ft", installYear: "2020" },
    // Ticked, but no year typed: year built stands in, so it's "estimated", not a guess.
    { id: "wh", name: "Water heater", category: "Plumbing", unitLabel: "per_unit", installYear: " ", installYearIsGuess: true, condition: "poor" },
    { id: "boiler", name: "Boiler", category: "HVAC", unitLabel: "per_building", notes: "Get a quote\nbefore winter", condition: null },
    { id: "dw", name: "Dishwasher", category: "Appliances", unitLabel: "per_unit", notes: "   " },
  ];
  const details = exportDetails(formRows, components);
  const withDetails = exportRows(forecast, components, details.unitLabels, details.rowDetails);

  it("counts a ticked guess only when an install year was typed", () => {
    expect(guessedYear({ installYear: "2012", installYearIsGuess: true })).toBe(true);
    expect(guessedYear({ installYear: "", installYearIsGuess: true })).toBe(false);
    expect(guessedYear({ installYear: "2012", installYearIsGuess: false })).toBe(false);
    expect(guessedYear({ installYear: "2012" })).toBe(false);
    expect(details.rowDetails?.get("furnace")).toEqual({ condition: "fair", notes: "Noisy fan.", installYearIsGuess: true });
    expect(details.rowDetails?.get("wh")).toEqual({ condition: "poor", notes: "", installYearIsGuess: false });
  });

  it("says why an install year is an estimate", () => {
    expect(installYearNote(false, { installYearIsGuess: true })).toBe("");
    expect(installYearNote(true, { installYearIsGuess: true })).toBe(GUESS_NOTE);
    expect(installYearNote(true, { installYearIsGuess: false })).toBe(ESTIMATED_NOTE);
    expect(installYearNote(true, undefined)).toBe(ESTIMATED_NOTE);
  });

  it("puts each component's condition and notes on its rows, and names guessed years", () => {
    expect(withDetails.find((r) => r.name === "Gas furnace")).toMatchObject({
      notes: [GUESS_NOTE],
      condition: "fair",
      ownerNotes: "Noisy fan.",
    });
    expect(withDetails.find((r) => r.name === "Water heater" && r.year === 2026)).toMatchObject({
      notes: ["Overdue", ESTIMATED_NOTE],
      condition: "poor",
      ownerNotes: "",
    });
    expect(withDetails.find((r) => r.name === "Carpet")).toMatchObject({ notes: [], condition: null, ownerNotes: "" });
  });

  it("lists the rows with a condition or notes, in form order, for the PDF", () => {
    expect(details.conditionNotes).toEqual([
      { name: "Gas furnace", condition: "fair", notes: "Noisy fan." },
      { name: "Water heater", condition: "poor", notes: "" },
      { name: "Boiler", condition: null, notes: "Get a quote\nbefore winter" },
    ]);
  });

  it("keeps condition and notes on rows left out of the forecast", () => {
    expect(details.leftOut).toEqual([{ name: "Boiler", category: "HVAC", condition: null, notes: "Get a quote\nbefore winter" }]);
  });

  it("works for rows from before condition and notes existed", () => {
    const old = exportDetails([{ id: "carpet", name: "Carpet", category: "Flooring", unitLabel: "per_sq_ft" }], components);
    expect(old.rowDetails?.get("carpet")).toEqual({ condition: null, notes: "", installYearIsGuess: false });
    expect(old.conditionNotes).toEqual([]);
  });
});

describe("left-out summary", () => {
  it("names what the figures leave out", () => {
    expect(leftOutSummary([])).toBe("");
    expect(leftOutSummary([{ name: "Boiler", category: "HVAC" }])).toBe(
      "1 component isn't included yet: Boiler. Its details aren't complete, so the figures here leave it out.",
    );
    expect(
      leftOutSummary([
        { name: "Boiler", category: "HVAC" },
        { name: "Carpet", category: "Flooring" },
      ]),
    ).toBe(
      "2 components aren't included yet: Boiler and Carpet. Their details aren't complete, so the figures here leave them out.",
    );
    const many = ["A", "B", "C", "D", "E", "F", "G"].map((name) => ({ name, category: "Other" }));
    expect(leftOutSummary(many)).toMatch(/^7 components aren't included yet: A, B, C, D, E and 2 more\./);
  });
});
