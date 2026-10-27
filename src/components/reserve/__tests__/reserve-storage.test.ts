import { parseSavedExpenses, parseSavedQuick } from "../reserve-storage";

describe("reading the reserve calculator's saved fields", () => {
  it("reads what it saved", () => {
    const quick = { units: "4", yearBuilt: "1998", ticked: ["carpet"] };
    expect(parseSavedQuick(JSON.stringify(quick))).toEqual(quick);
    const expenses = { rows: [{ name: "Roof", cost: "40000", years: "2" }], balance: "5000", units: "" };
    expect(parseSavedExpenses(JSON.stringify(expenses))).toEqual(expenses);
  });

  it("ignores anything missing, corrupt or the wrong shape", () => {
    for (const raw of [null, "", "{", "null", "[]", '{"units":4,"yearBuilt":"","ticked":[]}', '{"units":"","yearBuilt":"","ticked":[1]}']) {
      expect(parseSavedQuick(raw)).toBeNull();
    }
    for (const raw of [null, "{", '{"rows":[],"balance":"","units":""}', '{"rows":[{"cost":1}],"balance":"","units":""}']) {
      expect(parseSavedExpenses(raw)).toBeNull();
    }
  });

  it("drops rows it can't read and keeps the rest", () => {
    const raw = JSON.stringify({ rows: [{ name: "", cost: "1", years: "2", extra: true }, { cost: 5 }], balance: "", units: "" });
    expect(parseSavedExpenses(raw)?.rows).toEqual([{ name: "", cost: "1", years: "2" }]);
  });
});
