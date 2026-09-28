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

/** "an" before a vowel sound: "an HVAC unit", "an LED fixture", but "a unit heater". */
function article(word: string): "a" | "an" {
  if (/^[A-Z]{2}/.test(word)) return /^[AEFHILMNORSX]/.test(word) ? "an" : "a";
  if (/^(8|11|18)/.test(word)) return "an";
  const w = word.toLowerCase();
  if (/^(uni|us[aeu]|uti|ur[aeio]|eu|one)/.test(w)) return "a";
  return /^[aeiou]/.test(w) ? "an" : "a";
}

export function subjectFor(item: LibraryComponent): Subject {
  const known = SUBJECTS[item.name.trim().toLowerCase()];
  if (known) return known;
  const name = item.name.replace(/\s*\(.*?\)/g, "").replace(/\s*\/\s*/g, " or ").trim();
  const words = name.split(/\s+/);
  const last = words[words.length - 1].toLowerCase();
  const lower = /^[A-Z]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
  if (isPlural(last)) return { noun: lower, plural: true };
  if (MASS_NOUNS.has(last)) return { noun: lower, plural: false };
  return { noun: `${article(words[0])} ${lower}`, plural: false };
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

/** A category in front of a noun: "HVAC lifespans", "appliance lifespans". */
export function categoryAsModifier(category: string): string {
  const words = inSentence(category).split(" ");
  const last = words[words.length - 1];
  if (isPlural(last) && last === last.toLowerCase()) {
    words[words.length - 1] = last.endsWith("ies") ? `${last.slice(0, -3)}y` : last.replace(/(sh|ch|x)es$/, "$1").replace(/s$/, "");
  }
  return words.join(" ");
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
  return `${capitalize(titleCase(noun.replace(/^an? /, "")))} Lifespan: ${years}`;
}

/** Mentions what shortens its life and the end-of-life signs only when the page shows them. */
export function lifespanDescription(item: LibraryComponent, hasNotes: boolean): string {
  const { noun, plural } = subjectFor(item);
  const lead = `${capitalize(noun)} typically ${plural ? "last" : "lasts"} ${item.lifeLow} to ${item.lifeHigh} years.`;
  const them = plural ? "them" : "it";
  return hasNotes
    ? `${lead} See what shortens ${plural ? "their" : "its"} life, the signs ${plural ? "they're" : "it's"} near the end, and what to set aside to replace ${them}.`
    : `${lead} See when ${plural ? "yours are" : "yours is"} likely due and what to set aside to replace ${them}.`;
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
