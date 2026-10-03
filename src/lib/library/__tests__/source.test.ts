import { TYPICAL_COSTS } from "@/verticals/landlord";
import { getLibrary, getTypicalCosts } from "../source";

const row = (slug: unknown, extra: Record<string, unknown> = {}) => ({
  slug,
  category: "HVAC",
  name: "Boiler",
  default_useful_life_low: 20,
  default_useful_life_high: 30,
  default_unit_label: "per_building",
  ...extra,
});

const cost = (slug: unknown, low: unknown, high: unknown, per: unknown) => ({
  slug,
  typical_cost_low: low,
  typical_cost_high: high,
  typical_cost_per: per,
});

describe("loading typical costs and lifespans", () => {
  const env = { ...process.env };
  const realFetch = global.fetch;
  const dbLibrary = [row("elevator", { name: "Elevator", category: "Other" })];

  // Answers like PostgREST: asking for a column that doesn't exist yet is a 400.
  function fakeSupabase(costColumns: "missing" | "present" | "blank" | "no rows" | "down") {
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      if (costColumns === "down") throw new TypeError("fetch failed");
      const url = String(input);
      if (url.includes("typical_cost")) {
        if (costColumns === "missing") {
          return Response.json({ code: "42703", message: "column component_library.typical_cost_low does not exist" }, { status: 400 });
        }
        if (costColumns === "no rows") return Response.json([]);
        return Response.json([
          costColumns === "blank" ? cost("elevator", null, null, null) : cost("elevator", 30000, 60000, "apartment"),
        ]);
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

  it("leaves every cost out when they've all been blanked in the dashboard", async () => {
    fakeSupabase("blank");
    expect(await getTypicalCosts()).toEqual([]);
  });

  it("falls back to the built-in costs when the library has no rows, as the lifespans do", async () => {
    fakeSupabase("no rows");
    expect(await getTypicalCosts()).toEqual(TYPICAL_COSTS);
  });

  it("falls back to the built-in costs when Supabase can't be reached or isn't set up", async () => {
    fakeSupabase("down");
    expect(await getTypicalCosts()).toEqual(TYPICAL_COSTS);
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(await getTypicalCosts()).toEqual(TYPICAL_COSTS);
  });
});
