import crypto from 'crypto';

/**
 * Symmetric encryption for at-rest secrets (AI provider API keys).
 *
 * Format: v1:<ivHex>:<authTagHex>:<cipherHex>  (AES-256-GCM)
 *
 * Both helpers degrade gracefully:
 *  - no ENCRYPTION_KEY set  -> value is stored / returned as plaintext
 *    (with a one-time warning) so the app keeps working; set the key and
 *    re-save to encrypt.
 *  - a stored value that isn't in v1 format (legacy plaintext) is returned
 *    unchanged by decryptSecret.
 */

let warnedMissingKey = false;

function getKey(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key)) {
    if (!warnedMissingKey) {
      console.warn(
        '[crypto] ENCRYPTION_KEY is not a 64-char hex string — secrets will be stored in plaintext until it is set.',
      );
      warnedMissingKey = true;
    }
    return null;
  }
  return Buffer.from(key, 'hex');
}

export function encryptSecret(text: string): string {
  if (!text) return '';
  const key = getKey();
  if (!key) return text;

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('hex'), tag.toString('hex'), enc].join(':');
}

export function decryptSecret(text: string | null | undefined): string {
  if (!text) return '';
  if (!text.startsWith('v1:')) return text; // legacy plaintext

  const parts = text.split(':');
  if (parts.length !== 4) return text;
  const [, ivHex, tagHex, encHex] = parts;
  if (
    !/^[0-9a-fA-F]{32}$/.test(ivHex) ||
    !/^[0-9a-fA-F]{32}$/.test(tagHex) ||
    !/^[0-9a-fA-F]*$/.test(encHex)
  ) {
    return text;
  }

  const key = getKey();
  if (!key) return text;

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let dec = decipher.update(encHex, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch (err) {
    console.error('[crypto] decryptSecret failed; returning stored value as-is:', err);
    return text;
  }
}
