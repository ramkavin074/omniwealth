// Server-side push sender: APNs (iOS, HTTP/2 + token auth) and FCM HTTP v1
// (Android). No third-party dependency: the APNs JWT (ES256) and the Google
// service-account JWT (RS256) are signed with Node's crypto.
//
// Android / FCM — one env var, missing => Android sends are a no-op:
//   FCM_SERVICE_ACCOUNT_JSON - full contents of the Firebase service-account
//                              key (JSON). project_id is read from it.
//
// iOS / APNs — configure with env vars (all required to actually send; missing config =>
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
    // A stuck connection/request must not hang forever: sendPushToUser and the
    // weekly-digest cron both await this sequentially per user, so one bad
    // connection would otherwise stall email+push delivery for everyone after it.
    let settled = false;
    const settle = (result: { ok: boolean; status?: number; reason?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.close();
      resolve(result);
    };

    const client = http2.connect(apnsHost());
    client.on('error', (err) => settle({ ok: false, reason: String(err) }));

    const timer = setTimeout(() => settle({ ok: false, reason: 'timeout' }), 8000);

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      authorization: `bearer ${jwt}`,
      'content-type': 'application/json',
    });
    req.on('error', (err) => settle({ ok: false, reason: String(err) }));

    let status = 0;
    let bodyText = '';
    req.on('response', (headers) => {
      status = Number(headers[':status']) || 0;
    });
    req.setEncoding('utf8');
    req.on('data', (chunk) => (bodyText += chunk));
    req.on('end', () => {
      if (status === 200) return settle({ ok: true, status });
      let reason = bodyText;
      try {
        reason = JSON.parse(bodyText).reason ?? bodyText;
      } catch {
        /* keep raw */
      }
      settle({ ok: false, status, reason });
    });
    req.write(payload);
    req.end();
  });
}

// ---- Android: FCM HTTP v1 ------------------------------------------------

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    return { ...sa, private_key: sa.private_key.replace(/\\n/g, '\n') };
  } catch {
    return null;
  }
}

let cachedAccess: { token: string; exp: number } | null = null;

// OAuth2 access token for the FCM scope, via a signed service-account JWT.
async function fcmAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccess && cachedAccess.exp - 60 > now) return cachedAccess.token;

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const input = `${header}.${claims}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(input), sa.private_key);
  const assertion = `${input}.${b64url(signature)}`;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    cachedAccess = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
    return json.access_token;
  } catch {
    return null;
  }
}

async function sendToFcm(
  deviceToken: string,
  msg: PushMessage,
): Promise<{ ok: boolean; status?: number; reason?: string }> {
  const sa = serviceAccount();
  if (!sa) {
    console.warn('[push] FCM not configured — skipping Android send');
    return { ok: false, reason: 'not-configured' };
  }
  const access = await fcmAccessToken(sa);
  if (!access) return { ok: false, reason: 'auth-failed' };

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title: msg.title, body: msg.body },
            ...(msg.data ? { data: msg.data } : {}),
            android: {
              priority: 'HIGH',
              notification: { sound: 'default', ...(msg.threadId ? { tag: msg.threadId } : {}) },
            },
          },
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.ok) return { ok: true, status: res.status };
    let reason = '';
    try {
      const j = await res.json();
      reason = j?.error?.details?.[0]?.errorCode ?? j?.error?.status ?? '';
    } catch {
      /* keep empty */
    }
    return { ok: false, status: res.status, reason };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

/**
 * Send a notification to every device registered for a user. Prunes tokens
 * APNs / FCM reject as gone/bad.
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
    if (row.platform === 'ios') {
      const res = await sendToToken(row.token, msg);
      if (res.ok) {
        delivered++;
      } else if (res.status === 410 || res.reason === 'BadDeviceToken' || res.reason === 'Unregistered') {
        await db.delete(pushTokens).where(eq(pushTokens.token, row.token)).catch(() => {});
      }
    } else if (row.platform === 'android') {
      const res = await sendToFcm(row.token, msg);
      if (res.ok) {
        delivered++;
      } else if (res.status === 404 || res.reason === 'UNREGISTERED') {
        await db.delete(pushTokens).where(eq(pushTokens.token, row.token)).catch(() => {});
      }
    }
  }
  return delivered;
}
