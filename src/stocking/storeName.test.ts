import { describe, expect, it } from 'vitest';
import { storeNameFromBlob } from './settings';

describe('storeNameFromBlob', () => {
  it('uses the store matching storeId', () => {
    expect(
      storeNameFromBlob({ storeId: 'b', stores: [{ id: 'a', name: 'First' }, { id: 'b', name: ' Sri Lakshmi Provision Store ' }] }),
    ).toBe('Sri Lakshmi Provision Store');
  });

  it('falls back to the first store, then to empty', () => {
    expect(storeNameFromBlob({ storeId: 'zzz', stores: [{ id: 'a', name: 'Only Shop' }] })).toBe('Only Shop');
    expect(storeNameFromBlob({})).toBe('');
    expect(storeNameFromBlob({ stores: [{ id: 'a' }] })).toBe('');
  });
});
