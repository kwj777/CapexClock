import { COMPONENT_LIBRARY } from "../components";
import { subjectFor, titleCase } from "../phrasing";

describe("subjectFor", () => {
  it("picks an/a and handles plurals", () => {
    const bySlug = (s: string) => subjectFor(COMPONENT_LIBRARY.find((c) => c.slug === s)!);
    expect(bySlug("asphalt-shingle-roof").noun).toBe("an asphalt shingle roof");
    expect(bySlug("tank-water-heater").noun).toBe("a tank water heater");
    expect(bySlug("vinyl-windows")).toEqual({ noun: "vinyl windows", plural: true });
  });

  it("never leaves slashes or parentheses in a sentence", () => {
    for (const c of COMPONENT_LIBRARY) expect(subjectFor(c).noun).not.toMatch(/[/()]/);
  });

  it("falls back for components added later in Supabase", () => {
    const s = subjectFor({ slug: "new-thing", category: "Other", name: "Elevator (hydraulic)", lifeLow: 20, lifeHigh: 30, unitLabel: "per_building" });
    expect(s.noun).toBe("an elevator");
    expect(titleCase("a flat or membrane roof")).toBe("a Flat or Membrane Roof");
  });
});
