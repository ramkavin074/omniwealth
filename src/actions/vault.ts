'use server';

import { db } from '@/db';
import { households, users, portfolios, assets, transactions, draftLineItems, documents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { GoogleGenAI, Type } from '@google/genai';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

const SESSION_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

// --- Auth & Session Actions ---

export async function getSessionUserAction() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('vault_user_id')?.value;
  if (!userId) return null;

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;

  const [household] = await db.select().from(households).where(eq(households.id, user.householdId));
  return { user, household };
}

export async function loginAction(formData: FormData) {
  const email = (formData.get('email') as string || '').trim();
  const password = (formData.get('password') as string || '').trim();

  if (!email || !password) {
    return { success: false, error: 'Please enter both email and password.' };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    return { success: false, error: 'No account found with this email.' };
  }

  let isValid = false;
  if (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')) {
    isValid = await bcrypt.compare(password, user.passwordHash);
  } else {
    isValid = user.passwordHash === password;
  }

  if (!isValid) {
    return { success: false, error: 'Incorrect password.' };
  }

  const cookieStore = await cookies();
  cookieStore.set('vault_user_id', user.id, SESSION_COOKIE_OPTIONS);

  revalidatePath('/');
  return { success: true, role: user.role };
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('vault_user_id');
  redirect('/login');
}

export async function registerOwnerAction(formData: FormData) {
  const fullName = (formData.get('fullName') as string || '').trim();
  const householdName = (formData.get('householdName') as string || '').trim();
  const email = (formData.get('email') as string || '').trim();
  const password = (formData.get('password') as string || '').trim();
  const baseCurrency = (formData.get('baseCurrency') as string || 'USD').trim();

  if (!fullName || !householdName || !email || !password) {
    return { success: false, error: 'All fields are required.' };
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, email));
  if (existingUser) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

  const [household] = await db.insert(households).values({
    name: householdName,
    baseCurrency,
    inviteCode,
  } as any).returning();

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db.insert(users).values({
    householdId: household.id,
    email,
    passwordHash,
    fullName,
    role: 'OWNER',
  }).returning();

  const cookieStore = await cookies();
  cookieStore.set('vault_user_id', user.id, SESSION_COOKIE_OPTIONS);

  revalidatePath('/');
  return { success: true, role: user.role };
}

export async function registerMemberWithCodeAction(formData: FormData) {
  const fullName = (formData.get('fullName') as string || '').trim();
  const inviteCode = (formData.get('inviteCode') as string || '').trim();
  const email = (formData.get('email') as string || '').trim();
  const password = (formData.get('password') as string || '').trim();

  if (!fullName || !inviteCode || !email || !password) {
    return { success: false, error: 'All fields are required.' };
  }

  const [household] = await db.select().from(households).where(eq((households as any).inviteCode, inviteCode));
  if (!household) {
    return { success: false, error: 'Invalid household invite code.' };
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, email));
  if (existingUser) {
    return { success: false, error: 'An account with this email already exists.' };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db.insert(users).values({
    householdId: household.id,
    email,
    passwordHash,
    fullName,
    role: 'MEMBER',
  }).returning();

  const cookieStore = await cookies();
  cookieStore.set('vault_user_id', user.id, SESSION_COOKIE_OPTIONS);

  revalidatePath('/');
  return { success: true, role: user.role };
}

export async function updatePasswordAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const currentPassword = (formData.get('currentPassword') as string || '').trim();
  const newPassword = (formData.get('newPassword') as string || '').trim();

  if (!currentPassword || !newPassword) {
    return { success: false, error: 'Please fill in both current and new passwords.' };
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!user) return { success: false, error: 'User not found.' };

  let isValid = false;
  if (user.passwordHash.startsWith('$2a$') || user.passwordHash.startsWith('$2b$')) {
    isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  } else {
    isValid = user.passwordHash === currentPassword;
  }

  if (!isValid) {
    return { success: false, error: 'Incorrect current password.' };
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash: newPasswordHash, updatedAt: new Date() }).where(eq(users.id, user.id));

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
      .set({ aiApiKey: apiKey, updatedAt: new Date() } as any)
      .where(eq(users.id, session.user.id));

    revalidatePath('/profile');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to save API key' };
  }
}

export async function updateUserAiPreferencesAction(formData: FormData) {
  try {
    const session = await getSessionUserAction();
    if (!session || !session.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const aiProvider = (formData.get('aiProvider') as string) || 'gemini';
    const aiApiKey = (formData.get('aiApiKey') as string) || '';
    const geminiApiKey = (formData.get('geminiApiKey') as string) || '';
    const openaiApiKey = (formData.get('openaiApiKey') as string) || '';
    const anthropicApiKey = (formData.get('anthropicApiKey') as string) || '';

    await db.update(users)
      .set({ 
        aiProvider,
        aiApiKey,
        geminiApiKey,
        openaiApiKey,
        anthropicApiKey,
        updatedAt: new Date() 
      } as any)
      .where(eq(users.id, session.user.id));

    revalidatePath('/profile');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to save AI preferences' };
  }
}

// --- Family Members & Email Invites ---

export async function sendInviteEmail(toEmail: string, householdName: string, inviteCode?: string) {
  try {
    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Global Family Vault <vault@resend.dev>',
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
          <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: bold; margin-top: 10px;">
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

export async function addFamilyMemberAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const fullName = (formData.get('fullName') as string || '').trim();
  const email = (formData.get('email') as string || '').trim();
  const role = (formData.get('role') as string || 'MEMBER').trim();

  if (!fullName || !email) {
    return { success: false, error: 'Name and email are required.' };
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, email));
  if (existingUser) {
    return { success: false, error: 'A user with this email already exists.' };
  }

  const tempPasswordHash = crypto.randomBytes(8).toString('hex');

  await db.insert(users).values({
    householdId: session.household.id,
    fullName,
    email,
    passwordHash: tempPasswordHash,
    role,
  });

  const emailResult = await sendInviteEmail(email, session.household.name, session.household.inviteCode || undefined);
  if (!emailResult.success) {
    return { success: false, error: `User added, but email failed: ${JSON.stringify(emailResult.error)}` };
  }

  revalidatePath('/profile');
  return { success: true };
}

export async function deleteFamilyMemberAction(memberId: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const [targetUser] = await db.select().from(users).where(eq(users.id, memberId));
  if (!targetUser) return { success: false, error: 'User not found' };

  if (targetUser.id === session.user.id) {
    return { success: false, error: 'You cannot remove your own account from the household.' };
  }

  if (targetUser.householdId !== session.household.id) {
    return { success: false, error: 'Unauthorized action.' };
  }

  await db.delete(users).where(eq(users.id, memberId));
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
        const newTotalValue = (qty * livePrice).toString();

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
  } catch (err) {
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

  const files = formData.getAll('files') as File[];
  const pastedText = (formData.get('pastedText') as string || '').trim();

  if ((!files || files.length === 0) && !pastedText) {
    return { success: false, error: 'No files uploaded or text provided' };
  }

  // Multi-provider key resolution logic based on user profile settings
  const provider = session.user.aiProvider || 'gemini';
  let apiKey = '';

  if (provider === 'openai') {
    apiKey = session.user.openaiApiKey || session.user.aiApiKey || process.env.OPENAI_API_KEY || '';
  } else if (provider === 'anthropic') {
    apiKey = session.user.anthropicApiKey || session.user.aiApiKey || process.env.ANTHROPIC_API_KEY || '';
  } else {
    // Default to gemini
    apiKey = session.user.geminiApiKey || session.user.aiApiKey || process.env.GEMINI_API_KEY || '';
  }

  if (!apiKey) {
    return { success: false, error: `API key for ${provider} is not configured. Add it in your profile settings or .env` };
  }

  const ai = new GoogleGenAI({ apiKey });
  let totalCount = 0;

  const extractionPrompt = 'Extract only investment assets, stock holdings, crypto positions, cash balances, or real estate line items from the provided text. Detect native currency (USD, EUR, INR, GBP, CNY, etc.).';

  if (pastedText) {
    try {
      const response = await generateWithRetry(ai, {
        model: 'gemini-2.5-flash',
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
          quantity: item.quantity ? item.quantity.toString() : '1',
          pricePerUnit: item.pricePerUnit ? item.pricePerUnit.toString() : item.totalNativeValue.toString(),
          totalNativeValue: item.totalNativeValue.toString(),
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
        model: 'gemini-2.5-flash',
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
          quantity: item.quantity ? item.quantity.toString() : '1',
          pricePerUnit: item.pricePerUnit ? item.pricePerUnit.toString() : item.totalNativeValue.toString(),
          totalNativeValue: item.totalNativeValue.toString(),
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
      nativeValue: draft.totalNativeValue, 
      quantity: draft.quantity || existingAsset.quantity,
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
      quantity: draft.quantity || '1',
      nativeValue: draft.totalNativeValue,
    }).returning();
    targetAssetId = newAsset.id;
  }

  await db.insert(transactions).values({
    assetId: targetAssetId,
    type: 'STATEMENT_IMPORT',
    quantity: draft.quantity || '1',
    nativePrice: draft.pricePerUnit || draft.totalNativeValue,
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

  const name = formData.get('name') as string;
  const ticker = formData.get('ticker') as string;
  const assetType = ((formData.get('assetType') as string) || 'OTHER').toUpperCase().trim();
  const accountCategory = formData.get('accountCategory') as string;
  const accountNumber = formData.get('accountNumber') as string;
  const rationale = formData.get('rationale') as string;
  const quantity = (formData.get('quantity') as string) || '1';
  const nativeValue = formData.get('nativeValue') as string;
  const nativeCurrency = formData.get('nativeCurrency') as string;
  const userId = (formData.get('userId') as string) || session.user.id;

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
  }).returning();

  const fxRate = await getExchangeRate(nativeCurrency || 'USD', session.household.baseCurrency);
  await db.insert(transactions).values({
    assetId: newAsset.id,
    type: 'MANUAL_ADD',
    quantity,
    nativePrice: (parseFloat(nativeValue) / parseFloat(quantity || '1')).toString(),
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

  const [existing] = await db.select().from(assets).where(eq(assets.id, id));
  if (!existing) return { success: false, error: 'Asset not found' };

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
    quantity: qtyVal || existing.quantity,
    nativeValue: valueVal ? valueVal : existing.nativeValue,
    updatedAt: new Date(),
  }).where(eq(assets.id, id));

  revalidatePath('/');
  return { success: true };
}

export async function deleteAssetAction(assetId: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };
   
  await db.delete(transactions).where(eq(transactions.assetId, assetId));
  await db.delete(assets).where(eq(assets.id, assetId));

  revalidatePath('/');
  return { success: true };
}

export async function updateHouseholdBaseCurrencyAction(newCurrency: string) {
  const session = await getSessionUserAction();
  if (!session || !session.household?.id) {
    throw new Error("Unauthorized");
  }

  await db
    .update(households)
    .set({ baseCurrency: newCurrency })
    .where(eq(households.id, session.household.id));

  revalidatePath('/');
}

export async function updateHouseholdLegacyPillarsAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const pillars = [];
  for (let i = 0; i < 4; i++) {
    const name = (formData.get(`pillar_name_${i}`) as string || '').trim();
    const description = (formData.get(`pillar_desc_${i}`) as string || '').trim();
    if (name) {
      pillars.push({ name, description });
    }
  }

  if (pillars.length === 0) return { success: false, error: 'At least one pillar is required.' };

  await db.update(households)
    .set({ legacyPillars: JSON.stringify(pillars), updatedAt: new Date() } as any)
    .where(eq(households.id, session.household.id));

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

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to save settings' };
  }
}

// --- Secure Document Vault & Encryption Helpers ---

function getVaultEncryptionKey(userId: string, email: string, householdId: string) {
  const serverSecret = process.env.SESSION_SECRET || 'omniwealth-secure-vault-fallback-secret';
  return crypto.scryptSync(`${userId}:${email}:${householdId}:${serverSecret}`, 'salt-omniwealth', 32);
}

function encryptFileBuffer(buffer: Buffer, userId: string, email: string, householdId: string): string {
  const iv = crypto.randomBytes(16);
  const key = getVaultEncryptionKey(userId, email, householdId);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
   
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decryptFileBuffer(encryptedBase64: string, userId: string, email: string, householdId: string): Buffer {
  const data = Buffer.from(encryptedBase64, 'base64');
  const iv = data.subarray(0, 16);
  const tag = data.subarray(16, 32);
  const encrypted = data.subarray(32);

  const key = getVaultEncryptionKey(userId, email, householdId);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
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

  const file = formData.get('file') as File;
  const name = (formData.get('name') as string) || file?.name || 'Untitled Document';
  const assetId = (formData.get('assetId') as string) || null;

  if (!file) return { success: false, error: 'No file provided' };

  try {
    const bytes = await file.arrayBuffer();
    const rawBuffer = Buffer.from(bytes);

    const encryptedBase64Payload = encryptFileBuffer(
      rawBuffer, 
      session.user.id, 
      session.user.email, 
      session.household.id
    );

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

    await db.insert(documents).values({
      householdId: session.household.id,
      userId: session.user.id,
      assetId: assetId || null,
      name,
      fileUrl: encryptedBase64Payload,
      fileType: file.type || 'application/pdf',
      fileSize: fileSizeMB,
    });

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

  try {
    const decryptedBuffer = decryptFileBuffer(
      doc.fileUrl,
      session.user.id,
      session.user.email,
      session.household.id
    );

    const dataUri = `data:${doc.fileType};base64,${decryptedBuffer.toString('base64')}`;
    return { success: true, dataUri, name: doc.name, fileType: doc.fileType };
  } catch (err) {
    return { success: false, error: 'Decryption failed. Security context mismatch.' };
  }
}

export async function deleteDocumentAction(documentId: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  try {
    await db.delete(documents).where(
      and(
        eq(documents.id, documentId),
        eq(documents.householdId, session.household.id)
      )
    );
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}