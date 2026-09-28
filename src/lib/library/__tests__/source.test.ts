import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPONENT_LIBRARY } from "../components";
import { parseLibraryRows, SLUG_PATTERN } from "../source";

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
