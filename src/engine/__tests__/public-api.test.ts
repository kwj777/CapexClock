import * as engine from "..";

// Changing what the engine offers is a deliberate step: update this list on purpose.
it("offers a deliberate set of functions and constants", () => {
  expect(Object.keys(engine).sort()).toMatchSnapshot();
  for (const value of Object.values(engine)) expect(["function", "number"]).toContain(typeof value);
});
