import { shownEvent, SHOWN_AFTER_MS } from "../estimate-shown";

describe("when the quick estimate counts as shown", () => {
  it("waits on an estimate in the tab that's showing, with how many systems it covers", () => {
    expect(shownEvent(7, true, false)).toEqual({ systems: 7 });
    expect(shownEvent(1, true, false)).toEqual({ systems: 1 });
  });

  it("waits for nothing without an estimate", () => {
    expect(shownEvent(null, true, false)).toBeNull();
  });

  it("waits for nothing while the expense list is the tab showing, even with a range restored", () => {
    expect(shownEvent(7, false, false)).toBeNull();
  });

  it("goes once per page view", () => {
    expect(shownEvent(7, true, true)).toBeNull();
    expect(shownEvent(7, false, true)).toBeNull();
  });

  it("waits 2 seconds, as the dashboard notes say", () => {
    expect(SHOWN_AFTER_MS).toBe(2000);
  });
});
