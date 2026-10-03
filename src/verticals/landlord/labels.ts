import type { Noun, VerticalLabels } from "../vertical";

/** The landlord's words, for generated text that picks a word by count. */
export const LANDLORD_LABELS = {
  assetGroup: { one: "property", many: "properties" },
  divisor: { one: "unit", many: "units" },
  terms: {
    unit: { one: "unit", many: "units" },
    door: { one: "door", many: "doors" },
    apartment: { one: "apartment", many: "apartments" },
    building: { one: "building", many: "buildings" },
  },
} as const satisfies VerticalLabels;

/** "unit" for 1, "units" for any other count. The caller writes the number its own way. */
export function countNoun(noun: Noun, count: number): string {
  return count === 1 ? noun.one : noun.many;
}
