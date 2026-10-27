import { budgetSummaryEmail, reminderEmail } from "../templates";
import type { BudgetProperty, BudgetSummary, ReminderItem } from "@/verticals/landlord";

const footer = { kind: "budget_summary" as const, unsubscribeUrl: "https://capexclock.com/email/unsubscribe?t=x" };

function summary(budgetYearTotal: number): BudgetSummary {
  return {
    budgetYear: 2027,
    properties: [
      {
        propertyId: "p1",
        name: "14 Maple",
        unitCount: 2,
        budgetYearTotal,
        budgetYearItems: budgetYearTotal ? [{ name: "Roof", cost: budgetYearTotal, overdue: false }] : [],
        tenYearTotal: 42_000,
        savingAhead: [],
        monthlyReserve: 350,
        monthlyReservePerUnit: 175,
        atRiskCount: 0,
        excluded: 0,
        leftOut: [],
        componentCount: 1,
      },
    ],
    totals: { budgetYearTotal, tenYearTotal: 42_000, monthlyReserve: 350, atRiskCount: 0 },
  };
}

describe("budgetSummaryEmail", () => {
  it("puts next year's total in the subject", () => {
    const email = budgetSummaryEmail(summary(9_000), footer);
    expect(email.subject).toBe("Your 2027 replacement budget: $9,000");
    expect(email.text).toContain("In 2027, plan on $9,000 for replacements across your property, and $42,000 over the next 10 years.");
  });

  it("says nothing is due instead of a $0 budget", () => {
    const email = budgetSummaryEmail(summary(0), footer);
    expect(email.subject).toBe("Nothing to replace in 2027");
    expect(email.text).toContain(
      "Nothing across your property is due for replacement in 2027. Over the next 10 years, plan on $42,000.",
    );
    expect(email.text).not.toContain("plan on $0");
  });
});

const MAPLE: BudgetProperty = {
  propertyId: "p1",
  name: "Maple Court",
  unitCount: 24,
  budgetYearTotal: 181_900,
  budgetYearItems: [
    { name: "Vinyl siding", cost: 140_000, overdue: false },
    { name: "Roof", cost: 41_900, overdue: true },
    { name: "Gutters", cost: 0, overdue: false },
  ],
  tenYearTotal: 412_000,
  savingAhead: [],
  monthlyReserve: 4_334,
  monthlyReservePerUnit: 180.58,
  atRiskCount: 6,
  excluded: 1,
  leftOut: [{ componentId: "w", name: "Windows", missing: "cost", endOfLifeYear: 2023, replaceNow: false }],
  componentCount: 4,
};

const one = (p: BudgetProperty): BudgetSummary => ({
  budgetYear: 2027,
  properties: [p],
  totals: {
    budgetYearTotal: p.budgetYearTotal,
    tenYearTotal: p.tenYearTotal,
    monthlyReserve: p.monthlyReserve,
    atRiskCount: p.atRiskCount,
  },
});

describe("budgetSummaryEmail, the whole story", () => {
  it("says the monthly figure starts the year after, names what's left out and flags $0", () => {
    const email = budgetSummaryEmail(one(MAPLE), footer);
    expect(email.subject).toBe("Your 2027 replacement budget: $181,900 (1 more needs a cost)");
    expect(email.text).toContain(
      "Pay the 2027 items from savings you already have, since there's no time to save for them. To cover replacements from 2028 on, set aside $4,334 a month.",
    );
    expect(email.text).toContain("from 2028 on, looking 30 years ahead.");
    expect(email.text).toContain("Left out until you add a cost: Windows (no replacement cost entered, past its end of life since 2023).");
    expect(email.text).toContain("Gutters $0 (check the cost)");
    expect(email.text).toContain("- At risk (overdue or due within 2 years): 6");
    expect(email.html).toContain('href="https://capexclock.com/app/properties/p1">Maple Court</a> to keep these numbers right');
  });

  it("never says nothing to replace while items are left out", () => {
    const email = budgetSummaryEmail(
      one({
        ...MAPLE,
        budgetYearTotal: 0,
        budgetYearItems: [],
        tenYearTotal: 0,
        monthlyReserve: 0,
        monthlyReservePerUnit: 0,
        atRiskCount: 0,
        excluded: 2,
        componentCount: 2,
        leftOut: [
          { componentId: "r", name: "Roof", missing: "cost", endOfLifeYear: 2010, replaceNow: false },
          { componentId: "f", name: "Furnace", missing: "cost", endOfLifeYear: 2020, replaceNow: false },
        ],
      }),
      footer,
    );
    expect(email.subject).toBe("Add costs to finish your 2027 budget");
    expect(email.text).toContain("None of the 2 components you saved across your property can be counted yet");
    expect(email.text).toContain("2 of them are past their end of life or due in 2027.");
    expect(email.text).not.toContain("$0");
    expect(email.html).not.toContain("Monthly reserve");
  });

  it("explains a reserve with nothing due in 10 years", () => {
    const email = budgetSummaryEmail(
      one({
        ...MAPLE,
        budgetYearTotal: 0,
        budgetYearItems: [],
        tenYearTotal: 0,
        monthlyReserve: 70,
        monthlyReservePerUnit: null,
        excluded: 0,
        leftOut: [],
        savingAhead: [{ name: "Roof", year: 2045, cost: 15_000 }],
      }),
      footer,
    );
    expect(email.subject).toBe("Nothing to replace in 2027");
    expect(email.text).toContain(
      "Nothing across your property is due in the next 10 years. Setting aside $70 a month now builds up the cash for replacements further out: Roof in 2045.",
    );
    expect(email.text).toContain("- Monthly reserve (saving ahead): $70");
  });

  it("caps the due list at 8 rows", () => {
    const items = Array.from({ length: 11 }, (_, i) => ({ name: `Item ${i}`, cost: 1000, overdue: false }));
    const email = budgetSummaryEmail(one({ ...MAPLE, budgetYearItems: items }), footer);
    expect(email.html).toContain("+3 more");
    expect(email.text).toContain(", +3 more");
  });

  it("works in mail apps' dark mode and links to the settings", () => {
    const email = budgetSummaryEmail(one(MAPLE), footer);
    expect(email.html).toContain('<meta name="color-scheme" content="light">');
    expect(email.html).toContain('bgcolor="#f8fafc"');
    expect(email.html).toContain('href="https://capexclock.com/app#email-settings"');
  });
});

const item = (o: Partial<ReminderItem>): ReminderItem => ({
  propertyId: "p1",
  propertyName: "Maple Court",
  componentId: "c",
  name: "Roof",
  category: "Roofing",
  cost: 10_000,
  overdue: false,
  replaceNow: false,
  ...o,
});

describe("reminderEmail", () => {
  const rfooter = { kind: "reminders" as const, unsubscribeUrl: "https://capexclock.com/email/unsubscribe?t=x" };

  it("names the property and the overdue ones in the subject", () => {
    const email = reminderEmail(
      [
        item({ componentId: "a", overdue: true }),
        item({ componentId: "b", name: "Boiler", overdue: true }),
        item({ componentId: "c", name: "Carpet" }),
        item({ componentId: "d", name: "Windows", cost: null }),
      ],
      2026,
      rfooter,
    );
    expect(email.subject).toBe("Maple Court: 2 past end of life, 2 more due in 2026");
    expect(email.text).toContain(
      "2 are past their end of life and still waiting to be replaced, and 2 more come due in 2026: $30,000 in all at today's prices, not counting 1 without a cost yet.",
    );
    expect(email.text).toContain("- Due but missing a cost: Windows (reaches its end of life this year).");
    expect(email.text).toContain("Update its install year in Maple Court (https://capexclock.com/app/properties/p1)");
  });

  it("says a single overdue item is past its end of life, and flags a $0 cost", () => {
    const email = reminderEmail([item({ propertyName: "Oak Row", name: "Water heater", overdue: true, cost: 0 })], 2026, rfooter);
    expect(email.subject).toBe("Oak Row: Water heater is past its end of life");
    expect(email.text).toContain("- Water heater: $0 (check the cost). Past its end of life.");
  });

  it("counts across properties", () => {
    const email = reminderEmail([item({}), item({ propertyId: "p2", propertyName: "Oak Row", componentId: "x" })], 2026, rfooter);
    expect(email.subject).toBe("2 replacements due in 2026 across 2 properties");
    expect(email.text).toContain("in My properties (https://capexclock.com/app)");
  });
});
