import { exampleDraft } from "@/components/calculator/draft";
import { KEEP_UNSAVED_MS, parseUnsaved, unsavedKey } from "../unsaved";

const now = Date.UTC(2026, 8, 28);

describe("unsaved property edits", () => {
  it("reads back edits kept earlier", () => {
    const edits = { name: "Maple Court", draft: exampleDraft(), baseUpdatedAt: "2026-09-28T10:00:00.123456+00:00", keptAt: now - 1000 };
    expect(parseUnsaved(JSON.stringify(edits), now)).toEqual(edits);
  });

  it("keeps edits to a property that isn't saved yet", () => {
    const edits = { name: "", draft: exampleDraft(), baseUpdatedAt: null, keptAt: now };
    expect(parseUnsaved(JSON.stringify(edits), now)?.baseUpdatedAt).toBeNull();
    expect(unsavedKey(undefined)).toBe("new");
    expect(unsavedKey("8f5a2b9e-1c3d-4e5f-8a9b-0c1d2e3f4a5b")).toBe("8f5a2b9e-1c3d-4e5f-8a9b-0c1d2e3f4a5b");
  });

  it("drops edits older than a week", () => {
    const edits = { name: "x", draft: exampleDraft(), baseUpdatedAt: null, keptAt: now - KEEP_UNSAVED_MS - 1 };
    expect(parseUnsaved(JSON.stringify(edits), now)).toBeNull();
  });

  it("ignores missing, corrupt or wrongly shaped data", () => {
    expect(parseUnsaved(null, now)).toBeNull();
    expect(parseUnsaved("{not json", now)).toBeNull();
    expect(parseUnsaved(JSON.stringify({ name: "x", draft: { rows: "no" }, baseUpdatedAt: null, keptAt: now }), now)).toBeNull();
    expect(parseUnsaved(JSON.stringify({ name: 1, draft: exampleDraft(), baseUpdatedAt: null, keptAt: now }), now)).toBeNull();
  });
});
