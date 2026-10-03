import { readQuickInputs } from "@/verticals/landlord";
import { ENTER_PROMPT, estimateText, FIX_PROMPT, quickPrompt, TICK_PROMPT } from "../estimate-text";

describe("the quick estimate as shown", () => {
  it("rounds each end up to the next $5 and multiplies the rounded figure out for the building", () => {
    expect(estimateText({ perUnit: { low: 172.4, high: 377.9 }, systems: 18 }, 12)).toEqual({
      perUnit: "$175–$380",
      building: "$2,100–$4,560",
      spoken: "About $175 to $380 per unit each month, or $2,100 to $4,560 for the building, from typical costs.",
    });
  });

  it("shows one figure when both ends round the same", () => {
    expect(estimateText({ perUnit: { low: 91, high: 94.5 }, systems: 1 }, 1)).toMatchObject({ perUnit: "$95", building: "$95" });
  });
});

describe("what shows before there's an estimate", () => {
  const read = (units: string, year: string) => readQuickInputs(units, year, 2026);

  it("asks for what's missing, and doesn't say fix while the year is still being typed", () => {
    expect(quickPrompt(read("", ""), false)).toBe(ENTER_PROMPT);
    for (const partYear of ["1", "19", "199"]) {
      // The year can't be used yet, but it isn't marked until the owner leaves the field.
      expect(read("12", partYear).yearBuiltProblem).not.toBeNull();
      expect(quickPrompt(read("12", partYear), false)).toBe(ENTER_PROMPT);
    }
  });

  it("says fix once a field is marked", () => {
    expect(quickPrompt(read("12", "199"), true)).toBe(FIX_PROMPT);
    expect(quickPrompt(read("12.5", ""), false)).toBe(FIX_PROMPT);
    expect(quickPrompt(read("1e308", "1998"), false)).toBe(FIX_PROMPT);
  });

  it("asks for a tick when the fields are fine but nothing can be priced", () => {
    expect(quickPrompt(read("12", "1998"), false)).toBe(TICK_PROMPT);
  });
});
