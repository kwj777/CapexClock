import { COMPONENT_LIBRARY, groupByCategory, type LibraryComponent } from "../components";

describe("the calculator picker's groups", () => {
  it("lists every library item under its category, in library order", () => {
    const groups = groupByCategory(COMPONENT_LIBRARY);
    expect(Object.values(groups).flat()).toHaveLength(COMPONENT_LIBRARY.length);
    for (const [category, items] of Object.entries(groups)) {
      expect(items).toEqual(COMPONENT_LIBRARY.filter((c) => c.category === category));
    }
    expect(Object.keys(groups)).toEqual([...new Set(COMPONENT_LIBRARY.map((c) => c.category))]);
  });

  it("keeps a category named like an object's own key apart", () => {
    const item = { ...COMPONENT_LIBRARY[0], category: "constructor" } satisfies LibraryComponent;
    expect(groupByCategory([item]).constructor).toEqual([item]);
  });
});
