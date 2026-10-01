import type { LibraryComponent } from "@/lib/library/components";
import { words } from "./text";

/**
 * Other names owners use for library items, by slug. Matching any of these is
 * as sure as matching the name itself. Slugs the library doesn't have are skipped,
 * so items renamed or removed in the Supabase dashboard can't be matched by mistake.
 */
export const ALIASES: Readonly<Record<string, readonly string[]>> = {
  "asphalt-shingle-roof": ["shingle roof", "shingles", "asphalt roof", "asphalt shingles", "comp roof", "composition roof", "composition shingles", "pitched roof"],
  "flat-membrane-roof": ["flat roof", "membrane roof", "tpo", "tpo roof", "epdm", "epdm roof", "rubber roof", "torch down", "modified bitumen", "mod bit", "built up roof", "bur"],
  gutters: ["gutter", "downspouts", "gutters and downspouts", "eavestroughs"],
  "gas-furnace": ["furnace", "forced air furnace", "gas furnace", "fau", "gas heat", "forced air"],
  "central-ac": ["ac", "a c", "air conditioner", "air conditioning", "ac unit", "ac condenser", "condenser", "central air", "central ac", "cac", "condensing unit"],
  "heat-pump": ["heat pump", "mini split", "minisplit", "ductless", "ductless mini split"],
  boiler: ["boiler", "hot water boiler", "steam boiler"],
  "tank-water-heater": ["water heater", "hot water heater", "hot water tank", "water tank", "hwh", "hwt", "wh", "gas water heater", "electric water heater", "hot water", "dhw", "domestic hot water"],
  "tankless-water-heater": ["tankless", "tankless heater", "on demand water heater", "instant water heater"],
  refrigerator: ["fridge", "frig", "frige", "refrig", "refer", "reefer", "refrigerator freezer", "fridge freezer"],
  "range-oven": ["range", "oven", "stove", "stove oven", "range and oven", "gas range", "electric range", "cooktop", "cook top"],
  dishwasher: ["dw", "dish washer"],
  "washer-dryer": ["washer", "dryer", "w d", "washer and dryer", "washer dryer", "laundry", "washing machine", "laundry machines"],
  carpet: ["carpeting"],
  "luxury-vinyl-plank": ["lvp", "lvt", "vinyl plank", "vinyl plank flooring", "luxury vinyl", "vinyl flooring", "vinyl floor"],
  "interior-paint": ["interior paint", "unit paint", "turnover paint", "apartment paint", "int paint"],
  "kitchen-cabinets": ["cabinets", "kitchen cabinets", "cabinet"],
  "laminate-countertops": ["countertops", "countertop", "counter tops", "counters", "laminate counters"],
  "vinyl-windows": ["windows", "window", "vinyl windows"],
  "exterior-paint": ["exterior paint", "ext paint", "outside paint", "exterior painting"],
  "vinyl-siding": ["siding"],
  "parking-lot-seal-coat": ["seal coat", "sealcoat", "sealcoating", "seal coating", "parking lot seal", "parking lot sealing"],
  "parking-lot-resurface": ["parking lot", "repave", "repaving", "resurface", "resurfacing", "paving", "asphalt paving", "parking lot repave", "parking lot overlay", "overlay"],
  "electrical-panel": ["electrical panel", "electric panel", "breaker panel", "breaker box", "service panel"],
  "fire-alarm-panel": ["fire alarm", "fire panel", "fire alarm system", "facp", "fire alarm control panel"],
};

/** Names that could be more than one library item, so the owner is asked which. */
export const UNSURE_NAMES: Readonly<Record<string, readonly string[]>> = {
  roof: ["asphalt-shingle-roof", "flat-membrane-roof"],
  roofing: ["asphalt-shingle-roof", "flat-membrane-roof"],
  hvac: ["gas-furnace", "central-ac", "heat-pump"],
  heater: ["gas-furnace", "tank-water-heater"],
  heat: ["gas-furnace", "boiler", "heat-pump"],
  heating: ["gas-furnace", "boiler", "heat-pump"],
  paint: ["interior-paint", "exterior-paint"],
  painting: ["interior-paint", "exterior-paint"],
  floor: ["carpet", "luxury-vinyl-plank"],
  flooring: ["carpet", "luxury-vinyl-plank"],
  floors: ["carpet", "luxury-vinyl-plank"],
  vinyl: ["luxury-vinyl-plank", "vinyl-siding", "vinyl-windows"],
  panel: ["electrical-panel", "fire-alarm-panel"],
  asphalt: ["asphalt-shingle-roof", "parking-lot-resurface", "parking-lot-seal-coat"],
  appliances: ["refrigerator", "range-oven", "dishwasher"],
  kitchen: ["kitchen-cabinets", "laminate-countertops"],
  // Often the wiring, not the panel.
  electrical: ["electrical-panel"],
};

// Words that don't change what an item is: sizes, fuels, brands, "unit 3".
const HARMLESS = new Set(
  (
    "gas electric elec natural propane lp new old original existing main common area areas unit units apt apartment " +
    "apartments bldg building the a an and of for in x # no each all per with " +
    "gal gallon gallons g ton tons btu btus amp amps kw " +
    "rheem ruud ao smith bradford white state american standard carrier trane lennox goodman york amana bryant " +
    "payne daikin mitsubishi fujitsu ge whirlpool frigidaire samsung lg maytag kenmore bosch kitchenaid hotpoint " +
    "navien rinnai noritz siemens eaton square d"
  ).split(" "),
);

/** Lower case words with sizes and numbers taken out and plurals made single. */
export function nameKey(name: string): string {
  return words(name)
    .split(" ")
    .filter((w) => w !== "" && !/^\d+(?:\.\d+)?[a-z]{0,3}$/.test(w) && w !== "#" && w !== "$")
    .map(singular)
    .join(" ");
}

function singular(word: string): string {
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

/** Edit distance with swapped neighbours counting once ("furnance" is 1 from "furnace"). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Typos allowed for a word or phrase of this length: none for short ones like "ac". */
function typosAllowed(length: number): number {
  if (length >= 9) return 2;
  if (length >= 5) return 1;
  return 0;
}

/**
 * Typos allowed against one phrase. Short aliases need a longer word before a
 * typo counts, so "store" isn't read as "stove".
 */
function typosFor(phrase: Phrase): number {
  const n = phrase.key.length;
  if (!phrase.alias) return typosAllowed(n);
  return n >= 9 ? 2 : n >= 6 ? 1 : 0;
}

/**
 * How a name matched the library:
 * - exact: it is the library name, so nothing changed
 * - matched: an alias, a typo or extra words like a brand ("Rheem water heater")
 * - unsure: could be one of `suggestions`, so the owner is asked
 * - none: kept as the owner's own item
 * `extraWords` is set when the name says more than the item's name (a brand, a
 * size, "over garage"), so it's worth keeping in the notes.
 */
export type NameMatch =
  | { kind: "exact"; slug: string }
  | { kind: "matched"; slug: string; extraWords: boolean }
  | { kind: "unsure"; suggestions: string[]; extraWords: boolean }
  | { kind: "none" };

interface Phrase {
  key: string;
  tokens: string[];
  slugs: string[];
  /** From UNSURE_NAMES: even an exact match is only a suggestion. */
  unsure: boolean;
  /** One of our other names for an item, not the library's own name for it. */
  alias: boolean;
}

export type NameMatcher = (name: string) => NameMatch;

/** Matches names against this library. Results are remembered, since sheets repeat names. */
export function createMatcher(library: readonly LibraryComponent[]): NameMatcher {
  const slugs = new Set(library.map((c) => c.slug));
  const byName = new Map(library.map((c) => [c.name.trim().toLowerCase(), c.slug]));
  const phrases = new Map<string, Phrase>();
  const add = (text: string, phraseSlugs: string[], unsure: boolean, alias: boolean) => {
    const key = nameKey(text);
    const known = phraseSlugs.filter((s) => slugs.has(s));
    if (key === "" || known.length === 0) return;
    const existing = phrases.get(key);
    // A library name or alias is sure; it wins over an unsure name with the same words.
    if (existing && (!existing.unsure || unsure)) return;
    phrases.set(key, { key, tokens: key.split(" "), slugs: known, unsure, alias });
  };
  for (const c of library) {
    add(c.name, [c.slug], false, false);
    add(c.slug.replace(/-/g, " "), [c.slug], false, false);
    // "Windows (vinyl)" and "Central AC / condenser" are also known by their first part.
    add(c.name.replace(/\s*\(.*\)\s*$/, ""), [c.slug], false, false);
  }
  for (const [slug, aliases] of Object.entries(ALIASES)) for (const a of aliases) add(a, [slug], false, true);
  for (const [name, options] of Object.entries(UNSURE_NAMES)) add(name, [...options], true, true);
  const all = [...phrases.values()];

  const cache = new Map<string, NameMatch>();
  return (name: string) => {
    const trimmed = name.trim();
    const exactSlug = byName.get(trimmed.toLowerCase());
    if (exactSlug) return { kind: "exact", slug: exactSlug };
    const key = nameKey(trimmed);
    let result = cache.get(key);
    if (!result) {
      result = match(key, all);
      cache.set(key, result);
    }
    return result;
  };
}

function sure(phrase: Phrase): NameMatch {
  return phrase.unsure || phrase.slugs.length > 1
    ? { kind: "unsure", suggestions: phrase.slugs, extraWords: false }
    : { kind: "matched", slug: phrase.slugs[0], extraWords: false };
}

function unsureOf(found: Phrase[], extraWords: boolean): NameMatch {
  const suggestions = [...new Set(found.flatMap((p) => p.slugs))].slice(0, 4);
  return { kind: "unsure", suggestions, extraWords };
}

function match(key: string, phrases: Phrase[]): NameMatch {
  if (key === "") return { kind: "none" };
  const whole = phrases.find((p) => p.key === key);
  if (whole) return sure(whole);

  // A close spelling of the whole name: "refridgerator", "dishwaser".
  const allowed = typosAllowed(key.length);
  if (allowed > 0) {
    let best = Infinity;
    let closest: Phrase[] = [];
    for (const p of phrases) {
      const limit = Math.min(allowed, typosFor(p));
      if (Math.abs(p.key.length - key.length) > limit) continue;
      const d = editDistance(key, p.key);
      if (d > limit) continue;
      if (d < best) [best, closest] = [d, [p]];
      else if (d === best) closest.push(p);
    }
    if (closest.length > 0) return closest.length === 1 ? sure(closest[0]) : unsureOf(closest, false);
  }

  // A library name inside a longer name, typos allowed: "Rheem water heatr 40 gal".
  const tokens = key.split(" ");
  const found: { phrase: Phrase; start: number }[] = [];
  for (const p of phrases) {
    const n = p.tokens.length;
    for (let start = 0; start + n <= tokens.length; start++) {
      const window = tokens.slice(start, start + n).join(" ");
      if (window === p.key || editDistance(window, p.key) <= typosFor(p)) {
        found.push({ phrase: p, start });
        break;
      }
    }
  }
  if (found.length === 0) return { kind: "none" };
  // Longest first: "tankless water heater" over "water heater".
  found.sort((a, b) => b.phrase.tokens.length - a.phrase.tokens.length || b.phrase.key.length - a.phrase.key.length);
  const longest = found[0];
  const sameSize = found.filter((f) => f.phrase.tokens.length === longest.phrase.tokens.length);
  const covered = new Set(Array.from({ length: longest.phrase.tokens.length }, (_, i) => longest.start + i));
  const others = tokens.filter((t, i) => !covered.has(i));
  const slugsFound = new Set(sameSize.flatMap((f) => f.phrase.slugs));
  if (slugsFound.size === 1 && !longest.phrase.unsure && others.every((t) => HARMLESS.has(t))) {
    return { kind: "matched", slug: longest.phrase.slugs[0], extraWords: others.length > 0 };
  }
  return unsureOf(
    found.map((f) => f.phrase),
    others.length > 0,
  );
}
