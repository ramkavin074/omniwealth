export interface DatedPoint {
  date: string; // YYYY-MM-DD
  x: number;
}

export interface MarkerEvent {
  id: string;
  eventDate: string;
  label: string;
}

export interface PlacedMarker {
  id: string;
  label: string;
  date: string;
  x: number;
}

/**
 * Position events along the chart's x axis by interpolating between the two
 * neighbouring dated points. Events outside the charted window are skipped.
 */
export function placeEvents(events: MarkerEvent[], points: DatedPoint[]): PlacedMarker[] {
  const dated = points.filter((p) => p.date && !Number.isNaN(Date.parse(p.date)));
  if (dated.length < 2) return [];
  const t = dated.map((p) => Date.parse(p.date));
  const first = t[0];
  const last = t[t.length - 1];
  const out: PlacedMarker[] = [];
  for (const e of events) {
    const et = Date.parse(e.eventDate);
    if (Number.isNaN(et) || et < first || et > last) continue;
    let i = 0;
    while (i < t.length - 2 && et > t[i + 1]) i++;
    const span = t[i + 1] - t[i] || 1;
    const frac = Math.min(1, Math.max(0, (et - t[i]) / span));
    out.push({ id: e.id, label: e.label, date: e.eventDate, x: dated[i].x + frac * (dated[i + 1].x - dated[i].x) });
  }
  return out;
}
