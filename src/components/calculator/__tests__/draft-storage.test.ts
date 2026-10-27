import { EMPTY_DRAFT, type Draft } from "@/verticals/landlord";
import { ARRIVAL_KEY, clearArrival, peekArrival, saveArrival, STORAGE_KEY } from "../draft-storage";
import { DRAFT_STORAGE_KEY } from "../storage-key";

describe("where the draft is kept", () => {
  it("is the key the loader reads to size its placeholder", () => {
    expect(STORAGE_KEY).toBe(DRAFT_STORAGE_KEY);
  });
});

describe("the note that a lifespan page added a row", () => {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  beforeAll(() => {
    (globalThis as { window?: unknown }).window = { sessionStorage };
  });
  afterAll(() => {
    delete (globalThis as { window?: unknown }).window;
  });
  beforeEach(() => store.clear());

  const draftWith = (...ids: string[]) => ({ ...EMPTY_DRAFT, rows: ids.map((id) => ({ id }) as Draft["rows"][number]) });

  it("is offered while its row is in the list, until it's cleared", () => {
    saveArrival({ rowId: "r1", name: "your gas furnace" });
    expect(peekArrival(draftWith("r0", "r1"))).toEqual({ rowId: "r1", name: "your gas furnace" });
    expect(peekArrival(draftWith("r0"))).toBeNull();
    clearArrival();
    expect(peekArrival(draftWith("r0", "r1"))).toBeNull();
  });

  it("ignores anything else kept under its key", () => {
    for (const bad of ["not json", "null", '{"rowId":1,"name":"x"}']) {
      store.set(ARRIVAL_KEY, bad);
      expect(peekArrival(draftWith("r1"))).toBeNull();
    }
  });
});
