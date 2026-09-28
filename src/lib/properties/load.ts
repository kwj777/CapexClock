/**
 * Supabase's API returns at most this many rows per request by default (the
 * project's "Max rows" setting), and says nothing when it cuts a list short.
 */
export const PAGE_SIZE = 1000;

export interface RowPage<T> {
  data: T[] | null;
  error: { message: string } | null;
  count: number | null;
}

/**
 * Reads every row of a query, a page at a time, so the row cap can't silently
 * drop rows. `fetchPage` must ask for an exact count and a stable order. Throws
 * when any page fails or the rows don't add up to the count, so a caller never
 * works from a partial list.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<RowPage<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const { data, error, count } = await fetchPage(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || count === null) throw new Error("The database returned no rows or count.");
    rows.push(...data);
    if (data.length === 0 || rows.length >= count) {
      if (rows.length !== count) throw new Error(`Expected ${count} rows but read ${rows.length}.`);
      return rows;
    }
  }
}
