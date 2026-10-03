import * as engine from "@/engine";
import * as landlordApi from "..";

// Everything the app can reach in the vertical. A change to this list is a change
// to what the app may call, so it should be on purpose.

it("hands no engine function to the app unwrapped", () => {
  const engineFunctions = new Set<unknown>(Object.values(engine).filter((v) => typeof v === "function"));
  const leaked = Object.entries(landlordApi)
    .filter(([, v]) => engineFunctions.has(v))
    .map(([k]) => k);
  expect(leaked).toEqual([]);
});

it("has a deliberate public API", () => {
  expect(Object.keys(landlordApi).sort()).toMatchSnapshot();
});
