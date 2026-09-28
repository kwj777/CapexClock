import { exampleDraft } from "@/components/calculator/draft";
import type { ComponentRow } from "@/lib/supabase/database.types";
import { toSaveInput } from "../convert";
import { matchesSaved, saveFailure, withSavedIds } from "../save";

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
