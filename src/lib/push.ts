// Server-side APNs sender (HTTP/2 + token auth). No third-party dependency:
// the provider JWT is signed with Node's crypto (ES256).
//
// Configure with env vars (all required to actually send; missing config =>
// sendPush is a no-op that logs once):
//   APNS_KEY_ID       - the 10-char Key ID of your APNs Auth Key (.p8)
//   APNS_TEAM_ID      - Apple team id (DX8SZ5W6LJ)
//   APNS_PRIVATE_KEY  - contents of the .p8 file (PEM, newlines or \n-escaped)
//   APNS_BUNDLE_ID    - com.omniwealth.app
//   APNS_PRODUCTION   - "true" to hit api.push.apple.com, else the sandbox
//
// Not wired to a trigger yet — call sendPushToUser() from a cron / alert path.

import http2 from 'node:http2';
import crypto from 'node:crypto';
import { db } from '@/db';
import { pushTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface PushMessage {
  title: string;
  body: string;
  /** extra key/values delivered in the payload for the app to route on */
  data?: Record<string, string>;
  /** iOS interruption level / sound; default a normal alert */
  sound?: string;
  badge?: number;
  threadId?: string;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

let cachedJwt: { token: string; iat: number } | null = null;

function providerToken(): string | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const pem = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!keyId || !teamId || !pem) return null;

  const now = Math.floor(Date.now() / 1000);
  // APNs accepts a token for up to 60 min; refresh every ~50.
  if (cachedJwt && now - cachedJwt.iat < 3000) return cachedJwt.token;

  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = b64url(JSON.stringify({ iss: teamId, iat: now }));
  const signingInput = `${header}.${claims}`;
  const signature = crypto.sign('sha256', Buffer.from(signingInput), {
    key: pem,
    dsaEncoding: 'ieee-p1363',
  });
  const token = `${signingInput}.${b64url(signature)}`;
  cachedJwt = { token, iat: now };
  return token;
}

function apnsHost(): string {
  return process.env.APNS_PRODUCTION === 'true'
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';
}

/** Low-level: deliver one notification to one device token. Returns ok/reason. */
async function sendToToken(
  deviceToken: string,
  msg: PushMessage,
): Promise<{ ok: boolean; status?: number; reason?: string }> {
  const jwt = providerToken();
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!jwt || !bundleId) {
    console.warn('[push] APNs not configured — skipping send');
    return { ok: false, reason: 'not-configured' };
  }

  const payload = JSON.stringify({
    aps: {
      alert: { title: msg.title, body: msg.body },
      sound: msg.sound ?? 'default',
      ...(msg.badge != null ? { badge: msg.badge } : {}),
      ...(msg.threadId ? { 'thread-id': msg.threadId } : {}),
    },
    ...(msg.data ?? {}),
  });

  return new Promise((resolve) => {
    const client = http2.connect(apnsHost());
    client.on('error', (err) => resolve({ ok: false, reason: String(err) }));

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      authorization: `bearer ${jwt}`,
      'content-type': 'application/json',
    });

    let status = 0;
    let bodyText = '';
    req.on('response', (headers) => {
      status = Number(headers[':status']) || 0;
    });
    req.setEncoding('utf8');
    req.on('data', (chunk) => (bodyText += chunk));
    req.on('end', () => {
      client.close();
      if (status === 200) return resolve({ ok: true, status });
      let reason = bodyText;
      try {
        reason = JSON.parse(bodyText).reason ?? bodyText;
      } catch {
        /* keep raw */
      }
      resolve({ ok: false, status, reason });
    });
    req.write(payload);
    req.end();
  });
}

/**
 * Send a notification to every device registered for a user. Prunes tokens
 * APNs rejects as gone/bad.
 */
export async function sendPushToUser(userId: string, msg: PushMessage): Promise<number> {
  let rows: { token: string; platform: string }[];
  try {
    rows = await db
      .select({ token: pushTokens.token, platform: pushTokens.platform })
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId));
  } catch {
    return 0;
  }

  let delivered = 0;
  for (const row of rows) {
    if (row.platform !== 'ios') continue; // FCM path not implemented yet
    const res = await sendToToken(row.token, msg);
    if (res.ok) {
      delivered++;
    } else if (res.status === 410 || res.reason === 'BadDeviceToken' || res.reason === 'Unregistered') {
      await db.delete(pushTokens).where(eq(pushTokens.token, row.token)).catch(() => {});
    }
  }
  return delivered;
}
