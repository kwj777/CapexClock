import { alreadyAsked, remember } from "../pay-question";

function memoryStore() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const blocked = {
  getItem: (): string | null => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("pay question memory", () => {
  it("asks in a fresh browser, and never again once it has been shown", () => {
    const store = memoryStore();
    expect(alreadyAsked(store)).toBe(false);
    remember("shown", store);
    expect(alreadyAsked(store)).toBe(true);
  });

  it("counts an answer or a dismissal as asked", () => {
    for (const value of ["Yes", "dismissed"]) {
      const store = memoryStore();
      remember(value, store);
      expect(alreadyAsked(store)).toBe(true);
    }
  });

  it("carries on when storage is blocked or missing", () => {
    expect(alreadyAsked(blocked)).toBe(false);
    expect(() => remember("shown", blocked)).not.toThrow();
    expect(alreadyAsked(null)).toBe(false);
    expect(() => remember("shown", null)).not.toThrow();
    // No browser at all, as when the page is rendered on the server.
    expect(alreadyAsked()).toBe(false);
  });
});
