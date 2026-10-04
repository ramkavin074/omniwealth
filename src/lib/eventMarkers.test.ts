import { describe, expect, it } from 'vitest';
import { placeEvents } from './eventMarkers';

const pts = [
  { date: '2026-01-01', x: 0 },
  { date: '2026-01-11', x: 100 },
  { date: '2026-01-21', x: 200 },
];
const ev = (id: string, eventDate: string) => ({ id, eventDate, label: id });

describe('placeEvents', () => {
  it('interpolates between neighbouring points', () => {
    const [m] = placeEvents([ev('a', '2026-01-06')], pts);
    expect(m.x).toBeCloseTo(50);
    expect(placeEvents([ev('b', '2026-01-16')], pts)[0].x).toBeCloseTo(150);
  });

  it('includes the endpoints and skips events outside the window', () => {
    const out = placeEvents([ev('start', '2026-01-01'), ev('end', '2026-01-21'), ev('before', '2025-12-31'), ev('after', '2026-02-01')], pts);
    expect(out.map((m) => m.id)).toEqual(['start', 'end']);
  });

  it('needs at least two dated points', () => {
    expect(placeEvents([ev('a', '2026-01-01')], [pts[0]])).toEqual([]);
    expect(placeEvents([ev('a', '2026-01-01')], [{ date: '', x: 0 }, { date: '', x: 1 }])).toEqual([]);
  });
});
