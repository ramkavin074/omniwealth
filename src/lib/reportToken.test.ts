import { describe, expect, it } from 'vitest';
import { hashReportToken } from './reportToken';

describe('hashReportToken', () => {
  it('is deterministic, hex, and never equals the token', () => {
    const t = 'Cqxglz-H82onpQbGrCtsBj_kn5KerrROR';
    expect(hashReportToken(t)).toBe(hashReportToken(t));
    expect(hashReportToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashReportToken(t)).not.toContain(t);
    expect(hashReportToken(t)).not.toBe(hashReportToken(t + 'x'));
  });
});
