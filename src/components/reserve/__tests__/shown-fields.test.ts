import { readReserveInputs } from "@/verticals/landlord";
import { shownFields } from "../shown-fields";

const row = (cost: string, years: string, id = 1) => ({ id, cost, years });

describe("when a row's problem shows", () => {
  it("waits until the owner has left the field that needs fixing", () => {
    const halfDone = readReserveInputs([row("60000", "")], "", "").rowProblems.get(1);
    // Typing a cost, then moving on to the years field: nothing flagged yet.
    expect(shownFields(halfDone, new Set(["cost"]))).toEqual([]);
    // Leaving the years blank flags the years field only.
    expect(shownFields(halfDone, new Set(["cost", "years"]))).toEqual(["years"]);
  });

  it("flags only the unreadable field", () => {
    const badCost = readReserveInputs([row("1.4k", "5")], "", "").rowProblems.get(1);
    expect(shownFields(badCost, new Set(["cost", "years"]))).toEqual(["cost"]);
    expect(shownFields(undefined, new Set(["cost", "years"]))).toEqual([]);
  });
});
