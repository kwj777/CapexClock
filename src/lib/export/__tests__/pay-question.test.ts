import { alreadyAsked, nextStep, PAY_ANSWERS, PAY_QUESTION_VERSION, remember, versioned } from "../pay-question";

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

describe("pay question events", () => {
  it("carry the question's version, so a changed question is counted apart", () => {
    expect(versioned({ answer: "yes", trigger: "pdf" })).toEqual({ answer: "yes", trigger: "pdf", version: "2" });
    expect(versioned({ pick: "report", answer: "maybe" }).version).toBe(PAY_QUESTION_VERSION);
  });
});

describe("what the pay question shows next", () => {
  it("asks until it's answered or dismissed", () => {
    expect(nextStep(null, null)).toBe("question");
  });

  it("asks which idea they'd use first after a Yes or a Maybe", () => {
    expect(nextStep("Yes", null)).toBe("first_pick");
    expect(nextStep("Maybe", null)).toBe("first_pick");
  });

  it("thanks them once they pick one or skip", () => {
    expect(nextStep("Yes", "report")).toBe("thanks");
    expect(nextStep("Maybe", "other")).toBe("thanks");
    expect(nextStep("Yes", "skipped")).toBe("thanks");
  });

  it("thanks a No straight away, with no second question", () => {
    expect(nextStep("No", null)).toBe("thanks");
  });

  it("shows nothing more once dismissed", () => {
    expect(nextStep("dismissed", null)).toBe("none");
  });

  it("offers the same three answers as before", () => {
    expect(PAY_ANSWERS).toEqual(["Yes", "Maybe", "No"]);
  });
});
