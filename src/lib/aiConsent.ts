// One-time, device-local consent gate for the app's AI features (Ask
// Wealth AI, AI Statement Reader) — both send user data to a third-party
// AI provider (default: Google Gemini). Required by App Store guideline
// 5.1.2(i): disclose what is sent, to whom, and get permission first.

export const AI_CONSENT_KEY = 'omniwealth_ai_consent_v1';

export function hasAiConsent(): boolean {
  try {
    return localStorage.getItem(AI_CONSENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function grantAiConsent(): void {
  try {
    localStorage.setItem(AI_CONSENT_KEY, '1');
  } catch {
    /* private mode — consent will simply be asked again next time */
  }
}
