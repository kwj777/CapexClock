import { guardFormulas, removeFormulaGuards } from "../formula-guard";

describe("guarding formulas in our CSV files", () => {
  const cases = [
    "=HYPERLINK(\"x\")",
    "+1 555 0100",
    "-5 degrees",
    "@SUM(A1)",
    'x;"=HYPERLINK(1);',
    "Line one\n=cmd",
    "\tstarts with a tab",
    "Plain text, no formula",
    "Roof - patched 2019",
  ];

  it("puts an apostrophe before anything a spreadsheet app could run", () => {
    expect(guardFormulas("=1+2")).toBe("'=1+2");
    expect(guardFormulas("Fridge; =1+2")).toBe("Fridge; '=1+2");
    expect(guardFormulas("Roof - patched 2019")).toBe("Roof - patched 2019");
  });

  it.each(cases)("takes the apostrophes off again when the file is read back: %j", (text) => {
    expect(removeFormulaGuards(guardFormulas(text))).toBe(text);
  });

  it("leaves apostrophes the owner typed", () => {
    expect(removeFormulaGuards("Owner's unit")).toBe("Owner's unit");
    expect(removeFormulaGuards("'Quoted'")).toBe("'Quoted'");
  });
});
