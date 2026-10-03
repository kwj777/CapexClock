import { TYPICAL_COST_SOURCES, typicalCostBasis } from "../typical-cost-sources";
import { TYPICAL_COSTS } from "../typical-costs";

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

  it("adds up where it's a price plus the cost of fitting it", () => {
    // "a $1,500–$8,000 panel, plus $1,500–$2,000 to install and program it (our estimate), ÷ 12 apartments"
    // should give about $250–$850.
    const pattern = /^(?:.*?([\d,]+) [^×$]*× )?[^$]*\$([\d,.]+)–\$([\d,.]+)[^$]*plus \$([\d,.]+)–\$([\d,.]+)(.*÷ 12 apartments)?/;
    const n = (text: string | undefined) => Number((text ?? "1").replace(/,/g, ""));
    let checked = 0;
    for (const c of TYPICAL_COSTS) {
      const match = pattern.exec(typicalCostBasis(c) ?? "");
      if (!match) continue;
      const share = match[6] ? 12 : 1;
      expect((n(match[1]) * n(match[2]) + n(match[4])) / share / c.low).toBeCloseTo(1, 1);
      expect((n(match[1]) * n(match[3]) + n(match[5])) / share / c.high).toBeCloseTo(1, 1);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(4);
  });

  it("says which figures are our own estimate rather than the source's", () => {
    const basis = (slug: string) => typicalCostBasis(TYPICAL_COSTS.find((c) => c.slug === slug)!);
    // The fire alarm source prices the panel only; fitting it is ours.
    expect(basis("fire-alarm-panel")).toBe("a $1,500–$8,000 panel, plus $1,500–$2,000 to install and program it (our estimate), ÷ 12 apartments");
    expect(basis("parking-lot-resurface")).toMatch(/^our estimate/);
    expect(basis("gutters")).toContain("(our estimate)");
  });

  it("isn't shown for a cost edited in the dashboard, which no longer matches the working", () => {
    expect(typicalCostBasis({ slug: "vinyl-windows", low: 4000, high: 8000, per: "apartment" })).toBeNull();
    expect(typicalCostBasis({ slug: "carpet", low: 3, high: 6, per: "apartment" })).toBeNull();
    expect(typicalCostBasis({ slug: "elevator", low: 30000, high: 60000, per: "apartment" })).toBeNull();
  });
});
