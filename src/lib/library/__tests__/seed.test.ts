import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPONENT_LIBRARY } from "../components";

describe("component library seed", () => {
  it("matches the library the calculator uses", () => {
    const sql = readFileSync(join(__dirname, "../../../../supabase/seed.sql"), "utf8");
    const rows = [...sql.matchAll(/\('([^']+)', '([^']+)', '([^']+)', (\d+), (\d+), '([^']+)', (\d+)\)/g)].map(
      (m) => ({ slug: m[1], category: m[2], name: m[3], lifeLow: Number(m[4]), lifeHigh: Number(m[5]), unitLabel: m[6] }),
    );
    expect(rows).toEqual(COMPONENT_LIBRARY);
  });
});
