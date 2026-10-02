import { EMPTY_DRAFT, withImportedRows, type Draft } from "@/components/calculator/draft";
import { SAVE_PROBLEM_TEXT, toSaveInput, type SaveInput } from "@/lib/properties/convert";
import type { BuildingInfo, ImportedRow } from "./preview";
import { listText } from "./text";

/** Most properties one import creates. */
export const MAX_PROPERTIES = 20;

/** A property to create from one building of a sheet, or one tab. */
export interface PlannedProperty {
  /** Stays the same while the sheet does: the tab and the building's key. */
  id: string;
  tab: number;
  building: string;
  name: string;
  unitCount: string;
  yearBuilt: string;
  rows: ImportedRow[];
  /** What the sheet said about the building that the owner should check. */
  notes: string[];
}

/** What the owner typed over a property's name, unit count or year built. */
export type PropertyEdits = Partial<Pick<PlannedProperty, "name" | "unitCount" | "yearBuilt">>;

export function plannedId(tab: number, building: string): string {
  return `${tab}:${building}`;
}

/**
 * A property's starting name: the building's name from the sheet, else the tab's
 * name, else the file's name without its extension, else "Imported property". A
 * workbook's only tab named Sheet1 says nothing, so the file's name is used then.
 */
export function startingName(building: BuildingInfo, tabName: string | null, fileName: string | null): string {
  if (building.name !== "") return building.name;
  const file = fileName?.replace(/\.[a-z0-9]+$/i, "").trim() ?? "";
  if (tabName && !/^sheet\s*\d+$/i.test(tabName)) return tabName;
  return file || tabName || "Imported property";
}

/** The planned property for one building, filled in from the sheet. */
export function planProperty(
  tab: number,
  building: BuildingInfo,
  rows: ImportedRow[],
  names: { tab: string | null; file: string | null },
): PlannedProperty {
  return {
    id: plannedId(tab, building.key),
    tab,
    building: building.key,
    name: startingName(building, names.tab, names.file).slice(0, 200),
    unitCount: building.unitCount === null ? "" : String(building.unitCount),
    yearBuilt: building.yearBuilt === null ? "" : String(building.yearBuilt),
    rows,
    notes: building.notes,
  };
}

/** The property with the owner's edits. */
export function withEdits(property: PlannedProperty, edits: PropertyEdits | undefined): PlannedProperty {
  return edits ? { ...property, ...edits } : property;
}

/** The property as the editor would hold it, ready for toSaveInput. */
export function plannedDraft(property: Pick<PlannedProperty, "unitCount" | "yearBuilt" | "rows">): Draft {
  return withImportedRows({ ...EMPTY_DRAFT, unitCount: property.unitCount.trim(), yearBuilt: property.yearBuilt.trim() }, property.rows);
}

/** What save_property needs for a new property, and what stops it being saved. */
export function plannedSave(property: PlannedProperty, currentYear: number): SaveInput {
  return toSaveInput(property.name, plannedDraft(property), currentYear);
}

export const NO_NAME_TEXT = "Give the property a name.";
export const NO_UNITS_TEXT = "Type how many rental units it has.";

/**
 * Why a property can't be created yet, in the owner's words, or [] when it can:
 * its name, unit count or year built, then rows that need fixing, by name.
 */
export function plannedProblems(property: PlannedProperty, currentYear: number): string[] {
  const draft = plannedDraft(property);
  const { problems } = toSaveInput(property.name, draft, currentYear);
  const lines: string[] = [];
  if (property.name.trim() === "") lines.push(NO_NAME_TEXT);
  // The editor saves a blank unit count as 0, but a new property needs one for its per-unit amount.
  if (/^0*$/.test(property.unitCount.trim())) lines.push(NO_UNITS_TEXT);
  else if (problems.property) lines.push(SAVE_PROBLEM_TEXT[problems.property]);
  const bad = draft.rows.filter((r) => problems[r.id]);
  if (bad.length > 0) {
    const names = bad.map((r) => r.name.trim() || "a row with no name");
    const shown = names.length > 4 ? [...names.slice(0, 3), `${names.length - 3} more`] : names;
    const why = [...new Set(bad.map((r) => SAVE_PROBLEM_TEXT[problems[r.id]]))].join(" ");
    lines.push(`Fix ${listText(shown)} in the preview first. ${why}`);
  }
  return lines;
}

/** What happened to one property when the owner clicked Create. */
export type CreateResult =
  | { status: "created"; propertyId: string; components: number; detailsDropped: boolean }
  | { status: "failed"; message: string };

/** "Created 3 properties. 1 didn't save." */
export function createSummary(results: readonly CreateResult[]): string {
  const created = results.filter((r) => r.status === "created").length;
  const failed = results.length - created;
  const parts: string[] = [];
  if (created > 0) parts.push(`Created ${created} ${created === 1 ? "property" : "properties"}.`);
  if (failed > 0) parts.push(`${failed} didn't save.`);
  return parts.join(" ");
}

/** The button that creates them: "Create 3 properties". */
export function createLabel(count: number): string {
  return `Create ${count} ${count === 1 ? "property" : "properties"}`;
}
