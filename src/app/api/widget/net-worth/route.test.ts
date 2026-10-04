import { beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny fake database keyed by table, so the route's real logic runs.
const state = vi.hoisted(() => ({ rows: new Map<unknown, unknown[]>(), rateOk: true, updates: 0 }));

vi.mock('@/db', async () => {
  const schema = await import('@/db/schema');
  const chain = (table: unknown): any => {
    const c: any = {
      from: (t: unknown) => chain(t),
      where: () => c,
      set: () => c,
      then: (res: any, rej: any) => Promise.resolve(state.rows.get(table) ?? []).then(res, rej),
      catch: () => c,
    };
    return c;
  };
  return {
    db: {
      select: () => ({ from: (t: unknown) => chain(t) }),
      update: () => ({ set: () => ({ where: () => { state.updates++; return Promise.resolve([]); } }) }),
    },
    __schema: schema,
  };
});
vi.mock('@/actions/vault', () => ({ fetchLiveExchangeRatesAction: async () => ({ USD: 1, INR: 83.3 }) }));
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: async () => ({ allowed: state.rateOk }) }));

import { assets, households, widgetKeys } from '@/db/schema';
import { generateWidgetKey } from '@/lib/widgetKey';
import { GET } from './route';

const req = (auth?: string) => new Request('https://x.test/api/widget/net-worth', { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  state.rateOk = true;
  state.updates = 0;
  state.rows.clear();
  state.rows.set(widgetKeys, [{ id: 'k1', householdId: 'h1' }]);
  state.rows.set(households, [{ id: 'h1', baseCurrency: 'USD' }]);
  state.rows.set(assets, [
    { nativeValue: '100000', nativeCurrency: 'USD', assetType: 'STOCK', accountCategory: 'INDIVIDUAL' },
    { nativeValue: '20000', nativeCurrency: 'USD', assetType: 'LIABILITY', accountCategory: 'LIABILITY' },
  ]);
});

describe('GET /api/widget/net-worth', () => {
  it('answers every bad request the same way (401, no detail)', async () => {
    for (const auth of [undefined, 'Bearer', 'Bearer nope', 'Basic abc', 'Bearer owk_short']) {
      const res = await GET(req(auth));
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: 'unauthorized' });
    }
  });

  it('returns 401 when the key is unknown, revoked or expired (no matching row)', async () => {
    state.rows.set(widgetKeys, []);
    const res = await GET(req(`Bearer ${generateWidgetKey()}`));
    expect(res.status).toBe(401);
  });

  it('returns only the net worth total and currency for a valid key, uncached', async () => {
    const res = await GET(req(`Bearer ${generateWidgetKey()}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(['amount', 'currency', 'updatedAt']);
    expect(body).toMatchObject({ amount: 80000, currency: 'USD' });
  });

  it('rate-limits a runaway client', async () => {
    state.rateOk = false;
    expect((await GET(req(`Bearer ${generateWidgetKey()}`))).status).toBe(429);
  });
});
