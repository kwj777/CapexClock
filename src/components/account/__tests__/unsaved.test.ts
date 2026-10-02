import { EMPTY_DRAFT, exampleDraft } from "@/components/calculator/draft";
import {
  clearAllUnsaved,
  KEEP_UNSAVED_MS,
  keptPropertyIds,
  nothingToRestore,
  opensAnotherApp,
  parseUnsaved,
  unsavedKey,
  wasDropped,
} from "../unsaved";

const now = Date.UTC(2026, 8, 28);

describe("unsaved property edits", () => {
  it("reads back edits kept earlier", () => {
    const edits = { name: "Maple Court", draft: exampleDraft(), baseUpdatedAt: "2026-09-28T10:00:00.123456+00:00", keptAt: now - 1000 };
    expect(parseUnsaved(JSON.stringify(edits), now)).toEqual(edits);
  });

  it("brings back condition and notes, dropping values the calculator couldn't have written", () => {
    const draft = exampleDraft();
    draft.rows[0] = { ...draft.rows[0], condition: "fair", notes: "Leaks", installYearIsGuess: true };
    const edits = { name: "Maple Court", draft, baseUpdatedAt: null, keptAt: now };
    expect(parseUnsaved(JSON.stringify(edits), now)?.draft.rows[0]).toMatchObject({
      condition: "fair",
      notes: "Leaks",
      installYearIsGuess: true,
    });
    const damaged = JSON.stringify(edits).replace('"condition":"fair"', '"condition":"mint"');
    expect(parseUnsaved(damaged, now)?.draft.rows[0]).not.toHaveProperty("condition");
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

  it("keeps work brought in from the calculator apart from a property added by hand", () => {
    expect(unsavedKey("user-a", undefined, true)).toBe("user-a:calculator");
    expect(unsavedKey("user-a", undefined, true)).not.toBe(unsavedKey("user-a", undefined));
  });

  it("remembers which calculator work an import started from", () => {
    const edits = { name: "", draft: exampleDraft(), baseUpdatedAt: null, calculator: '{"rows":[]}', keptAt: now };
    expect(parseUnsaved(JSON.stringify(edits), now)).toEqual(edits);
    expect(parseUnsaved(JSON.stringify({ ...edits, calculator: 1 }), now)).toBeNull();
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
      "capexclock:unsaved:v1:user-a:calculator": kept(now),
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

describe("keeping edits across tabs", () => {
  const key = unsavedKey("user-a", "p1");

  it("notices when another tab drops this copy or clears storage", () => {
    expect(wasDropped({ key: "capexclock:unsaved:v1:user-a:p1", newValue: null }, key)).toBe(true);
    expect(wasDropped({ key: null, newValue: null }, key)).toBe(true);
  });

  it("ignores other keys, new values, and a page that keeps nothing", () => {
    expect(wasDropped({ key: "capexclock:unsaved:v1:user-a:p2", newValue: null }, key)).toBe(false);
    expect(wasDropped({ key: "capexclock:unsaved:v1:user-a:p1", newValue: "{}" }, key)).toBe(false);
    expect(wasDropped({ key: null, newValue: null }, null)).toBe(false);
  });
});

describe("deciding whether kept edits need bringing back", () => {
  const draft = exampleDraft();

  it("drops edits that match the page, however the rows are numbered", () => {
    expect(nothingToRestore({ name: "Maple Court", draft }, "Maple Court", draft, 2026)).toBe(true);
    // Saved while the owner was away: new rows got database ids.
    const fromDb = { ...draft, rows: draft.rows.map((r, i) => ({ ...r, id: `c0000000-0000-4000-8000-00000000000${i}` })) };
    expect(nothingToRestore({ name: "Maple Court", draft }, "Maple Court", fromDb, 2026)).toBe(true);
  });

  it("drops an untouched import, even with rows still to finish", () => {
    const calculator = { ...draft, rows: [...draft.rows, { ...draft.rows[0], id: "row-x", quantity: "" }] };
    expect(nothingToRestore({ name: "", draft: calculator }, "", calculator, 2026)).toBe(true);
  });

  it("brings back a changed condition or notes", () => {
    const draft = exampleDraft();
    const noted = { ...draft, rows: [{ ...draft.rows[0], notes: "Leaks" }, ...draft.rows.slice(1)] };
    expect(nothingToRestore({ name: "Maple Court", draft: noted }, "Maple Court", draft, 2026)).toBe(false);
    const guessed = { ...draft, rows: [{ ...draft.rows[0], installYearIsGuess: true }, ...draft.rows.slice(1)] };
    expect(nothingToRestore({ name: "Maple Court", draft: guessed }, "Maple Court", draft, 2026)).toBe(false);
  });

  it("brings back real changes", () => {
    const edited = { ...draft, rows: [{ ...draft.rows[0], costEach: "41000" }, ...draft.rows.slice(1)] };
    expect(nothingToRestore({ name: "Maple Court", draft: edited }, "Maple Court", draft, 2026)).toBe(false);
    expect(nothingToRestore({ name: "Maple Court edited", draft }, "Maple Court", draft, 2026)).toBe(false);
    expect(nothingToRestore({ name: "Old half typed", draft: EMPTY_DRAFT }, "", EMPTY_DRAFT, 2026)).toBe(false);
    const unfinished = { ...draft, rows: [...draft.rows, { ...draft.rows[0], id: "row-y", quantity: "" }] };
    expect(nothingToRestore({ name: "Maple Court", draft: unfinished }, "Maple Court", draft, 2026)).toBe(false);
  });
});

describe("opensAnotherApp", () => {
  it("is true for links that open the mail app, a call or a text", () => {
    expect(opensAnotherApp("mailto:support@capexclock.com?subject=Photo%20of%20a%20label")).toBe(true);
    expect(opensAnotherApp("mailto:support@capexclock.com")).toBe(true);
    expect(opensAnotherApp("tel:+15555550100")).toBe(true);
    expect(opensAnotherApp("sms:+15555550100")).toBe(true);
  });

  it("is false for pages, here or elsewhere, and for anything it can't read", () => {
    expect(opensAnotherApp("http://localhost:3000/app")).toBe(false);
    expect(opensAnotherApp("https://buy.stripe.com/test_m")).toBe(false);
    expect(opensAnotherApp("/app")).toBe(false);
    expect(opensAnotherApp("")).toBe(false);
  });
});
