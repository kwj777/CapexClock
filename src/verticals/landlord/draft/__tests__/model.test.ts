import { COMPONENT_LIBRARY } from "../../library/components";
import { toComponents } from "../components";
import { exampleDraft } from "../example";
import { cleanDetails, upgradeDraft, type Draft, type DraftRow } from "../model";
import {
  detailsShown,
  detailsSummary,
  editRow,
  notesLeftText,
  notesTooLong,
  rowFromLibrary,
  withUnitCount,
} from "../rows";

const waterHeater = COMPONENT_LIBRARY.find((c) => c.slug === "tank-water-heater")!;
const roof = COMPONENT_LIBRARY.find((c) => c.slug === "asphalt-shingle-roof")!;

/** Types a unit count one keystroke at a time, the way the input's onChange sees it. */
function typeUnitCount(draft: Draft, ...values: string[]): Draft {
  return values.reduce(withUnitCount, draft);
}

describe("condition, notes and a guessed install year", () => {
  const row = { ...rowFromLibrary(waterHeater, "12"), installYear: "2016", costEach: "1400" };

  it("treats a ticked guess as an estimate, like a blank year", () => {
    const draft = (r: DraftRow): Draft => ({ unitCount: "12", yearBuilt: "1998", rows: [r] });
    expect(toComponents(draft(row), 2026).components[0].installYearIsEstimate).toBe(false);
    expect(toComponents(draft({ ...row, installYearIsGuess: true }), 2026).components[0]).toMatchObject({
      installYear: 2016,
      installYearIsEstimate: true,
    });
    expect(toComponents(draft({ ...row, installYear: "" }), 2026).components[0]).toMatchObject({
      installYear: 1998,
      installYearIsEstimate: true,
    });
  });

  it("leaves the math alone: condition and notes don't change the forecast", () => {
    const plain = toComponents({ unitCount: "12", yearBuilt: "", rows: [row] }, 2026).components;
    const noted = toComponents(
      { unitCount: "12", yearBuilt: "", rows: [{ ...row, condition: "poor", notes: "Leaking" }] },
      2026,
    ).components;
    expect(noted).toEqual(plain);
  });

  it("keeps them when other fields change", () => {
    const noted: DraftRow = { ...row, condition: "fair", notes: "Leaking", installYearIsGuess: true };
    expect(editRow(noted, { quantity: "10" }, "12")).toMatchObject({ condition: "fair", notes: "Leaking", installYearIsGuess: true });
    expect(withUnitCount({ unitCount: "12", yearBuilt: "", rows: [noted] }, "14").rows[0]).toMatchObject({
      quantity: "14",
      condition: "fair",
      notes: "Leaking",
    });
  });

  it("loads drafts saved before they existed", () => {
    const legacy: Draft = {
      unitCount: "12",
      yearBuilt: "",
      rows: [{ id: "a", librarySlug: null, category: "Plumbing", name: "Water heaters", quantity: "12", unitLabel: "per_unit", installYear: "2016", usefulLife: "10", costEach: "1400", scenario: "run_to_failure" }],
    };
    const upgraded = upgradeDraft(legacy, 2026);
    expect(upgraded.rows[0]).not.toHaveProperty("condition");
    expect(upgraded.rows[0]).not.toHaveProperty("notes");
    expect(toComponents(upgraded, 2026).components[0].installYearIsEstimate).toBe(false);
    expect(detailsSummary(upgraded.rows[0])).toBe("");
  });

  it("drops stored values the calculator couldn't have written", () => {
    const damaged = { ...row, condition: "excellent", notes: 42, installYearIsGuess: "yes" } as unknown as DraftRow;
    const cleaned = cleanDetails(damaged);
    expect(cleaned).not.toHaveProperty("condition");
    expect(cleaned).not.toHaveProperty("notes");
    expect(cleaned).not.toHaveProperty("installYearIsGuess");
    expect(cleaned.name).toBe(row.name);
    const upgraded = upgradeDraft({ unitCount: "12", yearBuilt: "", rows: [damaged] }, 2026);
    expect(upgraded.rows[0]).not.toHaveProperty("condition");
    // Good values, and no values, come back as they were.
    const good: DraftRow = { ...row, condition: null, notes: "", installYearIsGuess: false };
    expect(cleanDetails(good)).toBe(good);
    expect(cleanDetails(row)).toBe(row);
  });

  it("sums up what's behind More", () => {
    expect(detailsSummary({ condition: "fair", notes: "Leaking" })).toBe("Fair, notes");
    expect(detailsSummary({ condition: "poor", notes: "  " })).toBe("Poor");
    expect(detailsSummary({ condition: null, notes: "x" })).toBe("notes");
    expect(detailsSummary({})).toBe("");
  });

  it("counts down the last 200 characters of notes", () => {
    expect(notesLeftText("")).toBeNull();
    expect(notesLeftText("x".repeat(1799))).toBeNull();
    expect(notesLeftText("x".repeat(1800))).toBe("200 characters left");
    expect(notesLeftText("x".repeat(1999))).toBe("1 character left");
    expect(notesLeftText("x".repeat(2000))).toBe("0 characters left");
  });

  it("shows condition and notes as the owner chose, or while the notes need fixing", () => {
    expect(detailsShown(null, false)).toBe(false);
    expect(detailsShown(null, true)).toBe(true);
    // Less closes them even while the notes need fixing, and More opens them.
    expect(detailsShown(false, true)).toBe(false);
    expect(detailsShown(true, false)).toBe(true);
  });

  it("says how far over the limit kept notes are, counting an emoji as one", () => {
    expect(notesTooLong("x".repeat(2000))).toBe(false);
    expect(notesTooLong("x".repeat(2001))).toBe(true);
    expect(notesLeftText("x".repeat(2001))).toBe("1 character over the 2,000 limit");
    expect(notesLeftText("x".repeat(2100))).toBe("100 characters over the 2,000 limit");
    // 1,500 emoji are 3,000 code units but 1,500 characters, which a save takes.
    expect(notesTooLong("🙂".repeat(1500))).toBe(false);
    expect(notesLeftText("🙂".repeat(1500))).toBe("0 characters left");
    expect(notesTooLong("🙂".repeat(2001))).toBe(true);
  });
});

describe("drafts saved before the follow flag", () => {
  it("treat per-unit rows at the unit count as following it, and others as set by hand", () => {
    const legacy: Draft = {
      unitCount: "12",
      yearBuilt: "",
      rows: [
        { id: "a", librarySlug: null, category: "Plumbing", name: "Water heaters", quantity: "12", unitLabel: "per_unit", installYear: "", usefulLife: "10", costEach: "", scenario: "run_to_failure" },
        { id: "b", librarySlug: null, category: "Appliances", name: "Washer", quantity: "1", unitLabel: "per_unit", installYear: "", usefulLife: "12", costEach: "", scenario: "run_to_failure" },
      ],
    };
    const upgraded = upgradeDraft(legacy, 2026);
    expect(upgraded.rows.map((r) => r.followsUnitCount)).toEqual([true, false]);
    expect(typeUnitCount(upgraded, "1", "14").rows.map((r) => r.quantity)).toEqual(["14", "1"]);
  });

  it("fill a blank per-unit quantity from the unit count, as they did before", () => {
    const legacy: Draft = {
      unitCount: "12",
      yearBuilt: "",
      rows: [
        { id: "a", librarySlug: null, category: "Plumbing", name: "Water heaters", quantity: "", unitLabel: "per_unit", installYear: "", usefulLife: "10", costEach: "", scenario: "run_to_failure" },
        { id: "b", librarySlug: null, category: "Flooring", name: "Carpet", quantity: "", unitLabel: "per_sq_ft", installYear: "", usefulLife: "8", costEach: "", scenario: "run_to_failure" },
      ],
    };
    const upgraded = upgradeDraft(legacy, 2026);
    expect(upgraded.rows.map((r) => r.followsUnitCount)).toEqual([true, false]);
    expect(withUnitCount(upgraded, "14").rows.map((r) => r.quantity)).toEqual(["14", ""]);
  });

  it("leave rows that already have the flag as they are", () => {
    const blankOnPurpose: DraftRow = { ...rowFromLibrary(waterHeater, "12"), quantity: "", followsUnitCount: false };
    const upgraded = upgradeDraft({ unitCount: "12", yearBuilt: "", rows: [blankOnPurpose] }, 2026);
    expect(upgraded.rows[0].followsUnitCount).toBe(false);
  });

  it("count a forecast the older draft already showed as tracked", () => {
    expect(upgradeDraft(exampleDraft(), 2026).forecastTracked).toBe(true);
    expect(upgradeDraft({ unitCount: "", yearBuilt: "", rows: [rowFromLibrary(roof, "")] }, 2026).forecastTracked).toBe(false);
    expect(upgradeDraft({ ...exampleDraft(), forecastTracked: false }, 2026).forecastTracked).toBe(false);
  });

  it("the example follows its unit count", () => {
    const draft = exampleDraft();
    const next = withUnitCount(draft, "14");
    expect(next.rows.filter((r) => r.unitLabel === "per_unit").map((r) => r.quantity)).toEqual(["14", "14", "14"]);
  });
});
