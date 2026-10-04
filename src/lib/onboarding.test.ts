import { describe, expect, it } from 'vitest';
import { GOAL_PRESETS, REGIONS, goalTargetFor, niceAmount, regionByKey } from './onboarding';

describe('onboarding presets', () => {
  it('rounds to two significant figures', () => {
    expect(niceAmount(31234)).toBe(31000);
    expect(niceAmount(600000)).toBe(600000);
    expect(niceAmount(0)).toBe(0);
    expect(niceAmount(NaN)).toBe(0);
  });

  it('scales goal targets to the region', () => {
    expect(goalTargetFor(GOAL_PRESETS[0], regionByKey('US'))).toBe(30000);
    expect(goalTargetFor(GOAL_PRESETS[0], regionByKey('India'))).toBe(600000);
  });

  it('falls back to the first region for unknown keys', () => {
    expect(regionByKey('nope').key).toBe(REGIONS[0].key);
  });
});
