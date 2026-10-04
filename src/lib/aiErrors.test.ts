import { describe, expect, it } from 'vitest';
import { OWN_KEY_BUSY_MESSAGE, SHARED_BUSY_MESSAGE, friendlyAiError, isBusyError, isKeyRejectedError } from './aiErrors';

describe('AI error classification', () => {
  it('recognises busy / quota errors', () => {
    expect(isBusyError({ status: 429 })).toBe(true);
    expect(isBusyError({ message: '{"error":{"status":"RESOURCE_EXHAUSTED"}}' })).toBe(true);
    expect(isBusyError({ message: 'model is overloaded' })).toBe(true);
    expect(isBusyError({ message: 'socket hang up' })).toBe(false);
  });
  it('recognises rejected keys', () => {
    expect(isKeyRejectedError({ message: 'API key not valid. Please pass a valid API key.' })).toBe(true);
    expect(isKeyRejectedError({ status: 403 })).toBe(true);
    expect(isKeyRejectedError({ message: 'timeout' })).toBe(false);
  });
  it('words the message by whose key was used, and falls back otherwise', () => {
    expect(friendlyAiError({ status: 429 }, false, 'x')).toBe(SHARED_BUSY_MESSAGE);
    expect(friendlyAiError({ status: 429 }, true, 'x')).toBe(OWN_KEY_BUSY_MESSAGE);
    expect(friendlyAiError(new Error('weird'), false, 'FALLBACK')).toBe('FALLBACK');
  });
});
