import { estimateText } from "../estimate-text";

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
