import { clip, quote } from "../text";

/** Half of an emoji: a high surrogate with no low one after it, or a low one with none before. */
const LONE_HALF = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe("cutting text to fit", () => {
  it("leaves text that fits alone", () => {
    expect(clip("Water heater", 12)).toBe("Water heater");
    expect(quote("Jun-14")).toBe('"Jun-14"');
  });

  it("ends cut text with …, within the limit", () => {
    expect(clip("Water heater", 6)).toBe("Water…");
    expect(quote("x".repeat(50))).toBe(`"${"x".repeat(39)}…"`);
  });

  it("never cuts an emoji in half", () => {
    // "🚿" is two UTF-16 units; a cut at 5 would land between them.
    const text = "abcd🚿 shower";
    const cut = clip(text, 6);
    expect(cut).toBe("abcd…");
    expect(cut).not.toMatch(LONE_HALF);
    expect(clip("abc🚿 shower", 6)).toBe("abc🚿…");
    for (let max = 2; max < 30; max++) {
      const out = clip("🔥".repeat(20), max);
      expect(out.length).toBeLessThanOrEqual(max);
      expect(out).not.toMatch(LONE_HALF);
      expect(quote("a🔥".repeat(30), max)).not.toMatch(LONE_HALF);
    }
  });
});
