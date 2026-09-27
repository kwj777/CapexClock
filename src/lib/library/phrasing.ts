import type { LibraryComponent } from "./components";

export interface Subject {
  /** Lower-case noun phrase with its article, e.g. "an asphalt shingle roof" or "vinyl windows". */
  noun: string;
  plural: boolean;
}

// Library names are table labels ("Range / oven"); these read naturally in a sentence.
const SUBJECTS: Record<string, Subject> = {
  "flat-membrane-roof": { noun: "a flat or membrane roof", plural: false },
  gutters: { noun: "gutters and downspouts", plural: true },
  "central-ac": { noun: "a central AC condenser", plural: false },
  "range-oven": { noun: "a range or oven", plural: false },
  "washer-dryer": { noun: "a washer and dryer", plural: false },
  carpet: { noun: "carpet", plural: false },
  "luxury-vinyl-plank": { noun: "luxury vinyl plank flooring", plural: false },
  "interior-paint": { noun: "interior paint", plural: false },
  "kitchen-cabinets": { noun: "kitchen cabinets", plural: true },
  "laminate-countertops": { noun: "laminate countertops", plural: true },
  "vinyl-windows": { noun: "vinyl windows", plural: true },
  "exterior-paint": { noun: "exterior paint", plural: false },
  "vinyl-siding": { noun: "vinyl siding", plural: false },
  "parking-lot-resurface": { noun: "a resurfaced parking lot", plural: false },
};

export function subjectFor(item: LibraryComponent): Subject {
  const known = SUBJECTS[item.slug];
  if (known) return known;
  const name = item.name.replace(/\s*\(.*?\)/g, "").replace(/\s*\/\s*/g, " or ");
  const lower = /^[A-Z]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
  return { noun: `${/^[aeiou]/i.test(lower) ? "an" : "a"} ${lower}`, plural: false };
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
