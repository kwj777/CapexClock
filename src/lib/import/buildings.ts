import { SAVE_PROBLEM_TEXT, toSaveInput, type SaveInput } from "@/lib/properties/convert";
import type { SaveFailure } from "@/lib/properties/save";
import { EMPTY_DRAFT, withImportedRows, type Draft, type ImportedRow } from "@/verticals/landlord";
import type { BuildingInfo, Preview, PreviewRow } from "./preview";
import { listText, words } from "./text";

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
  /**
   * Rows (by index in `rows`) the preview marks Needs you: a question not answered
   * yet, or a cell that couldn't be read. They'd be saved as a guess, so the property
   * waits until they're answered or fixed.
   */
  waiting: number[];
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

/** The planned property for one building, filled in from the sheet. `waiting` are rows that need the owner. */
export function planProperty(
  tab: number,
  building: BuildingInfo,
  rows: ImportedRow[],
  names: { tab: string | null; file: string | null },
  waiting: number[] = [],
): PlannedProperty {
  return {
    id: plannedId(tab, building.key),
    tab,
    building: building.key,
    name: startingName(building, names.tab, names.file).slice(0, 200),
    unitCount: building.unitCount === null ? "" : String(building.unitCount),
    yearBuilt: building.yearBuilt === null ? "" : String(building.yearBuilt),
    rows,
    waiting,
    notes: building.notes,
  };
}

/**
 * A planned property for each building in one tab's preview (the whole tab when it
 * names no buildings). One preview of every row is split by building, so a sheet of
 * many buildings is read once, not once for each.
 */
export function planProperties(
  tab: number,
  preview: Pick<Preview, "buildings" | "rows">,
  names: { tab: string | null; file: string | null },
): PlannedProperty[] {
  const byBuilding = new Map<string, PreviewRow[]>();
  for (const r of preview.rows) {
    const list = byBuilding.get(r.building);
    if (list) list.push(r);
    else byBuilding.set(r.building, [r]);
  }
  return preview.buildings.map((b) => {
    const rows = byBuilding.get(b.key) ?? [];
    const waiting = rows.flatMap((r, i) => (r.status === "needs_you" ? [i] : []));
    return planProperty(tab, b, rows.map((r) => r.row), names, waiting);
  });
}

/** A property's name in a form that ignores case, spaces and punctuation, so "12 Elm St" and "12 elm st." match. */
export function propertyNameKey(name: string): string {
  return words(name);
}

/**
 * The properties ticked to start with: the first MAX_PROPERTIES whose names aren't
 * already in My properties. One that is starts unticked, so importing a sheet again
 * for the buildings left over doesn't make the others twice.
 */
export function startingPicks(
  properties: readonly Pick<PlannedProperty, "id" | "name">[],
  existingNames: ReadonlySet<string>,
): Set<string> {
  const fresh = properties.filter((p) => !existingNames.has(propertyNameKey(p.name)));
  return new Set(fresh.slice(0, MAX_PROPERTIES).map((p) => p.id));
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

/** The property's own fields, which the owner checks before it's created. */
export type PropertyField = "name" | "unitCount" | "yearBuilt";

/** Each of the property's own fields that stops it being created, with what to do. */
export function propertyFieldProblems(
  property: Pick<PlannedProperty, "name" | "unitCount" | "yearBuilt">,
  currentYear: number,
): { field: PropertyField; text: string }[] {
  const found: { field: PropertyField; text: string }[] = [];
  if (property.name.trim() === "") found.push({ field: "name", text: NO_NAME_TEXT });
  // Checked one at a time, so a bad unit count doesn't hide a bad year built.
  const check = (unitCount: string, yearBuilt: string) =>
    toSaveInput(property.name, { ...EMPTY_DRAFT, unitCount, yearBuilt }, currentYear).problems.property;
  const units = property.unitCount.trim();
  // The editor saves a blank unit count as 0, but a new property needs one for its per-unit amount.
  if (/^0*$/.test(units)) found.push({ field: "unitCount", text: NO_UNITS_TEXT });
  else if (check(units, "") === "unit_count") found.push({ field: "unitCount", text: SAVE_PROBLEM_TEXT.unit_count });
  if (check("1", property.yearBuilt.trim()) === "year_built") found.push({ field: "yearBuilt", text: SAVE_PROBLEM_TEXT.year_built });
  return found;
}

/** Up to four names, then "and N more": "Boiler, Roof, Carpet and 2 more". */
function someNames(names: readonly string[]): string {
  return listText(names.length > 4 ? [...names.slice(0, 3), `${names.length - 3} more`] : names);
}

/**
 * Why a property can't be created yet, in the owner's words, or [] when it can:
 * its name, unit count or year built, then rows that need the owner, by name, then
 * other rows that can't be saved. Rows that need the owner are saved as the preview
 * guessed, so they're answered or fixed first.
 */
export function plannedProblems(property: PlannedProperty, currentYear: number): string[] {
  const draft = plannedDraft(property);
  const { problems } = toSaveInput(property.name, draft, currentYear);
  const lines = propertyFieldProblems(property, currentYear).map((p) => p.text);
  const waiting = new Set(property.waiting);
  // The draft's rows are the property's rows, in the same order.
  const name = (r: { name: string }) => r.name.trim() || "a row with no name";
  if (waiting.size > 0) {
    const names = property.rows.filter((_, i) => waiting.has(i)).map(name);
    lines.push(
      `${someNames(names)} ${names.length === 1 ? "needs" : "need"} you. Answer or fix ${
        names.length === 1 ? "it" : "them"
      } under Check the columns and rows first.`,
    );
  }
  const bad = draft.rows.filter((r, i) => problems[r.id] && !waiting.has(i));
  if (bad.length > 0) {
    const why = [...new Set(bad.map((r) => SAVE_PROBLEM_TEXT[problems[r.id]]))].join(" ");
    lines.push(`Fix ${someNames(bad.map(name))} in the preview first. ${why}`);
  }
  return lines;
}

/**
 * What the import panel's live region reads once the plan settles:
 * "3 properties to create from 41 rows. 2 rows need you." `planned` counts the
 * buildings found, ticked or not.
 */
export function portfolioSummary(properties: readonly Pick<PlannedProperty, "rows" | "waiting">[], planned: number): string {
  if (properties.length === 0) {
    if (planned === 1) return "The property isn't ticked to create. Tick it to make it.";
    return planned > 1
      ? `None of the ${count(planned, "building")} are ticked to create. Tick the ones to make.`
      : "No properties to create yet. Tick a tab with rows.";
  }
  const rows = properties.reduce((n, p) => n + p.rows.length, 0);
  const waiting = properties.reduce((n, p) => n + p.waiting.length, 0);
  const made = `${count(properties.length, "property", "properties")} to create from ${count(rows, "row")}.`;
  return waiting > 0 ? `${made} ${count(waiting, "row needs", "rows need")} you.` : made;
}

/**
 * What the live region reads about the plan, or "" for nothing: the properties ticked
 * and not created yet, once the sheet is read. While properties are being created, and
 * after, until more are ticked, the progress and the result say what happened instead.
 */
export function planAnnouncement(
  state: { read: boolean; running: boolean; started: boolean },
  pending: readonly Pick<PlannedProperty, "rows" | "waiting">[],
  planned: number,
): string {
  if (!state.read || state.running || (state.started && pending.length === 0)) return "";
  return portfolioSummary(pending, planned);
}

/**
 * Tabs with a property already sent to be created. Which building each of their rows
 * is in can't change any more (the tab can't be unticked, and its Building column and
 * layout stay as they are), or a building already created could be planned again
 * under another name and made twice. Everything else in their review can change, for
 * the properties not created yet.
 */
export function sentTabs(planned: readonly Pick<PlannedProperty, "id" | "tab">[], results: Readonly<Record<string, unknown>>): Set<number> {
  return new Set(planned.filter((p) => results[p.id] !== undefined).map((p) => p.tab));
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** What happened to one property when the owner clicked Create. */
export type CreateResult =
  | { status: "created"; propertyId: string; components: number; detailsDropped: boolean }
  | { status: "failed"; failure: SaveFailure };

/** Why a property wasn't created, and what to do. Nothing typed is lost: the list stays on screen. */
export const CREATE_FAILURE_TEXT: Record<SaveFailure, string> = {
  signed_out: "You've been signed out. Sign in again in another tab, then click Retry failed.",
  rejected: "One of the values isn't allowed. Check the name, units, year built and the rows, then retry.",
  network: "Couldn't reach CapexClock. Check your connection, then click Retry failed.",
  // Not expected for a new property; worded so retrying is still the answer.
  conflict: "Couldn't save it this time. Click Retry failed.",
  deleted: "Couldn't save it this time. Click Retry failed.",
};

/**
 * Creates the properties one at a time, in order, reporting each as it lands.
 * Once the account is signed out, the rest aren't sent: they'd fail the same way.
 */
export async function createInTurn(
  ids: readonly string[],
  create: (id: string) => Promise<CreateResult>,
  onResult: (id: string, result: CreateResult) => void,
): Promise<void> {
  let signedOut = false;
  for (const id of ids) {
    const result: CreateResult = signedOut ? { status: "failed", failure: "signed_out" } : await create(id);
    if (result.status === "failed" && result.failure === "signed_out") signedOut = true;
    onResult(id, result);
  }
}

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
