import { RESERVE_TABS, tabAfterKey, tabFromSearch, tabHref } from "../tabs";

const at = (search: string, hash = "") => ({ pathname: "/reserve-calculator", search, hash });

describe("the reserve calculator's tab in the address", () => {
  it("opens the quick estimate unless the address asks for the expense list", () => {
    expect(tabFromSearch("")).toBe("quick");
    expect(tabFromSearch("?tab=expenses")).toBe("expenses");
    expect(tabFromSearch("?utm_source=forum&tab=expenses")).toBe("expenses");
    expect(tabFromSearch("?tab=quick")).toBe("quick");
    expect(tabFromSearch("?tab=nonsense")).toBe("quick");
  });

  it("writes the tab into the address, keeping everything else", () => {
    expect(tabHref(at(""), "expenses")).toBe("/reserve-calculator?tab=expenses");
    expect(tabHref(at("?tab=expenses"), "quick")).toBe("/reserve-calculator");
    expect(tabHref(at("?utm_source=forum", "#faq-heading"), "expenses")).toBe(
      "/reserve-calculator?utm_source=forum&tab=expenses#faq-heading",
    );
    expect(tabHref(at("?utm_source=forum&tab=expenses"), "quick")).toBe("/reserve-calculator?utm_source=forum");
  });

  it("reads back the tab it wrote", () => {
    for (const tab of RESERVE_TABS) {
      const href = tabHref(at("?ref=1"), tab);
      expect(tabFromSearch(href.slice(href.indexOf("?")))).toBe(tab);
    }
  });
});

describe("moving between tabs with the keyboard", () => {
  it("follows the arrow keys, wrapping around, and Home and End", () => {
    expect(tabAfterKey("quick", "ArrowRight")).toBe("expenses");
    expect(tabAfterKey("expenses", "ArrowRight")).toBe("quick");
    expect(tabAfterKey("quick", "ArrowLeft")).toBe("expenses");
    expect(tabAfterKey("expenses", "ArrowLeft")).toBe("quick");
    expect(tabAfterKey("expenses", "Home")).toBe("quick");
    expect(tabAfterKey("quick", "End")).toBe("expenses");
  });

  it("ignores other keys, so Tab and Enter work as usual", () => {
    for (const key of ["Tab", "Enter", " ", "ArrowDown", "a"]) expect(tabAfterKey("quick", key)).toBeNull();
  });
});
