import { exampleDraft } from "@/components/calculator/draft";
import type { ComponentRow, PropertyRow } from "@/lib/supabase/database.types";
import { toSaveInput } from "../convert";
import {
  compareSaved,
  lacksUpdate0004,
  matchesSaved,
  sameSave,
  saveFailure,
  sendsDetails,
  versionFromReadBack,
  withSavedIds,
} from "../save";

describe("telling save failures apart", () => {
  it("spots an ended session", () => {
    expect(saveFailure({ code: "42501" }, 401)).toBe("signed_out");
    expect(saveFailure({ code: "PGRST303" }, 401)).toBe("signed_out");
    expect(saveFailure({ code: "PGRST301" }, 401)).toBe("signed_out");
  });

  it("spots a save from another tab or device", () => {
    expect(saveFailure({ code: "PT409" }, 409)).toBe("conflict");
  });

  it("spots a deleted property", () => {
    expect(saveFailure({ code: "P0002" }, 400)).toBe("deleted");
  });

  it("spots values the database won't take", () => {
    expect(saveFailure({ code: "23514" }, 400)).toBe("rejected");
    expect(saveFailure({ code: "22003" }, 400)).toBe("rejected");
    expect(saveFailure({ code: "42501" }, 403)).toBe("rejected");
  });

  it("treats anything else as a connection problem", () => {
    expect(saveFailure({ code: "" }, 0)).toBe("network");
    expect(saveFailure(null, 503)).toBe("network");
    expect(saveFailure({ code: "57014" }, 500)).toBe("network");
  });
});

describe("after a save", () => {
  const dbIds = ["c0000000-0000-4000-8000-000000000000", "c0000000-0000-4000-8000-000000000001"];

  it("gives new rows their database ids", () => {
    const sent = exampleDraft();
    sent.rows = sent.rows.slice(0, 2);
    const saved = withSavedIds(sent, sent, dbIds);
    expect(saved.rows.map((r) => r.id)).toEqual(dbIds);
    expect(saved.rows[0].name).toBe(sent.rows[0].name);
  });

  it("keeps edits made while the save was in flight", () => {
    const sent = exampleDraft();
    sent.rows = sent.rows.slice(0, 2);
    const added = exampleDraft().rows[2];
    const current = {
      ...sent,
      rows: [{ ...sent.rows[0], costEach: "4700" }, sent.rows[1], added],
    };
    const merged = withSavedIds(current, sent, dbIds);
    expect(merged.rows.map((r) => r.id)).toEqual([...dbIds, added.id]);
    expect(merged.rows[0].costEach).toBe("4700");
  });

  it("returns the same draft when nothing changes", () => {
    const sent = exampleDraft();
    const ids = sent.rows.map((r) => r.id);
    expect(withSavedIds(sent, sent, ids)).toBe(sent);
  });

  it("checks that the database holds what was sent", () => {
    const draft = exampleDraft();
    draft.rows = draft.rows.slice(0, 2);
    const input = toSaveInput("Maple Court", draft, 2026, "a0000000-0000-4000-8000-000000000001");
    const rows: ComponentRow[] = input.components.map((c, i) => ({
      ...c,
      id: dbIds[i],
      property_id: "a0000000-0000-4000-8000-000000000001",
      condition: null,
      notes: null,
      created_at: "",
      updated_at: "",
    }));
    const property = { name: "Maple Court", unit_count: 12, year_built: 1998 };
    expect(matchesSaved(input, property, [...rows].reverse())).toBe(true);
    expect(matchesSaved(input, { ...property, name: "Other tab" }, rows)).toBe(false);
    expect(matchesSaved(input, property, rows.slice(1))).toBe(false);
    expect(matchesSaved(input, property, [{ ...rows[0], replacement_cost_each: 1 }, rows[1]])).toBe(false);
  });
});

describe("telling whether condition and notes were saved", () => {
  const propertyId = "a0000000-0000-4000-8000-000000000001";
  const draft = exampleDraft();
  draft.rows = [
    { ...draft.rows[0], condition: "poor", notes: "Leaks", installYearIsGuess: true },
    draft.rows[1],
  ];
  const input = toSaveInput("Maple Court", draft, 2026, propertyId);
  const property = { name: "Maple Court", unit_count: 12, year_built: 1998 };
  // What the database holds after update 0004: exactly what was sent.
  const after0004: ComponentRow[] = input.components.map((c, i) => ({
    ...c,
    id: `c0000000-0000-4000-8000-00000000000${i}`,
    property_id: propertyId,
    created_at: "",
    updated_at: "",
  }));
  // Before it: the condition and notes it already had (none), and no flag column at all.
  const before0004: ComponentRow[] = after0004.map((row) => {
    const old: ComponentRow = { ...row, condition: null, notes: null };
    delete old.install_year_is_estimate;
    return old;
  });

  it("finds everything saved after update 0004", () => {
    expect(compareSaved(input, property, after0004)).toBe("same");
    expect(matchesSaved(input, property, after0004)).toBe(true);
    expect(lacksUpdate0004(after0004)).toBe(false);
  });

  it("spots condition and notes a database without update 0004 dropped", () => {
    expect(compareSaved(input, property, before0004)).toBe("without_details");
    expect(matchesSaved(input, property, before0004)).toBe(false);
    expect(lacksUpdate0004(before0004)).toBe(true);
  });

  it("spots each of the three on its own", () => {
    const [row, other] = after0004;
    expect(compareSaved(input, property, [{ ...row, condition: "fair" }, other])).toBe("without_details");
    expect(compareSaved(input, property, [{ ...row, notes: null }, other])).toBe("without_details");
    expect(compareSaved(input, property, [{ ...row, install_year_is_estimate: false }, other])).toBe("without_details");
  });

  it("reads a missing flag as not a guess, so rows without details still match", () => {
    const plain = toSaveInput("Maple Court", exampleDraft(), 2026, propertyId);
    const rows = plain.components.map(
      (c, i): ComponentRow => ({
        id: `c0000000-0000-4000-8000-00000000001${i}`,
        property_id: propertyId,
        library_slug: c.library_slug,
        category: c.category,
        name: c.name,
        quantity: c.quantity,
        unit_label: c.unit_label,
        install_year: c.install_year,
        useful_life_years: c.useful_life_years,
        replacement_cost_each: c.replacement_cost_each,
        condition: null,
        notes: null,
        scenario: c.scenario,
        sort_order: c.sort_order,
        created_at: "",
        updated_at: "",
      }),
    );
    expect(compareSaved(plain, property, rows)).toBe("same");
    expect(sendsDetails(plain)).toBe(false);
    expect(sendsDetails(input)).toBe(true);
  });

  it("still calls any other difference someone else's save", () => {
    expect(compareSaved(input, { ...property, name: "Other tab" }, before0004)).toBe("different");
    expect(compareSaved(input, property, [{ ...before0004[0], replacement_cost_each: 1 }, before0004[1]])).toBe(
      "different",
    );
    expect(compareSaved(input, property, before0004.slice(1))).toBe("different");
  });

  it("uses the version when the last save's condition and notes were dropped, but not when someone changed them", () => {
    const back = (components: ComponentRow[]) => ({
      property: {
        id: propertyId,
        user_id: "u0000000-0000-4000-8000-000000000001",
        city: null,
        state: null,
        created_at: "",
        updated_at: "2026-09-28T10:00:00.123456+00:00",
        ...property,
      },
      components,
    });
    expect(versionFromReadBack(input, back(before0004))).toEqual({ updatedAt: "2026-09-28T10:00:00.123456+00:00" });
    // After update 0004 the database keeps them, so different ones were saved by someone else.
    expect(versionFromReadBack(input, back([{ ...after0004[0], notes: "Other tab" }, after0004[1]]))).toEqual({
      failure: "conflict",
    });
  });
});

describe("checking the version when the last save couldn't read it back", () => {
  const propertyId = "a0000000-0000-4000-8000-000000000001";
  const draft = exampleDraft();
  draft.rows = draft.rows.slice(0, 2);
  const lastSaved = toSaveInput("Maple Court", draft, 2026, propertyId);
  const components: ComponentRow[] = lastSaved.components.map((c, i) => ({
    ...c,
    id: `c0000000-0000-4000-8000-00000000000${i}`,
    property_id: propertyId,
    condition: null,
    notes: null,
    created_at: "",
    updated_at: "",
  }));
  const property: PropertyRow = {
    id: propertyId,
    user_id: "u0000000-0000-4000-8000-000000000001",
    name: "Maple Court",
    city: null,
    state: null,
    unit_count: 12,
    year_built: 1998,
    created_at: "",
    updated_at: "2026-09-28T10:00:00.123456+00:00",
  };

  it("uses the database's version when it holds what was saved", () => {
    expect(versionFromReadBack(lastSaved, { property, components })).toEqual({
      updatedAt: "2026-09-28T10:00:00.123456+00:00",
    });
  });

  it("refuses when another tab or device saved since", () => {
    expect(versionFromReadBack(lastSaved, { property: { ...property, name: "Other tab" }, components })).toEqual({
      failure: "conflict",
    });
    expect(versionFromReadBack(lastSaved, { property, components: components.slice(1) })).toEqual({
      failure: "conflict",
    });
  });

  it("refuses when the property is gone or can't be read", () => {
    expect(versionFromReadBack(lastSaved, { property: null, components: [] })).toEqual({ failure: "deleted" });
    expect(versionFromReadBack(lastSaved, null)).toEqual({ failure: "network" });
  });
});

describe("telling whether two sets of edits save the same thing", () => {
  const propertyId = "a0000000-0000-4000-8000-000000000001";
  const draft = exampleDraft();
  const input = (name: string, d = draft) => toSaveInput(name, d, 2026, propertyId);

  it("ignores row ids and how numbers were typed", () => {
    const retyped = {
      ...draft,
      rows: draft.rows.map((r, i) => ({ ...r, id: `c0000000-0000-4000-8000-00000000000${i}` })),
    };
    retyped.rows[0] = { ...retyped.rows[0], costEach: "$38,000" };
    expect(sameSave(input("Maple Court"), input("Maple Court", retyped))).toBe(true);
    expect(sameSave(input("Maple Court "), toSaveInput("Maple Court", draft, 2026))).toBe(true);
  });

  it("spots any real change", () => {
    const cheaper = { ...draft, rows: [{ ...draft.rows[0], costEach: "37000" }, ...draft.rows.slice(1)] };
    expect(sameSave(input("Maple Court"), input("Maple Court", cheaper))).toBe(false);
    expect(sameSave(input("Maple Court"), input("Oak Court"))).toBe(false);
    expect(sameSave(input("Maple Court"), input("Maple Court", { ...draft, rows: draft.rows.slice(1) }))).toBe(false);
    expect(sameSave(input("Maple Court"), input("Maple Court", { ...draft, rows: [...draft.rows].reverse() }))).toBe(false);
    expect(sameSave(input("Maple Court"), input("Maple Court", { ...draft, unitCount: "13" }))).toBe(false);
  });

  it("never calls edits with something to fix the same", () => {
    const unfinished = { ...draft, rows: [...draft.rows, { ...draft.rows[0], id: "row-new", quantity: "" }] };
    expect(sameSave(input("Maple Court", unfinished), input("Maple Court", unfinished))).toBe(false);
  });
});
