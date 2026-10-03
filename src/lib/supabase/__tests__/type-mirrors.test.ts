import type {
  ComponentCondition as DbCondition,
  ComponentRow,
  PropertyRow,
  UnitLabel as DbUnitLabel,
} from "@/lib/supabase/database.types";
import type { ComponentCondition, SavedComponent, SavedProperty, UnitLabel } from "@/verticals/landlord";

// The landlord vertical keeps its own copies of the database's enums, so it needs
// no app import. These checks fail to compile if either side gains or loses a value.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Fits<A, B> = [A] extends [B] ? true : false;
const same = <T extends true>(): T => true as T;

it("matches the database's unit labels and conditions", () => {
  expect(same<Same<UnitLabel, DbUnitLabel>>()).toBe(true);
  expect(same<Same<ComponentCondition, DbCondition>>()).toBe(true);
});

// Saved properties and their rows go to the vertical as the database returns them.
it("hands the vertical the database's saved rows as they are", () => {
  expect(same<Fits<PropertyRow, SavedProperty>>()).toBe(true);
  expect(same<Fits<ComponentRow, SavedComponent>>()).toBe(true);
});
