import type { ComponentCondition as DbCondition, UnitLabel as DbUnitLabel } from "@/lib/supabase/database.types";
import type { ComponentCondition, UnitLabel } from "@/verticals/landlord";

// The landlord vertical keeps its own copies of the database's enums, so it needs
// no app import. These checks fail to compile if either side gains or loses a value.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const same = <T extends true>(): T => true as T;

it("matches the database's unit labels and conditions", () => {
  expect(same<Same<UnitLabel, DbUnitLabel>>()).toBe(true);
  expect(same<Same<ComponentCondition, DbCondition>>()).toBe(true);
});
