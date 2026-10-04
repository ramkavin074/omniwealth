import { describe, expect, it } from 'vitest';
import { detectNetWorthMove, netWorthAlertText } from './netWorthAlert';

describe('detectNetWorthMove', () => {
  it('reports any real move, up or down', () => {
    expect(detectNetWorthMove(100400, 100000)).toMatchObject({ direction: 'up' });
    expect(detectNetWorthMove(98300, 100000)).toMatchObject({ direction: 'down' });
  });
  it('stays quiet when nothing moved, or the baseline is unusable', () => {
    expect(detectNetWorthMove(100000, 100000)).toBeNull();
    expect(detectNetWorthMove(100010, 100000)).toBeNull(); // rounds to 0.0%
    expect(detectNetWorthMove(900, 500)).toBeNull(); // tiny household
    expect(detectNetWorthMove(100, 0)).toBeNull();
    expect(detectNetWorthMove(NaN, 100000)).toBeNull();
  });
});

describe('netWorthAlertText', () => {
  it('is percent-only (no amounts) and rounds sensibly', () => {
    const up = netWorthAlertText(detectNetWorthMove(104200, 100000)!);
    expect(up.title).toBe('Net worth up 4.2%');
    expect(up.body).not.toMatch(/\d{3,}/);
    expect(netWorthAlertText(detectNetWorthMove(87600, 100000)!).title).toBe('Net worth down 12%');
  });
});
