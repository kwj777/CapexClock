import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Kevin's rule that the engine knows nothing about any audience, made checkable.
// Reads every engine source and test file (code, comments, strings and test
// titles); camelCase and snake_case are split, so unitCount and per_unit count.
// ENGINE.md isn't read: it may name the landlord vertical as its example.
const AUDIENCE_WORDS =
  /\b(units?|doors?|tenants?|propert(?:y|ies)|landlords?|rent(?:al|als|s)?|apartments?|leases?|hoas?|church(?:es)?)\b/i;
const ENGINE = join(__dirname, "../../engine");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|tsx|snap)$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

it("keeps audience words out of src/engine", () => {
  const checked = files(ENGINE);
  expect(checked.length).toBeGreaterThan(20);
  const hits: string[] = [];
  for (const file of checked) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        const words = line.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
        const m = AUDIENCE_WORDS.exec(words);
        if (m) hits.push(`${file.slice(ENGINE.length + 1)}:${i + 1} "${m[0]}"`);
      });
  }
  expect(hits).toEqual([]);
});

it("finds an audience word when there is one", () => {
  for (const sample of ["unitCount", "per_unit", "a rental", "Properties", "HOA dues", "the church"]) {
    const words = sample.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
    expect(AUDIENCE_WORDS.test(words)).toBe(true);
  }
  for (const sample of ["component", "group", "currentReserveBalance", "horizon"]) {
    expect(AUDIENCE_WORDS.test(sample)).toBe(false);
  }
});
