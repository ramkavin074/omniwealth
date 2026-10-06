// Pure helpers shared by the Kadai sync client (src/stocking/sync.ts) and the
// server route (src/app/api/stocking/sync/route.ts): how to split a large push
// into batches, and how to page a large pull without silently dropping rows.

/** Rows the server returns per table per request. */
export const PULL_PAGE_ROWS = 10000;
/** A push request never carries more than this many rows (server hard limit is 10,000). */
export const PUSH_CHUNK_ROWS = 3000;
/** ...or more than roughly this many bytes (serverless request bodies cap near 4.5 MB). */
export const PUSH_CHUNK_BYTES = 2_000_000;

/**
 * Split rows (keyed by table, in the given order) into batches no bigger than
 * `maxRows` / `maxBytes`. Earlier tables fill first, so list parents (products,
 * customers, suppliers) before the rows that refer to them. Every batch has a key
 * for every table (possibly empty). No rows at all => no batches.
 */
export function chunkRows<K extends string>(
  order: readonly K[],
  rows: Record<K, unknown[]>,
  maxRows = PUSH_CHUNK_ROWS,
  maxBytes = PUSH_CHUNK_BYTES,
): Record<K, unknown[]>[] {
  const empty = () => Object.fromEntries(order.map((k) => [k, [] as unknown[]])) as Record<K, unknown[]>;
  const chunks: Record<K, unknown[]>[] = [];
  let cur = empty();
  let curRows = 0;
  let curBytes = 0;
  for (const key of order) {
    for (const row of rows[key] ?? []) {
      const size = JSON.stringify(row).length;
      if (curRows > 0 && (curRows >= maxRows || curBytes + size > maxBytes)) {
        chunks.push(cur);
        cur = empty();
        curRows = 0;
        curBytes = 0;
      }
      cur[key].push(row);
      curRows++;
      curBytes += size;
    }
  }
  if (curRows > 0) chunks.push(cur);
  return chunks;
}

export interface TablePage {
  /** Rows this table returned in the page. */
  count: number;
  /** `synced_at` (epoch ms) of the last row returned, when any. */
  lastSyncedAtMs: number | null;
}

/**
 * Decide the cursor to hand back. If no table filled its page, everything newer
 * than the request was delivered: the cursor is `now` and there is nothing more.
 * Otherwise return the earliest "last row" among the full tables, minus 1 ms so rows
 * sharing the boundary timestamp are sent again (the client merges by id, so
 * repeats are harmless) instead of being skipped.
 */
export function nextPullCursor(
  pages: TablePage[],
  now: number,
  limit = PULL_PAGE_ROWS,
): { more: boolean; cursor: number } {
  const full = pages.filter((p) => p.count >= limit && p.lastSyncedAtMs !== null);
  if (full.length === 0) return { more: false, cursor: now };
  return { more: true, cursor: Math.min(...full.map((p) => p.lastSyncedAtMs as number)) - 1 };
}

/**
 * When a pull is paged, every table must stop at the same boundary: a table that
 * did not fill its page may hold rows newer than the cursor, and those arrive on
 * a later page anyway (sending them now would just download them again each page).
 * `cursor` is the value from `nextPullCursor`; rows exactly at cursor + 1 (the
 * boundary millisecond) are kept so none are skipped.
 */
export function withinPage<T extends { syncedAt: Date | null }>(
  rows: T[],
  paging: { more: boolean; cursor: number },
): T[] {
  if (!paging.more) return rows;
  const limit = paging.cursor + 1;
  return rows.filter((r) => (r.syncedAt?.getTime() ?? 0) <= limit);
}
