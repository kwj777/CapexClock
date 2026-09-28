import type { LibraryComponent } from "./components";

export interface Subject {
  /** Lower-case noun phrase with its article, e.g. "an asphalt shingle roof" or "vinyl windows". */
  noun: string;
  plural: boolean;
}

// Library names are table labels ("Windows (vinyl)"); these read better in a sentence.
// Keyed by the seeded name, lower case, so a row renamed in the dashboard reads
// from its new name instead of keeping the old wording.
const SUBJECTS: Record<string, Subject> = {
  "central ac / condenser": { noun: "a central AC condenser", plural: false },
  "washer / dryer": { noun: "a washer and dryer", plural: false },
  "luxury vinyl plank": { noun: "luxury vinyl plank flooring", plural: false },
  "windows (vinyl)": { noun: "vinyl windows", plural: true },
  "parking lot resurface": { noun: "a resurfaced parking lot", plural: false },
};

// Materials and finishes you don't count, so they take no "a" ("carpet", "vinyl siding").
const MASS_NOUNS = new Set([
  "asphalt", "carpet", "carpeting", "caulk", "caulking", "concrete", "decking", "drywall",
  "ductwork", "equipment", "fencing", "flooring", "glass", "glazing", "grout", "hardware",
  "insulation", "landscaping", "lighting", "masonry", "paint", "paving", "piping", "plumbing",
  "roofing", "sealant", "sheathing", "shelving", "siding", "stucco", "tile", "trim",
  "waterproofing", "weatherstripping", "wiring",
]);

// Words ending in "s" that are still one thing.
const SINGULAR_S = new Set(["gas", "lens", "series"]);

function isPlural(word: string): boolean {
  const w = word.toLowerCase();
  return w.endsWith("s") && !/(ss|us|is)$/.test(w) && !SINGULAR_S.has(w);
}

// Said letter by letter: "HVAC", "LED", "A/C", or a single letter as in "X-ray" or "U-bend".
const SPELLED_OUT = /^([A-Z]{2}|[A-Za-z]([-/]|$))/;

/** "an" before a vowel sound: "an HVAC unit", "an X-ray room", "an hour meter", but "a unit heater". */
function article(word: string): "a" | "an" {
  if (SPELLED_OUT.test(word)) return /^[AEFHILMNORSX]/i.test(word) ? "an" : "a";
  if (/^(8|11|18)/.test(word)) return "an";
  const w = word.toLowerCase();
  if (/^(hour|honou?r|honest|heir)/.test(w)) return "an";
  if (/^(uni|us[aeu]|uti|ur[aeio]|eu|one)/.test(w)) return "a";
  return /^[aeiou]/.test(w) ? "an" : "a";
}

const HAS_WORD = /[\p{L}\p{N}]/u;

/** Reads "&" as "and" and "/" as "or" (or "and"): "Range / oven" is "Range or oven". "A/C" stays as it is. */
function asWords(label: string, slash: "or" | "and" = "or"): string {
  return label
    .replace(/(?<!\b[A-Za-z])\s*\/\s*(?![A-Za-z]\b)/g, ` ${slash} `)
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(and|or) |\s(and|or)$/gi, "");
}

/** The name without notes in brackets, unless the brackets are all there is, as in "(misc)". */
function plainName(name: string): string {
  const plain = asWords(name.replace(/\s*\(.*?\)/g, ""));
  return HAS_WORD.test(plain) ? plain : asWords(name.replace(/[()]/g, " "));
}

const lastWord = (phrase: string) => phrase.split(" ").pop()!.toLowerCase();

export function subjectFor(item: LibraryComponent): Subject {
  const known = SUBJECTS[item.name.trim().toLowerCase()];
  if (known) return known;
  const name = plainName(item.name);
  // "Carpet and pad" takes its article, or none, from the first thing it names.
  const parts = name.split(/ (?:and|or) /i);
  const plural = parts.some((p) => isPlural(lastWord(p)));
  const first = lastWord(parts[0]);
  const lower = SPELLED_OUT.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
  if (plural || isPlural(first) || MASS_NOUNS.has(first)) return { noun: lower, plural };
  return { noun: `${article(name.split(" ")[0])} ${lower}`, plural: false };
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** For use mid-title: articles and conjunctions stay lower case. */
export function titleCase(s: string): string {
  const small = new Set(["a", "an", "and", "or", "the", "of"]);
  return s
    .split(" ")
    .map((w) => (small.has(w) ? w : capitalize(w)))
    .join(" ");
}

/** A label such as a category, for mid-sentence: "Roofing" becomes "roofing", "HVAC" stays. */
export function inSentence(label: string): string {
  return label
    .split(" ")
    .map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase()))
    .join(" ");
}

// Plural-looking words that stay as they are in front of a noun: "grounds lifespans".
const KEEP_S = new Set(["electronics", "grounds", "premises", "sports"]);

function singular(word: string): string {
  if (!isPlural(word) || word !== word.toLowerCase() || KEEP_S.has(word)) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  return /(ss|sh|ch|x|zz)es$/.test(word) ? word.slice(0, -2) : word.slice(0, -1);
}

/** A category in front of a noun: "HVAC lifespans", "appliance lifespans", "door and window lifespans". */
export function categoryAsModifier(category: string): string {
  return inSentence(asWords(category, "and"))
    .split(/( (?:and|or) )/)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      const words = part.split(" ");
      words[words.length - 1] = singular(words[words.length - 1]);
      return words.join(" ");
    })
    .join("");
}

// Search results cut titles off at about 60 characters and descriptions at about 155.
export const MAX_TITLE_LENGTH = 60;
export const MAX_DESCRIPTION_LENGTH = 155;

/** Keeps the year range in view: the brand only if it fits, a shorter form if the question doesn't. */
export function lifespanTitle(item: LibraryComponent): string {
  const { noun, plural } = subjectFor(item);
  const years = `${item.lifeLow}–${item.lifeHigh} Years`;
  const question = `How Long ${plural ? "Do" : "Does"} ${titleCase(noun)} Last? (${years})`;
  const branded = `${question} | CapexClock`;
  if (branded.length <= MAX_TITLE_LENGTH) return branded;
  if (question.length <= MAX_TITLE_LENGTH) return question;
  const thing = capitalize(titleCase(noun.replace(/^an? /, "")));
  const statement = `${thing} Lifespan: ${years}`;
  if (statement.length <= MAX_TITLE_LENGTH) return statement;
  // A very long name gives way so the years stay in view.
  return `${shorten(thing, MAX_TITLE_LENGTH - years.length - 2)}: ${years}`;
}

/** Cuts at a word break and adds "…" so the result is at most max characters. */
function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const kept = (space > 0 ? cut.slice(0, space) : cut).replace(/[\s,;:–-]+$/, "").replace(/ (a|an|and|or|the|of|with)$/i, "");
  return `${kept}…`;
}

/** Mentions what shortens its life and the end-of-life signs only when the page shows them. */
export function lifespanDescription(item: LibraryComponent, hasNotes: boolean): string {
  const { noun, plural } = subjectFor(item);
  const lead = `${capitalize(noun)} typically ${plural ? "last" : "lasts"} ${item.lifeLow} to ${item.lifeHigh} years.`;
  const them = plural ? "them" : "it";
  const full = hasNotes
    ? `${lead} See what shortens ${plural ? "their" : "its"} life, the signs ${plural ? "they're" : "it's"} near the end, and what to set aside to replace ${them}.`
    : `${lead} See when ${plural ? "yours are" : "yours is"} likely due and what to set aside to replace ${them}.`;
  if (full.length <= MAX_DESCRIPTION_LENGTH) return full;
  const short = `${lead} See what to set aside to replace ${them}.`;
  return short.length <= MAX_DESCRIPTION_LENGTH ? short : lead;
}

// Equipment wears with use. Everything else (roofs, paint, carpet, cabinets, seal
// coat, and any category added later) wears with age and care.
const EQUIPMENT_CATEGORIES = new Set(["HVAC", "Plumbing", "Appliances", "Electrical", "Safety"]);

/** What moves a component within its range, to end "Where yours falls in that range depends on ...". */
export function lifeDrivers(item: LibraryComponent): string {
  const { plural } = subjectFor(item);
  const itIs = plural ? "they're" : "it's";
  return EQUIPMENT_CATEGORIES.has(item.category)
    ? `how ${plural ? "they were" : "it was"} installed, how heavily ${itIs} used and how well ${itIs} maintained`
    : `the quality of the materials and the work, how much wear ${plural ? "they get" : "it gets"} and how well ${itIs} looked after`;
}
