import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPONENT_LIBRARY, TYPICAL_COSTS } from "../components";

const supabase = (file: string) => readFileSync(join(__dirname, "../../../../supabase", file), "utf8");

describe("component library seed", () => {
  const rows = [
    ...supabase("seed.sql").matchAll(
      /\('([^']+)', '([^']+)', '([^']+)', (\d+), (\d+), '([^']+)', (\d+), ([\d.]+), ([\d.]+), '([^']+)'\)/g,
    ),
  ];

  it("matches the library the calculator uses", () => {
    expect(
      rows.map((m) => ({ slug: m[1], category: m[2], name: m[3], lifeLow: Number(m[4]), lifeHigh: Number(m[5]), unitLabel: m[6] })),
    ).toEqual(COMPONENT_LIBRARY);
  });

  it("carries the same typical costs as the built-in list", () => {
    expect(rows.map((m) => ({ slug: m[1], low: Number(m[8]), high: Number(m[9]), per: m[10] }))).toEqual(TYPICAL_COSTS);
  });
});

describe("typical costs update (0005)", () => {
  it("fills in the same typical costs as the built-in list", () => {
    const rows = [...supabase("migrations/0005_typical_costs.sql").matchAll(/\('([^']+)', ([\d.]+), ([\d.]+), '([^']+)'\)/g)];
    expect(rows.map((m) => ({ slug: m[1], low: Number(m[2]), high: Number(m[3]), per: m[4] }))).toEqual(TYPICAL_COSTS);
  });

  it("gives every built-in component a typical cost", () => {
    expect(TYPICAL_COSTS.map((c) => c.slug)).toEqual(COMPONENT_LIBRARY.map((c) => c.slug));
  });

  it("keeps every built-in cost inside the database check", () => {
    for (const c of TYPICAL_COSTS) {
      expect(c.low).toBeGreaterThanOrEqual(0);
      expect(c.low).toBeLessThanOrEqual(c.high);
      expect(c.high).toBeLessThan(1e9);
    }
  });

  it("prices sq ft items per sq ft and everything else per apartment", () => {
    const unitLabel = new Map(COMPONENT_LIBRARY.map((c) => [c.slug, c.unitLabel]));
    for (const c of TYPICAL_COSTS) expect(c.per === "sq_ft").toBe(unitLabel.get(c.slug) === "per_sq_ft");
  });
});
