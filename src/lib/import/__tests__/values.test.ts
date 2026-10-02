import {
  readAge,
  readCondition,
  readInstallYear,
  readLife,
  readMoney,
  readQuantity,
  readRemaining,
  readReplaceBy,
  saysPerSqFt,
} from "../values";

const NOW = 2026;

describe("install years", () => {
  it.each([
    [2014, 2014],
    ["2014", 2014],
    ["6/12/2014", 2014],
    ["2014-06-12", 2014],
    ["12.06.2014", 2014],
    ["June 2014", 2014],
    ["Jun 2014", 2014],
    ["June 12th, 2014", 2014],
    ["Spring 2014", 2014],
    ["2014.0", 2014],
  ])("reads %p as %p without a note", (cell, year) => {
    expect(readInstallYear(cell, NOW)).toEqual({ value: year });
  });

  it("reads a real Excel date cell as its year", () => {
    expect(readInstallYear(new Date(2014, 5, 12), NOW)).toEqual({ value: 2014 });
  });

  it.each(["approx 2014", "approx. 2014", "~2014", "c. 2014", "circa 2014", "about 2014", "2014?", "2014ish", "est. 2014", "2014 (est)"])(
    "reads %p as 2014 and marks it a guess",
    (cell) => {
      expect(readInstallYear(cell, NOW)).toEqual({ value: 2014, guess: true, note: `Read "${cell}" as 2014, marked a guess` });
    },
  );

  it.each(["orig", "Original", "original to building", "unknown", "?", "N/A", "-", "TBD"])(
    "leaves %p blank, so the year built is used and marked an estimate",
    (cell) => {
      expect(readInstallYear(cell, NOW)).toEqual({
        value: null,
        note: `Read "${cell}" as no install year, so it uses the year built, marked an estimate`,
      });
    },
  );

  it("leaves a blank cell blank without a note", () => {
    expect(readInstallYear("", NOW)).toEqual({ value: null });
    expect(readInstallYear(null, NOW)).toEqual({ value: null });
  });

  it.each(["Jun-14", "Jun 14", "6/14", "6/12/14", "14", "'98"])("asks about %p instead of guessing the century", (cell) => {
    expect(readInstallYear(cell, NOW)).toEqual({
      value: null,
      problem: `Couldn't tell which year "${cell}" means. Type the 4-digit year.`,
    });
  });

  it("asks when a cell has two years", () => {
    expect(readInstallYear("2012-2014", NOW).problem).toBe('"2012-2014" has more than one year. Type the one to use.');
  });

  it("asks about years before 1900 or after this year", () => {
    expect(readInstallYear("1850", NOW).problem).toBe(
      "1850 is before 1900. Type the install year, or leave it blank to use the year built.",
    );
    expect(readInstallYear(2030, NOW).problem).toBe("2030 hasn't happened yet. Type the year it was installed.");
  });

  it("says when it reads a year out of other words", () => {
    expect(readInstallYear("replaced 2014", NOW)).toEqual({ value: 2014, note: 'Read "replaced 2014" as 2014' });
  });

  it("asks about words it can't read", () => {
    expect(readInstallYear("soon", NOW).problem).toBe(`Couldn't read "soon" as a year.`);
  });

  it.each([
    ["1990s", 1990],
    ["1990's", 1990],
    ["the 90s", 1990],
    ["'80s", 1980],
    ["early 2000s", 2000],
    ["mid-90s", 1994],
    ["Mid 2000s", 2004],
    ["late 1990s", 1997],
    ["1990s?", 1990],
  ])("reads the decade %p as %p, marked a guess", (text, year) => {
    expect(readInstallYear(text, NOW)).toEqual({ value: year, guess: true, note: `Read "${text}" as ${year}, marked a guess` });
  });

  it.each(["pre-2000", "pre 2000", "before 2000", "Prior to 1995", "2000 or earlier", "<2000", "≤ 2000", "after 2010", "post-2010", "2010 or later", "2015+"])(
    "asks about %p, which doesn't give one year",
    (text) => {
      expect(readInstallYear(text, NOW)).toEqual({
        value: null,
        problem: `"${text}" doesn't give one year. Type your best guess, with "approx" in front to mark it a guess.`,
      });
    },
  );

  it("still reads a year with a season or a word like since", () => {
    expect(readInstallYear("mid 2014", NOW)).toEqual({ value: 2014 });
    expect(readInstallYear("since 2015", NOW)).toEqual({ value: 2015, note: 'Read "since 2015" as 2015' });
    expect(readInstallYear("1990s or 2000s", NOW).problem).toBe('"1990s or 2000s" has more than one year. Type the one to use.');
  });
});

describe("ages", () => {
  it("counts back from the sheet's year and marks the year a guess", () => {
    expect(readAge("8 yrs old", 2024, NOW)).toEqual({
      value: 2016,
      guess: true,
      note: "Counted 8 years back from 2024: installed about 2016, marked a guess",
    });
    expect(readAge(8, NOW, NOW).value).toBe(2018);
    expect(readAge("approx 5", NOW, NOW).value).toBe(2021);
    expect(readAge("12 years", NOW, NOW).value).toBe(2014);
    expect(readAge("8+", NOW, NOW).value).toBe(2018);
  });

  it("reads new as the sheet's year", () => {
    expect(readAge("new", 2025, NOW)).toEqual({
      value: 2025,
      guess: true,
      note: 'Read "new" in 2025: installed about 2025, marked a guess',
    });
  });

  it("reads months", () => {
    expect(readAge("18 months", NOW, NOW).value).toBe(2024);
  });

  it("uses the older end of a range, and says so", () => {
    expect(readAge("8-10", NOW, NOW)).toEqual({
      value: 2016,
      guess: true,
      note: 'Used the older age of "8-10". Counted 10 years back from 2026: installed about 2016, marked a guess',
    });
  });

  it("reads a year typed in the age column as the install year", () => {
    expect(readAge("2014", NOW, NOW)).toEqual({ value: 2014, guess: true, note: 'Read "2014" as the install year, marked a guess' });
  });

  it("leaves unknown ages blank", () => {
    expect(readAge("unknown", NOW, NOW).value).toBeNull();
    expect(readAge("", NOW, NOW)).toEqual({ value: null });
  });

  it("asks about ages it can't use", () => {
    expect(readAge("old", NOW, NOW).problem).toBe(`Couldn't read "old" as an age.`);
    expect(readAge(200, NOW, NOW).problem).toBe('"200" isn\'t an age in years.');
    expect(readAge(130, NOW, NOW).problem).toContain("1896 is before 1900");
  });
});

describe("years of life left", () => {
  it("works out the install year from the life", () => {
    expect(readRemaining(5, NOW, 25, NOW)).toEqual({
      value: 2006,
      guess: true,
      note: "5 years left of a 25-year life in 2026: installed about 2006, marked a guess",
    });
    expect(readRemaining("now", 2024, 10, NOW).value).toBe(2014);
    expect(readRemaining("0", NOW, 4, NOW).value).toBe(2022);
  });

  it("uses an for 8, 11 and 18", () => {
    expect(readRemaining(1, NOW, 18, NOW).note).toContain("an 18-year life");
    expect(readRemaining(1, NOW, 11, NOW).note).toContain("an 11-year life");
    expect(readRemaining(1, NOW, 8, NOW).note).toContain("an 8-year life");
  });

  it("uses the shorter end of a range", () => {
    expect(readRemaining("5-7 yrs", NOW, 10, NOW).value).toBe(2021);
    expect(readRemaining("5-7 yrs", NOW, 10, NOW).note).toMatch(/^Used the shorter time of "5-7 yrs"\./);
  });

  it("needs a useful life", () => {
    expect(readRemaining(8, NOW, null, NOW)).toEqual({
      value: null,
      needsLife: true,
      problem: 'Add a useful life, so the install year can be worked out from the years left ("8").',
    });
  });

  it("asks when the years left are longer than the life", () => {
    expect(readRemaining(50, NOW, 30, NOW).problem).toBe(
      "50 years left of a 30-year life in 2026 gives 2046. Check the useful life, or type the install year.",
    );
  });
});

describe("replace-by years", () => {
  it("takes the life off the year to replace by", () => {
    expect(readReplaceBy("2030", NOW, 11, NOW)).toEqual({
      value: 2019,
      guess: true,
      note: "Replace by 2030 with an 11-year life: installed about 2019, marked a guess",
    });
    expect(readReplaceBy("6/2030", NOW, 10, NOW).value).toBe(2020);
  });

  it("reads ASAP and overdue as the sheet's year", () => {
    expect(readReplaceBy("ASAP", 2024, 14, NOW).value).toBe(2010);
    expect(readReplaceBy("overdue", NOW, 14, NOW).value).toBe(2012);
    expect(readReplaceBy("next year", NOW, 10, NOW).value).toBe(2017);
  });

  it("uses the earlier year of a range", () => {
    expect(readReplaceBy("2028-2030", NOW, 25, NOW)).toEqual({
      value: 2003,
      guess: true,
      note: 'Used the earlier year of "2028-2030". Replace by 2028 with a 25-year life: installed about 2003, marked a guess',
    });
  });

  it("reads before a year as the year before, and a decade as its start", () => {
    expect(readReplaceBy("before 2030", NOW, 10, NOW)).toEqual({
      value: 2019,
      guess: true,
      note: 'Read "before 2030" as 2029. Replace by 2029 with a 10-year life: installed about 2019, marked a guess',
    });
    expect(readReplaceBy("2030s", NOW, 10, NOW).value).toBe(2020);
    expect(readReplaceBy("after 2030", NOW, 10, NOW).problem).toContain("doesn't give one year");
  });

  it("asks about two-digit years and missing lives", () => {
    expect(readReplaceBy("Jun-30", NOW, 10, NOW).problem).toContain("Couldn't tell which year");
    expect(readReplaceBy("2030", NOW, null, NOW).needsLife).toBe(true);
    expect(readReplaceBy("2060", NOW, 10, NOW).problem).toBe(
      "Replacing by 2060 with a 10-year life gives 2050. Check the useful life, or type the install year.",
    );
  });
});

describe("useful life", () => {
  it.each([
    ["10", 10],
    ["10 yrs", 10],
    [25, 25],
  ])("reads %p", (cell, life) => {
    expect(readLife(cell)).toEqual({ value: life });
  });

  it("rounds to whole years and uses the shorter end of a range, saying so", () => {
    expect(readLife(12.5)).toEqual({ value: 13, note: 'Rounded the useful life "12.5" to 13 years' });
    expect(readLife("10-15")).toEqual({ value: 10, note: 'Used the shorter life of "10-15": 10 years' });
  });

  it("asks about lives outside 1 to 100 years", () => {
    expect(readLife("0").problem).toBe('A useful life of "0" should be from 1 to 100 years.');
    expect(readLife(150).problem).toBe('A useful life of "150" should be from 1 to 100 years.');
    expect(readLife("forever").problem).toBe(`Couldn't read "forever" as a useful life.`);
  });

  it("leaves blank and unknown lives empty", () => {
    expect(readLife("")).toEqual({ value: null });
    expect(readLife("n/a").value).toBeNull();
  });
});

describe("money", () => {
  it.each([
    ["$1,400", 1400],
    [1400, 1400],
    ["1400", 1400],
    ["1,400.50", 1400.5],
    ["$1,400 ea", 1400],
    ["1,400 each", 1400],
    ["$1400/unit", 1400],
    ["$1,400 per unit", 1400],
    ["$4 per sq ft", 4],
    ["$4 / sq. ft.", 4],
    ["$0.25/sf", 0.25],
    ["$0", 0],
  ])("reads %p as %p", (cell, value) => {
    expect(readMoney(cell)).toEqual({ value });
  });

  it("reads thousands and millions, and says so", () => {
    expect(readMoney("1.4k")).toEqual({ value: 1400, note: 'Read "1.4k" as $1,400' });
    expect(readMoney("$45K")).toEqual({ value: 45000, note: 'Read "$45K" as $45,000' });
    expect(readMoney("2M")).toEqual({ value: 2_000_000, note: 'Read "2M" as $2,000,000' });
  });

  it("uses the higher figure of a range, and flags it", () => {
    expect(readMoney("1200–1500")).toEqual({ value: 1500, note: 'Used the higher figure of "1200–1500": $1,500', range: true });
    expect(readMoney("$1,200 - $1,500").value).toBe(1500);
    expect(readMoney("1.2k to 1.5k").value).toBe(1500);
  });

  it("reads approximate costs and says so", () => {
    expect(readMoney("approx $1,400")).toEqual({ value: 1400, note: 'Read "approx $1,400" as $1,400' });
  });

  it("leaves costs nobody knows blank", () => {
    expect(readMoney("TBD")).toEqual({ value: null, note: 'Left the cost blank ("TBD")' });
    expect(readMoney("call")).toEqual({ value: null, note: 'Left the cost blank ("call")' });
    expect(readMoney("")).toEqual({ value: null });
  });

  it("reads free as $0", () => {
    expect(readMoney("free")).toEqual({ value: 0, note: 'Read "free" as $0' });
  });

  it("asks about negative and unreadable costs", () => {
    expect(readMoney("(1,400)").problem).toBe('"(1,400)" is below zero. Type the cost to replace it.');
    expect(readMoney("-1400").problem).toBe('"-1400" is below zero. Type the cost to replace it.');
    expect(readMoney("see attached").problem).toBe(`Couldn't read "see attached" as a cost.`);
    expect(readMoney(1e13).problem).toBe('"10000000000000" is too large for a cost.');
  });
});

describe("quantities", () => {
  it.each([
    [12, 12],
    ["12", 12],
    ["x12", 12],
    ["12x", 12],
    ["12 ea", 12],
    ["12 units", 12],
    ["1,200", 1200],
  ])("reads %p as %p", (cell, value) => {
    expect(readQuantity(cell)).toEqual({ value, squareFeet: false });
  });

  it("reads square feet", () => {
    expect(readQuantity("1,200 sq ft")).toEqual({ value: 1200, squareFeet: true });
    expect(readQuantity("9600 sf")).toEqual({ value: 9600, squareFeet: true });
  });

  it("returns zero, for the row to be skipped", () => {
    expect(readQuantity("0").value).toBe(0);
  });

  it("asks about ranges and words", () => {
    expect(readQuantity("10-12").problem).toBe('Quantity "10-12" is a range. Type one number.');
    expect(readQuantity("a few").problem).toBe(`Couldn't read "a few" as a quantity.`);
    expect(readQuantity(-1).problem).toBe(`Couldn't read "-1" as a quantity.`);
  });
});

describe("condition", () => {
  it("reads good, fair and poor, and says when it read another word", () => {
    expect(readCondition("Good")).toEqual({ value: "good", note: undefined });
    expect(readCondition("excellent")).toEqual({ value: "good", note: 'Read "excellent" as Good' });
    expect(readCondition("ok")).toEqual({ value: "fair", note: 'Read "ok" as Fair' });
    expect(readCondition("needs replacing")).toEqual({ value: "poor", note: 'Read "needs replacing" as Poor' });
  });

  it("keeps other words for the notes instead of guessing", () => {
    expect(readCondition("leaks a little")).toEqual({
      value: null,
      keep: "leaks a little",
      note: 'Put the condition "leaks a little" in the notes',
    });
    expect(readCondition("")).toEqual({ value: null });
  });
});

describe("costs per square foot", () => {
  it.each(["$4 per sq ft", "4/sf", "$3.50 psf", "$4 / sq. ft.", "5 a square foot", "$4 sqft", "4/ft2"])("knows %p is per sq ft", (cell) => {
    expect(saysPerSqFt(cell)).toBe(true);
  });

  it.each(["$4", "$1,400 ea", "4", 4, "", "Soft carpet", "$4 per unit"])("knows %p isn't", (cell) => {
    expect(saysPerSqFt(cell)).toBe(false);
  });
});
