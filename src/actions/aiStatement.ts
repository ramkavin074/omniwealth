'use server';

import { db } from '@/db';
import { draftLineItems, assets, transactions, portfolios } from '@/db/schema';
import { getSessionUserAction } from './auth';
import { getExchangeRate } from '@/lib/fx';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { GoogleGenAI, Type } from '@google/genai';

async function generateWithRetry(ai: GoogleGenAI, params: any, retries = 3, delay = 2000): Promise<any> {
  try {
    return await ai.models.generateContent(params);
  } catch (error: any) {
    const isOverloaded = error?.status === 503 || error?.code === 503 || error?.message?.includes('503');
    if (retries > 0 && isOverloaded) {
      console.warn(`Gemini API overloaded (503). Retrying in ${delay}ms...`);
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
  if (!files || files.length === 0) return { success: false, error: 'No files uploaded' };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: 'GEMINI_API_KEY is not configured in .env' };

  const ai = new GoogleGenAI({ apiKey });

  const processingPromises = files.map(async (file) => {
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const mimeType = file.type || 'application/pdf';

      const response = await generateWithRetry(ai, {
        model: 'gemini-3.7-flash',
        contents: [
          { inlineData: { mimeType, data: buffer.toString('base64') } },
          { text: 'Extract all investment assets, stock holdings, crypto positions, cash balances, or real estate line items. Normalize account number to last 4 digits (e.g. "4321" or "DEFAULT"). Detect account category (INDIVIDUAL, IRA, ROTH_IRA, 401K, 529, TRUST; default to INDIVIDUAL). Detect native currency (e.g. USD, EUR, INR, GBP). Determine a brief strategic rationale or legacy purpose for the account (default to "General Long-Term Growth").' },
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
      let count = 0;

      for (const item of parsedItems) {
        await db.insert(draftLineItems).values({
          householdId: session.household.id,
          userId: session.user.id,
          assetName: item.assetName,
          ticker: item.ticker || null,
          assetType: item.assetType || 'OTHER',
          accountCategory: item.accountCategory || 'INDIVIDUAL',
          accountNumber: item.accountNumber || 'DEFAULT',
          rationale: item.rationale || 'General Long-Term Growth',
          quantity: item.quantity ? item.quantity.toString() : '1',
          pricePerUnit: item.pricePerUnit ? item.pricePerUnit.toString() : item.totalNativeValue.toString(),
          totalNativeValue: item.totalNativeValue.toString(),
          nativeCurrency: item.nativeCurrency || 'USD',
          status: 'PENDING',
        });
        count++;
      }
      return count;
    } catch (err: any) {
      console.error(`Error parsing file ${file.name}:`, err);
      return 0;
    }
  });

  const results = await Promise.all(processingPromises);
  const totalCount = results.reduce((acc, curr) => acc + curr, 0);

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

  let [existingAsset] = draft.ticker
    ? await db.select().from(assets).where(and(eq(assets.userId, targetUserId), eq(assets.accountNumber, finalAccountNumber), eq(assets.ticker, draft.ticker)))
    : [];

  if (!existingAsset) {
    [existingAsset] = await db.select().from(assets).where(and(eq(assets.userId, targetUserId), eq(assets.accountNumber, finalAccountNumber), eq(assets.name, draft.assetName)));
  }

  const fxRate = await getExchangeRate(draft.nativeCurrency, session.household.baseCurrency);
  let targetAssetId: string;

  if (existingAsset) {
    await db.update(assets).set({ nativeValue: draft.totalNativeValue, accountCategory: finalCategory, rationale: finalRationale, updatedAt: new Date() }).where(eq(assets.id, existingAsset.id));
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
      assetType: draft.assetType,
      accountCategory: finalCategory,
      accountNumber: finalAccountNumber,
      rationale: finalRationale,
      nativeCurrency: draft.nativeCurrency,
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