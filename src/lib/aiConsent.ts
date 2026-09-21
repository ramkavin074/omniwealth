// Consent gate for the app's AI features (Ask Wealth AI, AI Statement
// Reader) — both send user data to a third-party AI provider (default:
// Google Gemini). Required by App Store guideline 5.1.2(i): disclose what
// is sent, to whom, and get permission first.
//
// Deliberately sessionStorage, not localStorage: this must re-ask on every
// fresh app launch, not just once ever per device. A one-time-forever grant
// risks exactly the failure mode that caused a repeat App Review rejection
// here — a reviewer (or anyone) granting it once permanently satisfies the
// check for every future review pass on the same device/install, so a
// second reviewer session never sees the prompt at all.

export const AI_CONSENT_KEY = 'omniwealth_ai_consent_v1';

export function hasAiConsent(): boolean {
  try {
    return sessionStorage.getItem(AI_CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function grantAiConsent(): void {
  try {
    sessionStorage.setItem(AI_CONSENT_KEY, '1');
  } catch {
    /* private mode — consent will simply be asked again next time */
  }
}
