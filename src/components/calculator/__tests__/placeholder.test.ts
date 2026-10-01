import { exampleDraft, rowFromLibrary, type Draft } from "../draft";
import { placeholderHeight, placeholderScript } from "../placeholder";
import { COMPONENT_LIBRARY } from "@/lib/library/components";

const waterHeater = COMPONENT_LIBRARY.find((c) => c.slug === "tank-water-heater")!;
const saved = (draft: Draft) => JSON.stringify(draft);

// Heights of the rendered calculator, measured in Chromium (px).
const MEASURED = {
  390: { oneRow: 1084, twoRows: 1525, oneRowWithForecast: 2343, example: 5111 },
  640: { oneRow: 850, twoRows: 1173, oneRowWithForecast: 1839, example: 4013 },
  1280: { oneRow: 661, twoRows: 830, oneRowWithForecast: 1320, example: 2580 },
};

describe("the calculator's loading placeholder", () => {
  it("uses the empty calculator's height when nothing is saved or it can't be read", () => {
    expect(placeholderHeight(null, 390)).toBeNull();
    expect(placeholderHeight("not json", 390)).toBeNull();
    expect(placeholderHeight(saved({ unitCount: "12", yearBuilt: "1998", rows: [] }), 1280)).toBeNull();
  });

  it("never holds more room than the saved draft will take, so nothing below moves up", () => {
    const oneRow: Draft = { unitCount: "12", yearBuilt: "", rows: [rowFromLibrary(waterHeater, "12")] };
    const twoRows: Draft = { ...oneRow, rows: [...oneRow.rows, rowFromLibrary(waterHeater, "12")] };
    const withForecast: Draft = {
      unitCount: "",
      yearBuilt: "",
      rows: [{ ...rowFromLibrary(waterHeater, ""), installYear: "2026", usefulLife: "15", costEach: "1400" }],
    };
    for (const [width, m] of Object.entries(MEASURED)) {
      const w = Number(width);
      expect(placeholderHeight(saved(oneRow), w)).toBeLessThanOrEqual(m.oneRow);
      expect(placeholderHeight(saved(twoRows), w)).toBeLessThanOrEqual(m.twoRows);
      expect(placeholderHeight(saved(withForecast), w)).toBeLessThanOrEqual(m.oneRowWithForecast);
      expect(placeholderHeight(saved(exampleDraft()), w)).toBeLessThanOrEqual(m.example);
    }
  });

  it("holds much more room once a saved draft shows a forecast", () => {
    const noCost: Draft = { unitCount: "12", yearBuilt: "1998", rows: [rowFromLibrary(waterHeater, "12")] };
    const costed: Draft = { ...noCost, rows: [{ ...noCost.rows[0], costEach: "1400" }] };
    expect(placeholderHeight(saved(costed), 1280)! - placeholderHeight(saved(noCost), 1280)!).toBeGreaterThan(500);
    // Year built stands in for a blank install year; with neither there's no forecast.
    expect(placeholderHeight(saved({ ...costed, yearBuilt: "" }), 1280)).toBe(placeholderHeight(saved(noCost), 1280));
  });

  it("runs as a stand-alone inline script that sizes the element before it", () => {
    const element = { style: { height: "" } };
    const storage = new Map([["capexclock:calculator:v1", saved(exampleDraft())]]);
    const run = new Function("document", "localStorage", "window", placeholderScript("capexclock:calculator:v1"));
    run({ currentScript: { previousElementSibling: element } }, { getItem: (k: string) => storage.get(k) ?? null }, { innerWidth: 1280 });
    expect(element.style.height).toBe(`${placeholderHeight(saved(exampleDraft()), 1280)}px`);
  });
});
