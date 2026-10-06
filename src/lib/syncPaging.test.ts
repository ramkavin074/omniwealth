import { describe, expect, it } from 'vitest';
import { chunkRows, nextPullCursor, withinPage } from './syncPaging';

const ORDER = ['products', 'movements', 'sales'] as const;
const mk = (n: number, pad = 0) => Array.from({ length: n }, (_, i) => ({ id: i, pad: 'x'.repeat(pad) }));

describe('chunkRows', () => {
  it('returns no batches when there is nothing to push', () => {
    expect(chunkRows(ORDER, { products: [], movements: [], sales: [] })).toEqual([]);
  });

  it('splits by row count, keeps every row exactly once, and keeps parents first', () => {
    const rows = { products: mk(5), movements: mk(7), sales: mk(4) };
    const chunks = chunkRows(ORDER, rows, 5, 1e9);
    expect(chunks.map((c) => c.products.length + c.movements.length + c.sales.length)).toEqual([5, 5, 5, 1]);
    expect(chunks.reduce((n, c) => n + c.products.length, 0)).toBe(5);
    expect(chunks.reduce((n, c) => n + c.movements.length, 0)).toBe(7);
    expect(chunks.reduce((n, c) => n + c.sales.length, 0)).toBe(4);
    expect(chunks[0].products).toHaveLength(5); // products fill the first batch before movements
    expect(chunks[0].movements).toHaveLength(0);
    for (const c of chunks) expect(Object.keys(c)).toEqual(['products', 'movements', 'sales']);
  });

  it('also splits by payload size, never emitting an empty batch', () => {
    const rows = { products: [], movements: [], sales: mk(10, 1000) };
    const chunks = chunkRows(ORDER, rows, 1000, 3500);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.sales.length > 0)).toBe(true);
    expect(chunks.reduce((n, c) => n + c.sales.length, 0)).toBe(10);
  });

  it('puts a single oversized row in its own batch instead of dropping it', () => {
    const chunks = chunkRows(ORDER, { products: [], movements: [], sales: [{ id: 1, pad: 'x'.repeat(5000) }] }, 10, 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sales).toHaveLength(1);
  });

  it('handles a store-sized load within the server limits', () => {
    const rows = { products: mk(10000), movements: mk(83207), sales: mk(30131) };
    const chunks = chunkRows(ORDER, rows, 3000, 2_000_000);
    expect(chunks.reduce((n, c) => n + c.products.length + c.movements.length + c.sales.length, 0)).toBe(123338);
    expect(Math.max(...chunks.map((c) => c.products.length + c.movements.length + c.sales.length))).toBeLessThanOrEqual(3000);
  });
});

describe('nextPullCursor', () => {
  it('uses now when no table filled its page', () => {
    expect(nextPullCursor([{ count: 5, lastSyncedAtMs: 100 }, { count: 0, lastSyncedAtMs: null }], 999)).toEqual({ more: false, cursor: 999 });
  });

  it('pages from the earliest full table, one millisecond back', () => {
    const r = nextPullCursor(
      [{ count: 10000, lastSyncedAtMs: 500 }, { count: 10000, lastSyncedAtMs: 300 }, { count: 7, lastSyncedAtMs: 900 }],
      1000,
    );
    expect(r).toEqual({ more: true, cursor: 299 });
  });

  it('respects a custom limit', () => {
    expect(nextPullCursor([{ count: 3, lastSyncedAtMs: 50 }], 80, 3)).toEqual({ more: true, cursor: 49 });
  });
});

describe('withinPage', () => {
  const at = (ms: number) => ({ syncedAt: new Date(ms) });

  it('returns everything when the pull is complete', () => {
    const rows = [at(1), at(500)];
    expect(withinPage(rows, { more: false, cursor: 10 })).toEqual(rows);
  });

  it('trims later rows but keeps the boundary millisecond', () => {
    const rows = [at(100), at(300), at(301), at(900)];
    // cursor 299 => boundary is 300, so 300 stays and 301/900 wait for the next page
    expect(withinPage(rows, { more: true, cursor: 299 }).map((r) => r.syncedAt.getTime())).toEqual([100, 300]);
  });

  it('tolerates a missing timestamp', () => {
    expect(withinPage([{ syncedAt: null }], { more: true, cursor: 5 })).toHaveLength(1);
  });
});
