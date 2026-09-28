import { safeNext } from "../safe-next";

const ORIGIN = "https://capexclock.com";

/** What the callback does with the result: it must never leave the site. */
function landsOnSite(value: string | null): boolean {
  return new URL(safeNext(value), ORIGIN).origin === ORIGIN;
}

/** A query value as the browser sends it, decoded the way request.nextUrl does. */
function fromQuery(raw: string): string | null {
  return new URLSearchParams(`next=${raw}`).get("next");
}

describe("safeNext", () => {
  it("keeps normal same-site paths with their query and hash", () => {
    expect(safeNext("/app")).toBe("/app");
    expect(safeNext("/app/properties/new?from=calculator")).toBe("/app/properties/new?from=calculator");
    expect(safeNext("/app/properties/abc#components")).toBe("/app/properties/abc#components");
    expect(safeNext(fromQuery("%2Fapp%3Fx%3D1"))).toBe("/app?x=1");
  });

  it("falls back for missing, empty or non-path values", () => {
    expect(safeNext(null)).toBe("/app");
    expect(safeNext(undefined)).toBe("/app");
    expect(safeNext("")).toBe("/app");
    expect(safeNext("app")).toBe("/app");
    expect(safeNext("https://evil.example/")).toBe("/app");
    expect(safeNext("javascript:alert(1)")).toBe("/app");
    expect(safeNext(null, "/")).toBe("/");
  });

  it("rejects protocol-relative and backslash values", () => {
    expect(safeNext("//evil.example")).toBe("/app");
    expect(safeNext("/\\evil.example")).toBe("/app");
    expect(safeNext("/\\/evil.example")).toBe("/app");
    expect(safeNext("/app\\..\\..\\evil")).toBe("/app");
  });

  it("rejects tab, CR and LF, which the URL parser would strip", () => {
    for (const value of ["/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/\r\n/evil.example", "/\t\\evil.example"]) {
      expect(safeNext(value)).toBe("/app");
    }
  });

  it("rejects the percent-encoded forms once the query is decoded", () => {
    for (const raw of ["/%09/evil.example/phish", "/%0A/evil.example", "/%0D/evil.example", "/%0D%0A/evil.example", "/%09%5Cevil.example", "/%5C/evil.example", "%2F%2Fevil.example"]) {
      expect(safeNext(fromQuery(raw))).toBe("/app");
    }
  });

  it("rejects dot segments that collapse into another host", () => {
    expect(safeNext("/.//evil.example")).toBe("/app");
    expect(safeNext("/%2e//evil.example")).toBe("/app");
    expect(safeNext("/app/..//evil.example")).toBe("/app");
  });

  it("never resolves outside the site", () => {
    const attempts = [
      "/\t/evil.example", "/\n/evil.example", "//evil.example", "/\\evil.example", "/.//evil.example",
      "/%2e//evil.example", "https://evil.example", "/%2F/evil.example", "/ /evil.example",
    ];
    for (const value of attempts) expect(landsOnSite(value)).toBe(true);
  });
});
