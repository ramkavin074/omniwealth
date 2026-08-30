'use server';

import { db } from '@/db';
import { draftLineItems, assets, transactions, portfolios } from '@/db/schema';
import { getSessionUserAction } from './auth';
import { getExchangeRate } from '@/lib/fx';
import { checkRateLimit } from '@/lib/rate-limit';
import { canWrite, READ_ONLY_ERROR } from '@/lib/permissions';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { GoogleGenAI, Type } from '@google/genai';

async function generateWithRetry(ai: GoogleGenAI, params: any, retries = 3, delay = 2000): Promise<any> {
  try {
    return await ai.models.generateContent(params);
  } catch (error: any) {
    const isOverloaded = error?.status === 503 || error?.code === 503 || error?.message?.includes('503') || error?.status === 429 || error?.code === 429;
    if (retries > 0 && isOverloaded) {
      console.warn(`Gemini API overloaded/rate-limited. Retrying in ${delay}ms...`);
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

  const limit = await checkRateLimit(`ai-statement:${session.user.id}`, 15, 60);
  if (!limit.allowed) {
    return {
      success: false,
      error: `Statement import limit reached. Try again in about ${limit.retryAfterMinutes} minute(s).`,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, error: 'GEMINI_API_KEY is not configured in .env' };

  const ai = new GoogleGenAI({ apiKey });
  const files = formData.getAll('files') as File[];
  const pastedText = formData.get('pastedText') as string;

  let totalCount = 0;
  const basePrompt = 'Extract all investment assets, stock holdings, crypto positions, cash balances, or real estate line items. Normalize account number to last 4 digits (e.g. "4321" or "DEFAULT"). Detect account category (INDIVIDUAL, IRA, ROTH_IRA, 401K, 529, TRUST; default to INDIVIDUAL). Detect native currency (e.g. USD, EUR, INR, GBP). Determine a brief strategic rationale or legacy purpose for the account (default to "General Long-Term Growth"). Ensure you extract the exact quantity or number of shares if applicable.';

  // 1. Handle Pasted Text if provided
  if (pastedText && pastedText.trim().length > 0) {
    try {
      const response = await generateWithRetry(ai, {
        model: 'gemini-3.6-flash',
        contents: [
          { text: `${basePrompt}\n\nHere is the pasted statement text:\n${pastedText}` }
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
          assetType: item.assetType || 'OTHER',
          accountCategory: item.accountCategory || 'INDIVIDUAL',
          accountNumber: item.accountNumber || 'DEFAULT',
          rationale: item.rationale || 'General Long-Term Growth',
          quantity: item.quantity ? item.quantity.toString() : '1',
          pricePerUnit: item.pricePerUnit ? item.pricePerUnit.toString() : item.totalNativeValue.toString(),
          totalNativeValue: item.totalNativeValue.toString(),
          nativeCurrency: item.nativeCurrency || session.household.baseCurrency || 'USD',
          status: 'PENDING',
        });
        totalCount++;
      }
    } catch (err: any) {
      console.error('Error parsing pasted text:', err);
      return { success: false, error: err.message || 'Failed to parse pasted text' };
    }
  }

  // 2. Handle Files if provided
  if (files && files.length > 0 && files[0].size > 0) {
    const processingPromises = files.map(async (file) => {
      if (file.size === 0) return 0;
      try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const mimeType = file.type || 'application/pdf';

        const response = await generateWithRetry(ai, {
          model: 'gemini-3.6-flash',
          contents: [
            { inlineData: { mimeType, data: buffer.toString('base64') } },
            { text: basePrompt },
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
        let fileCount = 0;

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
            nativeCurrency: item.nativeCurrency || session.household.baseCurrency || 'USD',
            status: 'PENDING',
          });
          fileCount++;
        }
        return fileCount;
      } catch (err: any) {
        console.error(`Error parsing file ${file.name}:`, err);
        throw err;
      }
    });

    try {
      const results = await Promise.all(processingPromises);
      totalCount += results.reduce((acc, curr) => acc + curr, 0);
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to parse uploaded files' };
    }
  }

  if (totalCount === 0 && !pastedText && (!files || files.length === 0 || files[0].size === 0)) {
    return { success: false, error: 'No files or text provided for analysis.' };
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
  if (!canWrite(session.user.role)) return { success: false, error: READ_ONLY_ERROR };

  const [draft] = await db.select().from(draftLineItems).where(and(eq(draftLineItems.id, draftId), eq(draftLineItems.householdId, session.household.id)));
  if (!draft) return { success: false, error: 'Draft not found' };

  const targetUserId = selectedUserId || draft.userId || session.user.id;
  const finalCategory = selectedCategory || draft.accountCategory || 'INDIVIDUAL';
  const finalAccountNumber = selectedAccountNumber || draft.accountNumber || 'DEFAULT';
  const finalRationale = selectedRationale || draft.rationale || 'General Long-Term Growth';
  const assetQuantity = draft.quantity ? draft.quantity.toString() : '1';

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
      quantity: assetQuantity,
      nativeValue: draft.totalNativeValue, 
      accountCategory: finalCategory, 
      rationale: finalRationale, 
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
      assetType: draft.assetType,
      accountCategory: finalCategory,
      accountNumber: finalAccountNumber,
      rationale: finalRationale,
      nativeCurrency: draft.nativeCurrency,
      nativeValue: draft.totalNativeValue,
      quantity: assetQuantity,
    }).returning();
    targetAssetId = newAsset.id;
  }

  await db.insert(transactions).values({
    assetId: targetAssetId,
    type: 'STATEMENT_IMPORT',
    quantity: assetQuantity,
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
  if (!canWrite(session.user.role)) return { success: false, error: READ_ONLY_ERROR };

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
  if (!canWrite(session.user.role)) return { success: false, error: READ_ONLY_ERROR };
  await db
    .delete(draftLineItems)
    .where(and(eq(draftLineItems.id, draftId), eq(draftLineItems.householdId, session.household.id)));
  revalidatePath('/');
  return { success: true };
}