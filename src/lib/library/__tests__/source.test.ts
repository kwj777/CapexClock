import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPONENT_LIBRARY, TYPICAL_COSTS } from "../components";
import { getLibrary, getTypicalCosts, parseLibraryRows, parseTypicalCostRows, SLUG_PATTERN } from "../source";
import { TYPICAL_COST_SOURCES, typicalCostBasis } from "../typical-cost-sources";

const row = (slug: unknown, extra: Record<string, unknown> = {}) => ({
  slug,
  category: "HVAC",
  name: "Boiler",
  default_useful_life_low: 20,
  default_useful_life_high: 30,
  default_unit_label: "per_building",
  ...extra,
});

describe("component library rows from Supabase", () => {
  it("maps valid rows and skips malformed ones", () => {
    const rows = [
      row("boiler"),
      row("Bad Slug"),
      row("backwards", { default_useful_life_low: 9, default_useful_life_high: 2 }),
      row("odd-unit", { default_unit_label: "per_room" }),
      null,
    ];
    expect(parseLibraryRows(rows)).toEqual([
      { slug: "boiler", category: "HVAC", name: "Boiler", lifeLow: 20, lifeHigh: 30, unitLabel: "per_building" },
    ]);
  });

  it("says why each row was skipped", () => {
    const reasons: string[] = [];
    const items = parseLibraryRows(
      [
        row("Elevator"),
        row("hydraulic_elevator"),
        row("elevator "),
        row("elevator-2"),
        row("blank-name", { name: "  " }),
        row("blank-category", { category: "" }),
        row("punctuation-name", { name: "?" }),
        row("note-only", { name: "(misc)" }),
        row("backwards", { default_useful_life_low: 9, default_useful_life_high: 2 }),
        row("odd-unit", { default_unit_label: "per_room" }),
      ],
      (reason) => reasons.push(reason),
    );
    expect(items.map((c) => c.slug)).toEqual(["elevator-2", "note-only"]);
    expect(reasons).toEqual([
      'Skipped component_library row "Elevator": the slug must be lower-case letters, numbers and hyphens only.',
      'Skipped component_library row "hydraulic_elevator": the slug must be lower-case letters, numbers and hyphens only.',
      'Skipped component_library row "elevator ": the slug must be lower-case letters, numbers and hyphens only.',
      'Skipped component_library row "blank-name": the name and category each need at least one letter or number.',
      'Skipped component_library row "blank-category": the name and category each need at least one letter or number.',
      'Skipped component_library row "punctuation-name": the name and category each need at least one letter or number.',
      'Skipped component_library row "backwards": the useful life must run from low to high, between 1 and 100 years.',
      'Skipped component_library row "odd-unit": the unit label must be per_unit, per_building or per_sq_ft.',
    ]);
  });

  it("accepts every seeded component", () => {
    const rows = COMPONENT_LIBRARY.map((c) =>
      row(c.slug, {
        category: c.category,
        name: c.name,
        default_useful_life_low: c.lifeLow,
        default_useful_life_high: c.lifeHigh,
        default_unit_label: c.unitLabel,
      }),
    );
    expect(parseLibraryRows(rows)).toEqual(COMPONENT_LIBRARY);
  });

  it("uses the same slug rule as the database check", () => {
    const dir = join(__dirname, "../../../../supabase/migrations");
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .join("\n");
    const check = sql.match(/check \(slug ~ '([^']+)'\)/);
    expect(check?.[1]).toBe(SLUG_PATTERN.source);
    expect(sql).toContain("check (name ~ '[[:alnum:]]' and category ~ '[[:alnum:]]')");
  });

  it("returns nothing for a non-array response", () => {
    expect(parseLibraryRows({ message: "error" })).toEqual([]);
  });
});

const cost = (slug: unknown, low: unknown, high: unknown, per: unknown) => ({
  slug,
  typical_cost_low: low,
  typical_cost_high: high,
  typical_cost_per: per,
});

describe("typical costs from Supabase", () => {
  it("maps valid rows and leaves out rows without a typical cost", () => {
    expect(
      parseTypicalCostRows([
        cost("boiler", 1100, 2900, "apartment"),
        cost("carpet", 3, 6, "sq_ft"),
        cost("seal-coat", 0.15, 0.3, "sq_ft"),
        cost("free", 0, 0, "apartment"),
        cost("no-cost", null, null, null),
      ]),
    ).toEqual([
      { slug: "boiler", low: 1100, high: 2900, per: "apartment" },
      { slug: "carpet", low: 3, high: 6, per: "sq_ft" },
      { slug: "seal-coat", low: 0.15, high: 0.3, per: "sq_ft" },
      { slug: "free", low: 0, high: 0, per: "apartment" },
    ]);
  });

  it("says why each malformed row was skipped", () => {
    const reasons: string[] = [];
    const costs = parseTypicalCostRows(
      [
        cost("backwards", 900, 200, "apartment"),
        cost("negative", -1, 200, "apartment"),
        cost("huge", 1, 1e9, "apartment"),
        cost("text", "200", "400", "apartment"),
        cost("half-blank", 200, null, "apartment"),
        cost("no-per", 200, 400, null),
        cost("per-building", 200, 400, "building"),
      ],
      (reason) => reasons.push(reason),
    );
    expect(costs).toEqual([]);
    const range = "the typical cost must run from low to high, from 0 to under 1 billion";
    const per = "typical_cost_per must be apartment or sq_ft";
    expect(reasons).toEqual([
      `Skipped the typical cost of component_library row "backwards": ${range}.`,
      `Skipped the typical cost of component_library row "negative": ${range}.`,
      `Skipped the typical cost of component_library row "huge": ${range}.`,
      `Skipped the typical cost of component_library row "text": ${range}.`,
      `Skipped the typical cost of component_library row "half-blank": ${range}.`,
      `Skipped the typical cost of component_library row "no-per": ${per}.`,
      `Skipped the typical cost of component_library row "per-building": ${per}.`,
    ]);
  });

  it("leaves rows with a bad slug out quietly, since the library already reports them", () => {
    const reasons: string[] = [];
    expect(parseTypicalCostRows([cost("Bad Slug", 1, 2, "apartment"), null, "row"], (r) => reasons.push(r))).toEqual([]);
    expect(reasons).toEqual([]);
  });

  it("accepts every built-in cost", () => {
    const rows = TYPICAL_COSTS.map((c) => cost(c.slug, c.low, c.high, c.per));
    expect(parseTypicalCostRows(rows)).toEqual(TYPICAL_COSTS);
  });

  it("uses the same limits as the database check", () => {
    const sql = readFileSync(join(__dirname, "../../../../supabase/migrations/0005_typical_costs.sql"), "utf8");
    expect(sql).toContain("typical_cost_per in ('apartment', 'sq_ft')");
    expect(sql).toContain("typical_cost_low >= 0");
    expect(sql).toContain("typical_cost_low <= typical_cost_high");
    expect(sql).toContain("typical_cost_high < 1e9");
  });

  it("returns nothing for a non-array response", () => {
    expect(parseTypicalCostRows({ message: "error" })).toEqual([]);
  });
});

describe("loading typical costs and lifespans", () => {
  const env = { ...process.env };
  const realFetch = global.fetch;
  const dbLibrary = [row("elevator", { name: "Elevator", category: "Other" })];

  // Answers like PostgREST: asking for a column that doesn't exist yet is a 400.
  function fakeSupabase(costColumns: "missing" | "present" | "down") {
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      if (costColumns === "down") throw new TypeError("fetch failed");
      const url = String(input);
      if (url.includes("typical_cost")) {
        return costColumns === "missing"
          ? Response.json({ code: "42703", message: "column component_library.typical_cost_low does not exist" }, { status: 400 })
          : Response.json([cost("elevator", 30000, 60000, "apartment")]);
      }
      return Response.json(dbLibrary);
    }) as typeof fetch;
  }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:8000";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "key";
  });
  afterEach(() => {
    process.env = { ...env };
    global.fetch = realFetch;
  });

  it("falls back to the built-in costs before update 0005, and keeps the dashboard's lifespans", async () => {
    fakeSupabase("missing");
    expect(await getTypicalCosts()).toEqual(TYPICAL_COSTS);
    expect((await getLibrary()).map((c) => c.slug)).toEqual(["elevator"]);
  });

  it("uses the dashboard's costs once update 0005 has run", async () => {
    fakeSupabase("present");
    expect(await getTypicalCosts()).toEqual([{ slug: "elevator", low: 30000, high: 60000, per: "apartment" }]);
  });

  it("falls back to the built-in costs when Supabase can't be reached or isn't set up", async () => {
    fakeSupabase("down");
    expect(await getTypicalCosts()).toEqual(TYPICAL_COSTS);
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(await getTypicalCosts()).toEqual(TYPICAL_COSTS);
  });
});

describe("where the typical costs come from", () => {
  it("names a source for every built-in typical cost, linked over https", () => {
    for (const { slug } of TYPICAL_COSTS) {
      const sources = TYPICAL_COST_SOURCES.get(slug);
      expect(sources?.length).toBeGreaterThan(0);
      for (const s of sources ?? []) expect(s.url).toMatch(/^https:\/\//);
    }
    expect([...TYPICAL_COST_SOURCES.keys()]).toEqual(TYPICAL_COSTS.map((c) => c.slug));
  });
});

describe("how each typical cost was worked out", () => {
  it("explains every built-in cost that isn't straight from its source", () => {
    const without = TYPICAL_COSTS.filter((c) => typicalCostBasis(c) === null).map((c) => c.slug);
    expect(without).toEqual(["parking-lot-seal-coat"]);
    expect(typicalCostBasis(TYPICAL_COSTS.find((c) => c.slug === "vinyl-windows")!)).toBe("8 windows × $400–$900");
  });

  it("multiplies out to the cost it explains, give or take rounding", () => {
    // "7,000 sq ft of roof × $4.50–$8, ..., ÷ 12 apartments" should give about $2,600–$4,700.
    const pattern = /^(?:an? |one )?([\d,]+)[^×]*× \$([\d.]+)–\$([\d.]+)(?!.*plus)(.*÷ 12 apartments)?/;
    let checked = 0;
    for (const c of TYPICAL_COSTS) {
      const match = pattern.exec(typicalCostBasis(c) ?? "");
      if (!match) continue;
      const count = Number(match[1].replace(/,/g, ""));
      const share = match[4] ? 12 : 1;
      expect((count * Number(match[2])) / share / c.low).toBeCloseTo(1, 1);
      expect((count * Number(match[3])) / share / c.high).toBeCloseTo(1, 1);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(8);
  });

  it("isn't shown for a cost edited in the dashboard, which no longer matches the working", () => {
    expect(typicalCostBasis({ slug: "vinyl-windows", low: 4000, high: 8000, per: "apartment" })).toBeNull();
    expect(typicalCostBasis({ slug: "carpet", low: 3, high: 6, per: "apartment" })).toBeNull();
    expect(typicalCostBasis({ slug: "elevator", low: 30000, high: 60000, per: "apartment" })).toBeNull();
  });
});
