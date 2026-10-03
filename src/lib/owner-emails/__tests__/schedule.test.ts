import { localDate, openJobs, previewJobs, reminderGapPassed } from "../schedule";

describe("localDate", () => {
  it("uses Central time", () => {
    // 3 AM UTC on Jan 1 is still Dec 31 in Chicago.
    expect(localDate(new Date("2027-01-01T03:00:00Z"))).toEqual({ year: 2026, month: 12, day: 31 });
    expect(localDate(new Date("2027-01-01T15:00:00Z"))).toEqual({ year: 2027, month: 1, day: 1 });
  });
});

describe("openJobs", () => {
  it("holds reminders on January 1 only", () => {
    expect(openJobs({ year: 2027, month: 1, day: 1 }).reminderYear).toBeNull();
    expect(openJobs({ year: 2027, month: 1, day: 2 }).reminderYear).toBe(2027);
    expect(openJobs({ year: 2027, month: 6, day: 15 }).reminderYear).toBe(2027);
  });

  it("opens the condition report from January 8 through the month", () => {
    expect(openJobs({ year: 2027, month: 1, day: 7 }).reportYear).toBeNull();
    expect(openJobs({ year: 2027, month: 1, day: 8 }).reportYear).toBe(2027);
    expect(openJobs({ year: 2027, month: 1, day: 31 }).reportYear).toBe(2027);
    expect(openJobs({ year: 2027, month: 2, day: 1 }).reportYear).toBeNull();
  });

  it("opens next year's budget summary from November 2 through the month", () => {
    expect(openJobs({ year: 2026, month: 11, day: 1 }).budgetYear).toBeNull();
    expect(openJobs({ year: 2026, month: 11, day: 2 }).budgetYear).toBe(2027);
    expect(openJobs({ year: 2026, month: 11, day: 30 }).budgetYear).toBe(2027);
    expect(openJobs({ year: 2026, month: 12, day: 1 }).budgetYear).toBeNull();
  });

  it("opens everything for a preview", () => {
    expect(previewJobs({ year: 2026, month: 10, day: 3 })).toEqual({ reminderYear: 2026, budgetYear: 2027, reportYear: 2026 });
  });
});

describe("reminderGapPassed", () => {
  const now = new Date("2027-03-08T15:00:00Z");
  it("allows one reminder a week", () => {
    expect(reminderGapPassed(null, now)).toBe(true);
    expect(reminderGapPassed(new Date("2027-03-01T15:05:00Z"), now)).toBe(true);
    expect(reminderGapPassed(new Date("2027-03-03T15:00:00Z"), now)).toBe(false);
  });
});
