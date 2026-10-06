// Key handling for the big decimal keypad. Pure.

export interface PadState {
  /** Digits as typed, e.g. "55" or "0.5". */
  str: string;
  /** True while the shown number is the value the pad opened with, untouched. The first
   *  digit (or ".") then REPLACES it instead of being appended to it (typing 55 over 50
   *  must give 55, not 5055). Backspace edits it as normal. */
  fresh: boolean;
}

export function padStart(initial: number): PadState {
  return { str: initial === 0 ? '' : String(Math.abs(initial)), fresh: initial !== 0 };
}

export function padPress(state: PadState, key: string): PadState {
  if (key === '⌫') return { str: state.str.slice(0, -1), fresh: false };
  const base = state.fresh ? '' : state.str;
  if (key === '.') {
    if (base.includes('.')) return { str: base, fresh: false };
    return { str: base === '' ? '0.' : base + '.', fresh: false };
  }
  // avoid leading zeros like "007"
  if (base === '0') return { str: key, fresh: false };
  return { str: base + key, fresh: false };
}
