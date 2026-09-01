'use server';

import { db } from '@/db';
import { households, users, portfolios, assets, transactions, draftLineItems, documents, auditLog, netWorthSnapshots } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { GoogleGenAI, Type } from '@google/genai';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Resend } from 'resend';
import { checkRateLimit } from '@/lib/rate-limit';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { toNumeric } from '@/lib/num';
import { logError } from '@/lib/log';
import { logAudit } from '@/lib/audit';
import { put, del } from '@vercel/blob';

// Shorthand for an audit entry scoped to the acting session.
function audit(
  session: any,
  action: string,
  targetType?: string,
  targetId?: string | null,
  meta?: Record<string, unknown>,
) {
  return logAudit({
    actorUserId: session?.user?.id,
    actorEmail: session?.user?.email,
    householdId: session?.household?.id,
    action,
    targetType,
    targetId: targetId ?? null,
    meta,
  });
}
import {
  canWrite,
  canManageHousehold,
  canDeleteMember,
  READ_ONLY_ERROR,
  FORBIDDEN_ERROR,
} from '@/lib/permissions';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

// --- Auth & Session Actions ---
//
// These were previously implemented here with a parallel `vault_user_id`
// cookie scheme that did NOT interoperate with the token/`sessions`-table
// implementation in ./auth. Because the login page calls ./auth's
// `loginAction` while the page guards imported `getSessionUserAction` from
// here, every login produced an immediate redirect back to /login.
//
// The canonical implementations now live in ./auth. They are imported and
// re-exported here so existing `@/actions/vault` import paths keep working
// and every caller shares one session mechanism.
import {
  getSessionUserAction,
  loginAction,
  logoutAction,
  registerOwnerAction,
  registerMemberWithCodeAction,
  addFamilyMemberAction,
  revokeOtherSessionsAction,
} from './auth';

export {
  getSessionUserAction,
  loginAction,
  logoutAction,
  registerOwnerAction,
  registerMemberWithCodeAction,
  // Token-based invitation flow (invitations table + /login?invite=<token>
  // + acceptInviteAction). The old local implementation created an
  // un-loginable user row up front; this one does not.
  addFamilyMemberAction,
  revokeOtherSessionsAction,
};

export async function updatePasswordAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const currentPassword = (formData.get('currentPassword') as string || '').trim();
  const newPassword = (formData.get('newPassword') as string || '').trim();

  if (!currentPassword || !newPassword) {
    return { success: false, error: 'Please fill in both current and new passwords.' };
  }

  if (newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters.' };
  }
  if (newPassword === currentPassword) {
    return { success: false, error: 'New password must be different from the current one.' };
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!user) return { success: false, error: 'User not found.' };

  const isBcryptHash =
    user.passwordHash.startsWith('$2a$') ||
    user.passwordHash.startsWith('$2b$') ||
    user.passwordHash.startsWith('$2y$');
  const isValid = isBcryptHash
    ? await bcrypt.compare(currentPassword, user.passwordHash)
    : false;

  if (!isValid) {
    return { success: false, error: 'Incorrect current password.' };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  await db.update(users).set({ passwordHash: newPasswordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
  await audit(session, 'account.password_change');

  // Changing the password signs out every other device.
  await revokeOtherSessionsAction();

  revalidatePath('/profile');
  return { success: true };
}

export async function updateUserApiKeyAction(apiKey: string) {
  try {
    const session = await getSessionUserAction();
    if (!session || !session.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    await db.update(users)
      .set({ aiApiKey: encryptSecret(apiKey), updatedAt: new Date() } as any)
      .where(eq(users.id, session.user.id));

    revalidatePath('/profile');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to save API key' };
  }
}

// --- Family Members & Email Invites ---

export async function sendInviteEmail(toEmail: string, householdName: string, inviteCode?: string) {
  try {
    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Global Family Vault <onboarding@resend.dev>',
      to: [toEmail],
      subject: `Welcome to ${householdName} Wealth Command Center`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #090d16; color: #f8fafc; padding: 32px; border-radius: 16px;">
          <h2 style="color: #818cf8; margin-top: 0;">Global Family Vault Invitation</h2>
          <p style="color: #cbd5e1; font-size: 14px;">
            You have been invited to collaborate on the <strong>${householdName}</strong> wealth command center.
          </p>
          ${inviteCode ? `
            <p style="color: #cbd5e1; font-size: 14px;">Your household invite code is:</p>
            <div style="background-color: #1e293b; border: 1px solid #334155; padding: 16px; border-radius: 12px; margin: 20px 0; text-align: center;">
              <span style="font-size: 22px; font-weight: bold; color: #38bdf8; letter-spacing: 2px;">${inviteCode}</span>
            </div>
          ` : ''}
          <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: bold; margin-top: 10px;">
            Access Wealth Vault →
          </a>
        </div>
      `,
    });

    if (response.error) {
      return { success: false, error: response.error };
    }
    return { success: true, data: response.data };
  } catch (err) {
    return { success: false, error: err };
  }
}

export async function fetchFamilyMembersAction() {
  const session = await getSessionUserAction();
  if (!session) return [];
  return await db.select().from(users).where(eq(users.householdId, session.household.id));
}

export async function fetchAuditLogAction(limit = 50) {
  const session = await getSessionUserAction();
  if (!session) return [];
  try {
    return await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.householdId, session.household.id))
      .orderBy(desc(auditLog.createdAt))
      .limit(Math.min(Math.max(limit, 1), 200));
  } catch {
    // audit_log table not created yet
    return [];
  }
}

// addFamilyMemberAction is re-exported from ./auth above (token-based
// invitation flow).

export async function deleteFamilyMemberAction(memberId: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const [targetUser] = await db.select().from(users).where(eq(users.id, memberId));
  if (!targetUser) return { success: false, error: 'User not found' };

  if (targetUser.id === session.user.id) {
    return { success: false, error: 'You cannot remove your own account from the household.' };
  }

  if (targetUser.householdId !== session.household.id) {
    return { success: false, error: 'User not found' };
  }

  if (!canDeleteMember(session.user.role, targetUser.role)) {
    return { success: false, error: FORBIDDEN_ERROR };
  }

  await db.delete(users).where(eq(users.id, memberId));
  await audit(session, 'member.remove', 'user', memberId, { email: targetUser.email, role: targetUser.role });
  revalidatePath('/profile');
  return { success: true };
}

// --- Exchange Rates & Market Prices ---

let cachedRates: { rates: Record<string, number>; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchLiveExchangeRatesAction(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cachedRates && now - cachedRates.fetchedAt < CACHE_TTL_MS) {
    return cachedRates.rates;
  }
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error('FX fetch failed');
    const data = await res.json();
    const rates: Record<string, number> = { USD: 1, ...data.rates };
    cachedRates = { rates, fetchedAt: now };
    return rates;
  } catch (err) {
    console.error('Live FX fetch failed, falling back to static rates:', err);
    return {
      USD: 1, EUR: 0.93, GBP: 0.78, CAD: 1.35, AUD: 1.54,
      INR: 83.3, JPY: 149.3, CHF: 0.89, CNY: 6.71,
    };
  }
}

export async function getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
  if (fromCurrency === toCurrency) return 1;
  const rates = await fetchLiveExchangeRatesAction();
  const rateFrom = rates[fromCurrency] || 1;
  const rateTo = rates[toCurrency] || 1;
  return rateTo / rateFrom;
}

export async function refreshLiveMarketPricesAction() {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canWrite(session.user.role)) return { success: false, error: READ_ONLY_ERROR };

  const householdAssets = await db
    .select()
    .from(assets)
    .where(eq(assets.householdId, session.household.id));

  let updatedCount = 0;
  const fiatTickers = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'CNY', 'USDT_FIAT'];

  for (const asset of householdAssets) {
    const assetType = (asset.assetType || '').toUpperCase().trim();
    const ticker = (asset.ticker || '').toUpperCase().trim();

    if (!ticker || assetType === 'CASH' || fiatTickers.includes(ticker)) {
      continue;
    }

    let livePrice: number | null = null;

    try {
      if (assetType === 'CRYPTO' || ['BTC', 'ETH', 'SOL', 'USDT', 'BNB', 'ADA', 'XRP'].includes(ticker)) {
        const coinMap: { [key: string]: string } = {
          BTC: 'bitcoin',
          ETH: 'ethereum',
          SOL: 'solana',
          ADA: 'cardano',
          XRP: 'ripple',
        };
        const coinId = coinMap[ticker] || ticker.toLowerCase();
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, { next: { revalidate: 60 } });
        const data = await res.json();
        livePrice = data[coinId]?.usd || null;
      } else {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 60 }
        });
        const data = await res.json();
        livePrice = data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
      }

      if (livePrice !== null && livePrice > 0) {
        const qty = parseFloat(asset.quantity && asset.quantity.trim() !== '' ? asset.quantity : '1') || 1;
        const newTotalValue = toNumeric(qty * livePrice, '0');

        await db.update(assets)
          .set({ nativeValue: newTotalValue, updatedAt: new Date() })
          .where(eq(assets.id, asset.id));

        updatedCount++;
      }
    } catch (err) {
      console.error(`Failed to fetch live price for ticker ${ticker}:`, err);
    }
  }

  revalidatePath('/');
  return { success: true, updatedCount };
}

// --- Net Worth & Assets ---

export async function fetchNetWorthTrendAction(range: string = '6m') {
  try {
    const session = await getSessionUserAction();
    if (!session) return [];

    const householdAssets = await db
      .select()
      .from(assets)
      .where(eq(assets.householdId, session.household.id));

    if (householdAssets.length === 0) return [];

    let currentTotal = 0;
    for (const a of householdAssets) {
      const fx = await getExchangeRate(a.nativeCurrency || 'USD', session.household.baseCurrency);
      const val = parseFloat(a.nativeValue || '0') * fx;
      const type = (a.assetType || '').toUpperCase();
      const cat = (a.accountCategory || '').toUpperCase();
      if (type === 'LIABILITY' || type === 'DEBT' || cat === 'LIABILITY' || cat === 'DEBT') {
        currentTotal -= Math.abs(val);
      } else {
        currentTotal += Math.abs(val);
      }
    }

    let totalPoints = 6;
    switch (range) {
      case '1m': totalPoints = 4; break;
      case '3m': totalPoints = 3; break;
      case '6m': totalPoints = 6; break;
      case '1y': totalPoints = 12; break;
      case '3y': totalPoints = 36; break;
      case '5y': totalPoints = 60; break;
      case '10y': totalPoints = 120; break;
      case '15y': totalPoints = 180; break;
      case '20y': totalPoints = 240; break;
      default: totalPoints = 6;
    }

    const now = new Date();
    const periods: { date: Date; key: string; label: string }[] = [];
    
    for (let i = totalPoints - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = totalPoints > 12 
        ? (i % 12 === 0 ? `${d.getFullYear()}` : '') 
        : d.toLocaleString('default', { month: 'short', year: '2-digit' });
      periods.push({ date: d, key, label });
    }

    const assetIds = householdAssets.map(a => a.id);
    const allTransactions = await db.select().from(transactions).orderBy(transactions.transactionDate);

    if (allTransactions.length === 0) {
      return periods.map((p, idx, arr) => {
        const factor = 0.95 + (0.05 * (idx / Math.max(arr.length - 1, 1)));
        return {
          month: p.label || p.key,
          value: Math.round(currentTotal * factor)
        };
      });
    }

    const results = [];
    for (const p of periods) {
      const periodEnd = p.date;
      const latestAssetValues: { [assetId: string]: number } = {};

      for (const tx of allTransactions) {
        if (!assetIds.includes(tx.assetId)) continue;
        const txDate = new Date(tx.transactionDate);
        if (txDate <= periodEnd) {
          const txVal = parseFloat(tx.nativePrice || '0') * parseFloat(tx.fxRateToBaseOnDate || '1');
          latestAssetValues[tx.assetId] = txVal;
        }
      }

      const assetKeys = Object.keys(latestAssetValues);
      let periodTotal = assetKeys.length > 0 
        ? Object.values(latestAssetValues).reduce((a, b) => a + b, 0) 
        : currentTotal * 0.95;

      if (periodTotal > currentTotal * 1.5 || periodTotal <= 0) {
        periodTotal = currentTotal * 0.98;
      }

      results.push({
        month: p.label || p.key,
        value: Math.round(periodTotal)
      });
    }

    if (results.length > 0) {
      results[results.length - 1].value = Math.round(currentTotal);
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Real recorded net-worth history for the current household, oldest first.
 * Populated by the daily /api/cron/net-worth-snapshot job. Returns [] when
 * no snapshots exist yet (caller falls back to the estimated trend).
 */
export async function fetchNetWorthSnapshotsAction(): Promise<
  { date: string; value: number }[]
> {
  try {
    const session = await getSessionUserAction();
    if (!session) return [];

    const rows = await db
      .select()
      .from(netWorthSnapshots)
      .where(eq(netWorthSnapshots.householdId, session.household.id))
      .orderBy(netWorthSnapshots.snapshotDate);

    return rows.map((r) => ({
      date: r.snapshotDate,
      value: Math.round(parseFloat(r.total || '0')),
    }));
  } catch (err) {
    logError('fetchNetWorthSnapshotsAction', err);
    return [];
  }
}

// --- AI Statement Parsing ---

async function generateWithRetry(ai: GoogleGenAI, params: any, retries = 5, delay = 5000): Promise<any> {
  try {
    return await ai.models.generateContent(params);
  } catch (error: any) {
    const status = error?.status || error?.code;
    const message = error?.message || '';
    
    const isRateLimitedOrOverloaded = 
      status === 429 || 
      status === 503 || 
      message.includes('429') || 
      message.includes('503') || 
      message.includes('RESOURCE_EXHAUSTED') || 
      message.includes('overloaded');

    if (retries > 0 && isRateLimitedOrOverloaded) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return generateWithRetry(ai, params, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function parseStatementAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canWrite(session.user.role)) return { success: false, error: READ_ONLY_ERROR };

  // Statement parsing is an expensive AI call — cap it per user.
  const limit = await checkRateLimit(`ai-statement:${session.user.id}`, 15, 60);
  if (!limit.allowed) {
    return {
      success: false,
      error: `Statement import limit reached. Try again in about ${limit.retryAfterMinutes} minute(s).`,
    };
  }

  const files = formData.getAll('files') as File[];
  const pastedText = (formData.get('pastedText') as string || '').trim();

  if ((!files || files.length === 0) && !pastedText) {
    return { success: false, error: 'No files uploaded or text provided' };
  }

  const [keyRow] = await db
    .select({ aiApiKey: users.aiApiKey })
    .from(users)
    .where(eq(users.id, session.user.id));
  const apiKey = decryptSecret(keyRow?.aiApiKey) || process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: 'Gemini API key is not configured. Add it in your profile settings or .env' };

  const ai = new GoogleGenAI({ apiKey });
  let totalCount = 0;

  const extractionPrompt = `Extract all investment assets, stock holdings, crypto positions, mutual funds, cash balances, and real estate line items from the provided text or document. 
CRITICAL INSTRUCTIONS:
1. Always extract the exact number of shares, units, or tokens as the 'quantity' (do not default to 1 if shares/units are listed).
2. Extract the price per unit and the total native value.
3. Detect the correct native currency (USD, EUR, INR, GBP, CNY, etc.).`;

  if (pastedText) {
    try {
      const response = await generateWithRetry(ai, {
        model: 'gemini-3.6-flash',
        contents: [
          { text: `${extractionPrompt}\n\nHere is the pasted statement text:\n${pastedText}` },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                assetName: { type: Type.STRING },
                ticker: { type: Type.STRING },
                assetType: { type: Type.STRING },
                accountCategory: { type: Type.STRING },
                accountNumber: { type: Type.STRING },
                rationale: { type: Type.STRING },
                quantity: { type: Type.STRING },
                pricePerUnit: { type: Type.STRING },
                totalNativeValue: { type: Type.STRING },
                nativeCurrency: { type: Type.STRING },
              },
              required: ['assetName', 'assetType', 'totalNativeValue', 'nativeCurrency'],
            },
          },
        },
      });

      const parsedItems = JSON.parse(response.text || '[]');
      for (const item of parsedItems) {
        await db.insert(draftLineItems).values({
          householdId: session.household.id,
          userId: session.user.id,
          assetName: item.assetName,
          ticker: item.ticker || null,
          assetType: (item.assetType || 'OTHER').toUpperCase().trim(),
          accountCategory: item.accountCategory || 'INDIVIDUAL',
          accountNumber: item.accountNumber || 'DEFAULT',
          rationale: item.rationale || 'General Long-Term Growth',
          quantity: toNumeric(item.quantity, '1'),
          pricePerUnit: toNumeric(item.pricePerUnit ?? item.totalNativeValue, '0'),
          totalNativeValue: toNumeric(item.totalNativeValue, '0'),
          nativeCurrency: item.nativeCurrency || 'USD',
          status: 'PENDING',
        });
        totalCount++;
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to parse pasted text' };
    }
  }

  for (const file of files) {
    if (!file || file.size === 0) continue;
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const mimeType = file.type || 'application/pdf';

      const response = await generateWithRetry(ai, {
        model: 'gemini-3.6-flash',
        contents: [
          { inlineData: { mimeType, data: buffer.toString('base64') } },
          { text: extractionPrompt },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                assetName: { type: Type.STRING },
                ticker: { type: Type.STRING },
                assetType: { type: Type.STRING },
                accountCategory: { type: Type.STRING },
                accountNumber: { type: Type.STRING },
                rationale: { type: Type.STRING },
                quantity: { type: Type.STRING },
                pricePerUnit: { type: Type.STRING },
                totalNativeValue: { type: Type.STRING },
                nativeCurrency: { type: Type.STRING },
              },
              required: ['assetName', 'assetType', 'totalNativeValue', 'nativeCurrency'],
            },
          },
        },
      });

      const parsedItems = JSON.parse(response.text || '[]');

      for (const item of parsedItems) {
        await db.insert(draftLineItems).values({
          householdId: session.household.id,
          userId: session.user.id,
          assetName: item.assetName,
          ticker: item.ticker || null,
          assetType: (item.assetType || 'OTHER').toUpperCase().trim(),
          accountCategory: item.accountCategory || 'INDIVIDUAL',
          accountNumber: item.accountNumber || 'DEFAULT',
          rationale: item.rationale || 'General Long-Term Growth',
          quantity: toNumeric(item.quantity, '1'),
          pricePerUnit: toNumeric(item.pricePerUnit ?? item.totalNativeValue, '0'),
          totalNativeValue: toNumeric(item.totalNativeValue, '0'),
          nativeCurrency: item.nativeCurrency || 'USD',
          status: 'PENDING',
        });
        totalCount++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err: any) {
      console.error(`Error parsing file ${file.name}:`, err);
    }
  }

  revalidatePath('/');
  return { success: true, count: totalCount };
}

export async function fetchDraftLineItemsAction() {
  const session = await getSessionUserAction();
  if (!session) return [];
  return await db.select().from(draftLineItems).where(and(eq(draftLineItems.householdId, session.household.id), eq(draftLineItems.status, 'PENDING')));
}

export async function approveDraftLineItemAction(draftId: string, selectedCategory?: string, selectedUserId?: string, selectedAccountNumber?: string, selectedRationale?: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const [draft] = await db.select().from(draftLineItems).where(and(eq(draftLineItems.id, draftId), eq(draftLineItems.householdId, session.household.id)));
  if (!draft) return { success: false, error: 'Draft not found' };

  const targetUserId = selectedUserId || draft.userId || session.user.id;
  const finalCategory = selectedCategory || draft.accountCategory || 'INDIVIDUAL';
  const finalAccountNumber = selectedAccountNumber || draft.accountNumber || 'DEFAULT';
  const finalRationale = selectedRationale || draft.rationale || 'General Long-Term Growth';
  const finalAssetType = (draft.assetType || 'OTHER').toUpperCase().trim();

  let [existingAsset] = draft.ticker
    ? await db.select().from(assets).where(and(eq(assets.userId, targetUserId), eq(assets.accountNumber, finalAccountNumber), eq(assets.ticker, draft.ticker)))
    : [];

  if (!existingAsset) {
    [existingAsset] = await db.select().from(assets).where(and(eq(assets.userId, targetUserId), eq(assets.accountNumber, finalAccountNumber), eq(assets.name, draft.assetName)));
  }

  const fxRate = await getExchangeRate(draft.nativeCurrency, session.household.baseCurrency);
  let targetAssetId: string;

  if (existingAsset) {
    await db.update(assets).set({
      nativeValue: toNumeric(draft.totalNativeValue, '0'),
      quantity: toNumeric(draft.quantity ?? existingAsset.quantity, '1'),
      accountCategory: finalCategory,
      rationale: finalRationale,
      assetType: finalAssetType,
      updatedAt: new Date()
    }).where(eq(assets.id, existingAsset.id));
    targetAssetId = existingAsset.id;
  } else {
    let [portfolio] = await db.select().from(portfolios).where(eq(portfolios.userId, targetUserId));
    if (!portfolio) {
      [portfolio] = await db.insert(portfolios).values({ householdId: session.household.id, userId: targetUserId, name: 'Portfolio', isHouseholdVisible: true }).returning();
    }
    const [newAsset] = await db.insert(assets).values({
      householdId: session.household.id,
      userId: targetUserId,
      portfolioId: portfolio.id,
      name: draft.assetName,
      ticker: draft.ticker,
      assetType: finalAssetType,
      accountCategory: finalCategory,
      accountNumber: finalAccountNumber,
      rationale: finalRationale,
      nativeCurrency: draft.nativeCurrency,
      quantity: toNumeric(draft.quantity, '1'),
      nativeValue: toNumeric(draft.totalNativeValue, '0'),
    }).returning();
    targetAssetId = newAsset.id;
  }

  await db.insert(transactions).values({
    assetId: targetAssetId,
    type: 'STATEMENT_IMPORT',
    quantity: toNumeric(draft.quantity, '1'),
    nativePrice: toNumeric(draft.pricePerUnit ?? draft.totalNativeValue, '0'),
    nativeCurrency: draft.nativeCurrency,
    fxRateToBaseOnDate: fxRate.toFixed(6),
    transactionDate: new Date(),
  });

  await db.delete(draftLineItems).where(eq(draftLineItems.id, draftId));
  revalidatePath('/');
  return { success: true };
}

export async function approveAllDraftLineItemsAction(bulkUserId?: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const drafts = await db.select().from(draftLineItems).where(and(eq(draftLineItems.householdId, session.household.id), eq(draftLineItems.status, 'PENDING')));
  for (const draft of drafts) {
    await approveDraftLineItemAction(draft.id, undefined, bulkUserId);
  }
  revalidatePath('/');
  return { success: true, count: drafts.length };
}

export async function rejectDraftLineItemAction(draftId: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  await db.delete(draftLineItems).where(eq(draftLineItems.id, draftId));
  revalidatePath('/');
  return { success: true };
}

export async function addAssetAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canWrite(session.user.role)) return { success: false, error: READ_ONLY_ERROR };

  const name = formData.get('name') as string;
  const ticker = formData.get('ticker') as string;
  const assetType = ((formData.get('assetType') as string) || 'OTHER').toUpperCase().trim();
  const accountCategory = formData.get('accountCategory') as string;
  const accountNumber = formData.get('accountNumber') as string;
  const rationale = formData.get('rationale') as string;
  const quantity = toNumeric(formData.get('quantity'), '1');
  const nativeValue = toNumeric(formData.get('nativeValue'), '0');
  const nativeCurrency = formData.get('nativeCurrency') as string;
  const beneficiary = ((formData.get('beneficiary') as string) || '').trim() || null;
  const accessNotes = ((formData.get('accessNotes') as string) || '').trim() || null;
  const requestedUserId = (formData.get('userId') as string) || session.user.id;

  // A member may only add assets to their own portfolio; ADMIN+ may add
  // for anyone in the household. Either way the target must be a member.
  if (requestedUserId !== session.user.id && !canManageHousehold(session.user.role)) {
    return { success: false, error: FORBIDDEN_ERROR };
  }
  const [targetUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, requestedUserId), eq(users.householdId, session.household.id)));
  if (!targetUser) {
    return { success: false, error: 'Selected user does not belong to this household.' };
  }
  const userId = requestedUserId;

  let [portfolio] = await db.select().from(portfolios).where(eq(portfolios.userId, userId));
  if (!portfolio) {
    [portfolio] = await db.insert(portfolios).values({ householdId: session.household.id, userId, name: 'Portfolio', isHouseholdVisible: true }).returning();
  }

  const [newAsset] = await db.insert(assets).values({
    householdId: session.household.id,
    userId,
    portfolioId: portfolio.id,
    name,
    ticker: ticker || null,
    assetType,
    accountCategory: accountCategory || 'INDIVIDUAL',
    accountNumber: accountNumber || 'DEFAULT',
    rationale: rationale || 'General Long-Term Growth',
    nativeCurrency: nativeCurrency || 'USD',
    quantity,
    nativeValue,
    beneficiary,
    accessNotes,
  }).returning();

  const fxRate = await getExchangeRate(nativeCurrency || 'USD', session.household.baseCurrency);
  const qtyNum = parseFloat(quantity) || 1;
  await db.insert(transactions).values({
    assetId: newAsset.id,
    type: 'MANUAL_ADD',
    quantity,
    nativePrice: toNumeric(parseFloat(nativeValue) / qtyNum, '0'),
    nativeCurrency: nativeCurrency || 'USD',
    fxRateToBaseOnDate: fxRate.toFixed(6),
    transactionDate: new Date(),
  });

  revalidatePath('/');
  return { success: true };
}

export async function updateAssetAction(id: string, formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  // Editing an existing asset is an owner/admin action.
  if (!canManageHousehold(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };

  const [existing] = await db.select().from(assets).where(eq(assets.id, id));
  if (!existing || existing.householdId !== session.household.id) {
    return { success: false, error: 'Asset not found' };
  }

  const nameVal = formData.get('name') as string;
  const valueVal = formData.get('nativeValue') as string;
  const rationaleVal = formData.get('rationale') as string;
  const qtyVal = formData.get('quantity') as string;
  const assetTypeVal = formData.get('assetType') ? (formData.get('assetType') as string).toUpperCase().trim() : existing.assetType;

  await db.update(assets).set({
    name: nameVal || existing.name,
    ticker: formData.get('ticker') !== null ? (formData.get('ticker') as string) || null : existing.ticker,
    assetType: assetTypeVal,
    accountCategory: (formData.get('accountCategory') as string) || existing.accountCategory,
    accountNumber: (formData.get('accountNumber') as string) || existing.accountNumber,
    rationale: rationaleVal || existing.rationale,
    nativeCurrency: (formData.get('nativeCurrency') as string) || existing.nativeCurrency,
    quantity: toNumeric(qtyVal || existing.quantity, existing.quantity ?? '1'),
    nativeValue: toNumeric(valueVal || existing.nativeValue, existing.nativeValue),
    beneficiary:
      formData.get('beneficiary') !== null
        ? ((formData.get('beneficiary') as string) || '').trim() || null
        : existing.beneficiary,
    accessNotes:
      formData.get('accessNotes') !== null
        ? ((formData.get('accessNotes') as string) || '').trim() || null
        : existing.accessNotes,
    updatedAt: new Date(),
  }).where(eq(assets.id, id));

  revalidatePath('/');
  return { success: true };
}

export async function deleteAssetAction(assetId: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  // Deleting an asset is an owner/admin action.
  if (!canManageHousehold(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };

  const [existing] = await db.select().from(assets).where(eq(assets.id, assetId));
  if (!existing || existing.householdId !== session.household.id) {
    return { success: false, error: 'Asset not found' };
  }

  await db.delete(transactions).where(eq(transactions.assetId, assetId));
  await db.delete(assets).where(eq(assets.id, assetId));
  await audit(session, 'asset.delete', 'asset', assetId, { name: existing.name });

  revalidatePath('/');
  return { success: true };
}

// Read-only export of the household's assets as CSV text. Any signed-in
// member may export their own household's data.
export async function exportAssetsCsvAction(): Promise<
  { success: true; csv: string } | { success: false; error: string }
> {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    const rows = await db
      .select()
      .from(assets)
      .where(eq(assets.householdId, session.household.id))
      .orderBy(assets.name);

    const members = await db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(eq(users.householdId, session.household.id));
    const nameById = new Map(members.map((m) => [m.id, m.fullName]));

    const headers = [
      'Name', 'Type', 'Account Category', 'Account Number', 'Currency',
      'Native Value', 'Quantity', 'Owner', 'Legacy Pillar', 'Beneficiary',
      'Access Notes', 'Updated At',
    ];

    const esc = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lines = [headers.join(',')];
    for (const a of rows) {
      lines.push([
        a.name,
        a.assetType,
        a.accountCategory,
        a.accountNumber,
        a.nativeCurrency,
        a.nativeValue,
        a.quantity ?? '',
        nameById.get(a.userId) ?? '',
        a.rationale,
        a.beneficiary ?? '',
        a.accessNotes ?? '',
        a.updatedAt ? new Date(a.updatedAt).toISOString() : '',
      ].map(esc).join(','));
    }

    return { success: true, csv: lines.join('\r\n') };
  } catch (err) {
    logError('exportAssetsCsvAction', err);
    return { success: false, error: 'Could not build the export.' };
  }
}

export async function updateHouseholdBaseCurrencyAction(newCurrency: string) {
  const session = await getSessionUserAction();
  if (!session || !session.household?.id) {
    throw new Error("Unauthorized");
  }
  if (!canManageHousehold(session.user.role)) {
    throw new Error(FORBIDDEN_ERROR);
  }

  await db
    .update(households)
    .set({ baseCurrency: newCurrency })
    .where(eq(households.id, session.household.id));
  await audit(session, 'household.currency_change', 'household', session.household.id, { to: newCurrency });

  revalidatePath('/');
}

export async function updateHouseholdLegacyPillarsAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canManageHousehold(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };

  const pillars = [];
  for (let i = 0; i < 4; i++) {
    const name = (formData.get(`pillar_name_${i}`) as string || '').trim();
    const description = (formData.get(`pillar_desc_${i}`) as string || '').trim();
    if (name) {
      const rawTarget = parseFloat((formData.get(`pillar_target_${i}`) as string || '').trim());
      const target = Number.isFinite(rawTarget) && rawTarget > 0 ? rawTarget : null;
      const rawDate = (formData.get(`pillar_target_date_${i}`) as string || '').trim();
      const targetDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;
      pillars.push({ name, description, target, targetDate });
    }
  }

  if (pillars.length === 0) return { success: false, error: 'At least one pillar is required.' };

  await db.update(households)
    .set({ legacyPillars: JSON.stringify(pillars), updatedAt: new Date() } as any)
    .where(eq(households.id, session.household.id));
  await audit(session, 'household.pillars_update', 'household', session.household.id);

  revalidatePath('/');
  revalidatePath('/profile');
  return { success: true };
}

export async function updateRetirementPreferencesAction(data: {
  currentAge: number;
  retirementAge: number;
  desiredIncome: number;
  country: string;
}) {
  const session = await getSessionUserAction();
  if (!session || !session.household?.id) {
    return { success: false, error: 'Unauthorized' };
  }
  if (!canManageHousehold(session.user.role)) {
    return { success: false, error: FORBIDDEN_ERROR };
  }

  try {
    await db
      .update(households)
      .set({
        currentAge: data.currentAge,
        retirementAge: data.retirementAge,
        desiredIncome: data.desiredIncome.toString(),
        retirementCountry: data.country,
        updatedAt: new Date(),
      })
      .where(eq(households.id, session.household.id));
    await audit(session, 'household.retirement_update', 'household', session.household.id);

    revalidatePath('/');
    return { success: true };
  } catch {
    return { success: false, error: 'Failed to save settings' };
  }
}

// --- Secure Document Vault & Encryption Helpers ---

type VaultCtx = { userId: string; email: string; householdId: string };

const VAULT_V2_PREFIX = 'v2:';

function vaultServerSecret(): string {
  const s = process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY;
  if (!s) {
    throw new Error('SESSION_SECRET or ENCRYPTION_KEY must be set to encrypt documents.');
  }
  return s;
}

// v2: household-scoped (any member can open), per-document random salt, no
// hardcoded fallback secret.
function deriveVaultKeyV2(householdId: string, salt: Buffer): Buffer {
  return crypto.scryptSync(`vault:${householdId}:${vaultServerSecret()}`, salt, 32);
}

// v1 legacy: per-uploader, static salt, weak hardcoded fallback. Read-only
// path for documents encrypted before v2.
function deriveVaultKeyV1(ctx: VaultCtx): Buffer {
  const serverSecret = process.env.SESSION_SECRET || 'omniwealth-secure-vault-fallback-secret';
  return crypto.scryptSync(
    `${ctx.userId}:${ctx.email}:${ctx.householdId}:${serverSecret}`,
    'salt-omniwealth',
    32,
  );
}

function encryptFileBuffer(buffer: Buffer, householdId: string): string {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);
  const key = deriveVaultKeyV2(householdId, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return VAULT_V2_PREFIX + Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

function decryptFileBuffer(payload: string, ctx: VaultCtx): Buffer {
  if (payload.startsWith(VAULT_V2_PREFIX)) {
    const data = Buffer.from(payload.slice(VAULT_V2_PREFIX.length), 'base64');
    const salt = data.subarray(0, 16);
    const iv = data.subarray(16, 32);
    const tag = data.subarray(32, 48);
    const encrypted = data.subarray(48);
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveVaultKeyV2(ctx.householdId, salt), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  // Legacy v1 payload.
  const data = Buffer.from(payload, 'base64');
  const iv = data.subarray(0, 16);
  const tag = data.subarray(16, 32);
  const encrypted = data.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveVaultKeyV1(ctx), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// The encrypted payload lives either in Vercel Blob (fileUrl is an https
// URL) or, for pre-blob documents / when no BLOB token is configured,
// inline in fileUrl itself.
async function loadDocPayload(fileUrl: string): Promise<string> {
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    const res = await fetch(fileUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error(`blob fetch failed: ${res.status}`);
    return res.text();
  }
  return fileUrl;
}

export async function fetchHouseholdDocumentsAction() {
  const session = await getSessionUserAction();
  if (!session) return [];
  return await db
    .select()
    .from(documents)
    .where(eq(documents.householdId, session.household.id))
    .orderBy(documents.createdAt);
}

export async function uploadDocumentAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canWrite(session.user.role)) return { success: false, error: READ_ONLY_ERROR };

  const file = formData.get('file') as File;
  const name = (formData.get('name') as string) || file?.name || 'Untitled Document';
  const assetId = (formData.get('assetId') as string) || null;

  if (!file) return { success: false, error: 'No file provided' };
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'File too large. Maximum size is 5 MB.' };
  }

  try {
    const bytes = await file.arrayBuffer();
    const rawBuffer = Buffer.from(bytes);

    const payload = encryptFileBuffer(rawBuffer, session.household.id);

    // Prefer Vercel Blob; fall back to storing the payload inline when no
    // blob token is configured (keeps local/dev working).
    let fileUrl = payload;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(
        `documents/${session.household.id}/${crypto.randomUUID()}`,
        payload,
        { access: 'public', contentType: 'text/plain', addRandomSuffix: false },
      );
      fileUrl = blob.url;
    }

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

    await db.insert(documents).values({
      householdId: session.household.id,
      userId: session.user.id,
      assetId: assetId || null,
      name,
      fileUrl,
      fileType: file.type || 'application/pdf',
      fileSize: fileSizeMB,
    });
    await audit(session, 'document.upload', 'document', null, { name, size: fileSizeMB });

    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Encryption/Upload failed' };
  }
}

export async function fetchDocumentDownloadUrlAction(documentId: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const [doc] = await db.select().from(documents).where(and(eq(documents.id, documentId), eq(documents.householdId, session.household.id)));
  if (!doc) return { success: false, error: 'Document not found' };

  // Legacy (v1) documents are keyed to the original uploader's identity;
  // reconstruct it so any household member can open them. v2 documents
  // ignore userId/email and key off the household.
  const [uploader] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, doc.userId));

  try {
    const payload = await loadDocPayload(doc.fileUrl);
    const decryptedBuffer = decryptFileBuffer(payload, {
      userId: doc.userId,
      email: uploader?.email ?? session.user.email,
      householdId: session.household.id,
    });

    const dataUri = `data:${doc.fileType};base64,${decryptedBuffer.toString('base64')}`;
    return { success: true, dataUri, name: doc.name, fileType: doc.fileType };
  } catch (err) {
    logError('fetchDocumentDownloadUrlAction', err, { documentId });
    return { success: false, error: 'Could not open this document.' };
  }
}

export async function deleteDocumentAction(documentId: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
  if (!canManageHousehold(session.user.role)) return { success: false, error: FORBIDDEN_ERROR };

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.householdId, session.household.id)));
  if (!doc) return { success: false, error: 'Document not found' };

  try {
    if (doc.fileUrl.startsWith('https://') && process.env.BLOB_READ_WRITE_TOKEN) {
      await del(doc.fileUrl).catch((e) => logError('deleteDocument.blob', e));
    }
    await db.delete(documents).where(eq(documents.id, documentId));
    await audit(session, 'document.delete', 'document', documentId, { name: doc.name });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateThemePreferenceAction(theme: 'light' | 'dark') {
  const session = await getSessionUserAction();
  if (!session || !session.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  // Never trust the client value: the DB value is interpolated into an
  // inline <script> in the root layout, so clamp to a strict allow-list.
  const safeTheme = theme === 'dark' ? 'dark' : 'light';

  try {
    await db
      .update(users)
      .set({ themePreference: safeTheme, updatedAt: new Date() } as any)
      .where(eq(users.id, session.user.id));

    revalidatePath('/profile');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update theme preference' };
  }
}

export async function updateEmailDigestAction(enabled: boolean) {
  const session = await getSessionUserAction();
  if (!session || !session.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }
  try {
    await db
      .update(users)
      .set({ emailDigest: !!enabled, updatedAt: new Date() } as any)
      .where(eq(users.id, session.user.id));
    revalidatePath('/profile');
    return { success: true };
  } catch (err) {
    logError('updateEmailDigestAction', err);
    return { success: false, error: 'Failed to update notification preference.' };
  }
}