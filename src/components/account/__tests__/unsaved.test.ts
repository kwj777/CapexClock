import { exampleDraft } from "@/components/calculator/draft";
import { clearAllUnsaved, KEEP_UNSAVED_MS, keptPropertyIds, parseUnsaved, unsavedKey } from "../unsaved";

const now = Date.UTC(2026, 8, 28);

describe("unsaved property edits", () => {
  it("reads back edits kept earlier", () => {
    const edits = { name: "Maple Court", draft: exampleDraft(), baseUpdatedAt: "2026-09-28T10:00:00.123456+00:00", keptAt: now - 1000 };
    expect(parseUnsaved(JSON.stringify(edits), now)).toEqual(edits);
  });

  it("keeps edits to a property that isn't saved yet", () => {
    const edits = { name: "", draft: exampleDraft(), baseUpdatedAt: null, keptAt: now };
    expect(parseUnsaved(JSON.stringify(edits), now)?.baseUpdatedAt).toBeNull();
  });

  it("keeps each account's edits apart", () => {
    const property = "8f5a2b9e-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
    expect(unsavedKey("user-a", undefined)).toBe("user-a:new");
    expect(unsavedKey("user-a", property)).toBe(`user-a:${property}`);
    expect(unsavedKey("user-b", undefined)).not.toBe(unsavedKey("user-a", undefined));
    // Without an account nothing is kept.
    expect(unsavedKey(null, property)).toBeNull();
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

/** A stand-in for localStorage. */
function memoryStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    removeItem: (key: string) => void map.delete(key),
    keys: () => [...map.keys()],
  };
}

describe("kept edits in the browser", () => {
  const kept = (keptAt: number) =>
    JSON.stringify({ name: "x", draft: exampleDraft(), baseUpdatedAt: null, keptAt });

  it("lists the saved properties an account has unsaved edits for", () => {
    const storage = memoryStorage({
      "capexclock:unsaved:v1:user-a:p2": kept(now),
      "capexclock:unsaved:v1:user-a:p1": kept(now),
      "capexclock:unsaved:v1:user-a:new": kept(now),
      "capexclock:unsaved:v1:user-a:old": kept(now - KEEP_UNSAVED_MS - 1),
      "capexclock:unsaved:v1:user-a:bad": "{not json",
      "capexclock:unsaved:v1:user-b:p3": kept(now),
      "capexclock:calculator:v1": "{}",
    });
    expect(keptPropertyIds(storage, "user-a", now)).toEqual(["p1", "p2"]);
    expect(keptPropertyIds(storage, "user-b", now)).toEqual(["p3"]);
    expect(keptPropertyIds(storage, "user-c", now)).toEqual([]);
  });

  it("drops every account's kept edits on sign-out, and nothing else", () => {
    const storage = memoryStorage({
      "capexclock:unsaved:v1:user-a:p1": kept(now),
      "capexclock:unsaved:v1:user-a:new": kept(now),
      "capexclock:unsaved:v1:user-b:p3": kept(now),
      "capexclock:calculator:v1": "{}",
    });
    clearAllUnsaved(storage);
    expect(storage.keys()).toEqual(["capexclock:calculator:v1"]);
  });
});
