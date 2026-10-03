import type { Component } from "@/engine";
import type { Vertical } from "../../vertical";
import { landlord, type LandlordFacts, type LandlordMetrics, type LibraryComponent, type PortfolioMetrics } from "..";
import { landlordForecast } from "../forecast";
import { countNoun, LANDLORD_LABELS } from "../labels";
import { COMPONENT_LIBRARY, defaultLife } from "../library/components";
import { LANDLORD_RULES } from "../rules";

describe("the landlord vertical", () => {
  it("is a Vertical: its id, words, library, lives and rules", () => {
    const v: Vertical<LibraryComponent, LandlordFacts, LandlordMetrics, PortfolioMetrics> = landlord;
    expect(v.id).toBe("landlord");
    expect(v.labels).toBe(LANDLORD_LABELS);
    expect(v.library).toBe(COMPONENT_LIBRARY);
    expect(v.defaultLife).toBe(defaultLife);
    expect(v.rules).toBe(LANDLORD_RULES);
  });

  it("works out its metrics from the engine's forecast and the unit count", () => {
    const roof: Component = { id: "r", category: "Roofing", name: "Roof", quantity: 1, installYear: 2016, usefulLifeYears: 20, replacementCostEach: 120000 };
    const group = { id: "g", name: "Maple Court", components: [roof] };
    const result = landlordForecast(group.components, 10, 2026);
    expect(landlord.derivedMetrics({ group, result, facts: { unitCount: 10 } })).toEqual({ monthlyReservePerUnit: 100 });
    expect(landlord.rollupMetrics([{ group, result, facts: { unitCount: 0 } }])).toEqual({ perUnit: null, missingUnitIds: ["g"] });
  });
});

describe("the landlord's words", () => {
  it("picks the singular for exactly 1, the plural otherwise", () => {
    expect(countNoun(LANDLORD_LABELS.divisor, 1)).toBe("unit");
    for (const n of [0, 2, 2.5, 12, 1.5]) expect(countNoun(LANDLORD_LABELS.divisor, n)).toBe("units");
    expect(countNoun(LANDLORD_LABELS.assetGroup, 1)).toBe("property");
    expect(countNoun(LANDLORD_LABELS.assetGroup, 3)).toBe("properties");
  });

  it("has the audience's terms", () => {
    expect(Object.keys(LANDLORD_LABELS.terms)).toEqual(["unit", "door", "apartment", "building"]);
    for (const noun of Object.values(LANDLORD_LABELS.terms)) expect(noun.many.startsWith(noun.one)).toBe(true);
  });
});

describe("the landlord's library", () => {
  it("has unique slugs and whole-year lives from 1 to 100, low to high", () => {
    expect(new Set(COMPONENT_LIBRARY.map((c) => c.slug)).size).toBe(COMPONENT_LIBRARY.length);
    for (const c of COMPONENT_LIBRARY) {
      expect(Number.isInteger(c.lifeLow) && Number.isInteger(c.lifeHigh)).toBe(true);
      expect(c.lifeLow).toBeGreaterThanOrEqual(1);
      expect(c.lifeHigh).toBeLessThanOrEqual(100);
      expect(c.lifeLow).toBeLessThanOrEqual(c.lifeHigh);
    }
  });

  it("uses the middle of the range, rounded, when the owner hasn't typed a life", () => {
    for (const c of COMPONENT_LIBRARY) {
      const life = defaultLife(c);
      expect(Number.isInteger(life)).toBe(true);
      expect(life).toBeGreaterThanOrEqual(c.lifeLow);
      expect(life).toBeLessThanOrEqual(c.lifeHigh);
    }
    expect(defaultLife({ slug: "x", category: "Other", name: "x", lifeLow: 5, lifeHigh: 10, unitLabel: "per_unit" })).toBe(8);
  });
});
