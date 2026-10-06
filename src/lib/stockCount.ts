// Stock-take arithmetic: compare what was counted with what the app thinks is on the
// shelf. Pure.

const q3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const q2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface CountInput {
  id: string;
  name: string;
  system: number; // quantity the app has
  counted: number | null; // null = not counted
  unitCost: number; // for valuing the difference (cost, else selling price)
}

export interface CountLine extends CountInput {
  counted: number;
  diff: number; // counted − system (negative = shortage)
  value: number; // diff × unitCost
}

export interface CountSummary {
  countedItems: number;
  changed: CountLine[]; // lines whose count differs from the system quantity
  matched: number; // counted and equal
  shortageQty: number; // sum of negative diffs (as a positive number)
  excessQty: number;
  shortageValue: number; // ₹ value of shortages (positive number)
  excessValue: number;
}

export function summariseCount(items: CountInput[]): CountSummary {
  const changed: CountLine[] = [];
  let matched = 0;
  let countedItems = 0;
  let shortageQty = 0;
  let excessQty = 0;
  let shortageValue = 0;
  let excessValue = 0;
  for (const it of items) {
    if (it.counted === null || !Number.isFinite(it.counted) || it.counted < 0) continue;
    countedItems++;
    const diff = q3(it.counted - it.system);
    if (Math.abs(diff) < 0.0005) {
      matched++;
      continue;
    }
    const value = q2(diff * (it.unitCost || 0));
    changed.push({ ...it, counted: it.counted, diff, value });
    if (diff < 0) {
      shortageQty += -diff;
      shortageValue += -value;
    } else {
      excessQty += diff;
      excessValue += value;
    }
  }
  return {
    countedItems,
    changed: changed.sort((a, b) => a.value - b.value),
    matched,
    shortageQty: q3(shortageQty),
    excessQty: q3(excessQty),
    shortageValue: q2(shortageValue),
    excessValue: q2(excessValue),
  };
}
