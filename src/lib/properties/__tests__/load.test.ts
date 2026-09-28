import { fetchAllRows, PAGE_SIZE, type RowPage } from "../load";

function pages(total: number, cap = PAGE_SIZE) {
  const all = Array.from({ length: total }, (_, i) => i);
  const calls: Array<[number, number]> = [];
  const fetchPage = async (from: number, to: number): Promise<RowPage<number>> => {
    calls.push([from, to]);
    return { data: all.slice(from, Math.min(to + 1, from + cap)), error: null, count: total };
  };
  return { fetchPage, calls };
}

describe("reading every row", () => {
  it("reads a short list in one request", async () => {
    const { fetchPage, calls } = pages(6);
    await expect(fetchAllRows(fetchPage)).resolves.toHaveLength(6);
    expect(calls).toEqual([[0, PAGE_SIZE - 1]]);
  });

  it("pages past the API's row cap instead of stopping at 1,000", async () => {
    const { fetchPage, calls } = pages(2500);
    const rows = await fetchAllRows(fetchPage);
    expect(rows).toHaveLength(2500);
    expect(rows[2499]).toBe(2499);
    expect(calls.map(([from]) => from)).toEqual([0, 1000, 2000]);
  });

  it("keeps going when the project's cap is lower than a page", async () => {
    const { fetchPage } = pages(1200, 500);
    await expect(fetchAllRows(fetchPage)).resolves.toHaveLength(1200);
  });

  it("returns an empty list", async () => {
    const { fetchPage } = pages(0);
    await expect(fetchAllRows(fetchPage)).resolves.toEqual([]);
  });

  it("throws on an error instead of returning nothing", async () => {
    const failing = async (): Promise<RowPage<number>> => ({
      data: null,
      error: { message: "upstream connect error" },
      count: null,
    });
    await expect(fetchAllRows(failing)).rejects.toThrow("upstream connect error");
  });

  it("throws when rows go missing", async () => {
    const short = async (): Promise<RowPage<number>> => ({ data: [], error: null, count: 3 });
    await expect(fetchAllRows(short)).rejects.toThrow("Expected 3 rows");
  });
});
