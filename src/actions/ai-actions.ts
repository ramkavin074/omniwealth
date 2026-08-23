'use server';

import { db } from '@/db';
import { users, assets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUserAction, getExchangeRate } from '@/actions/vault';
import { GoogleGenAI } from '@google/genai';
import { revalidatePath } from 'next/cache';

// 1. Save User's AI Key & Provider Preference
export async function updateAiSettingsAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const aiProvider = (formData.get('aiProvider') as string) || 'gemini';
  const aiApiKey = (formData.get('aiApiKey') as string || '').trim();

  await db.update(users)
    .set({ 
      aiProvider, 
      aiApiKey: aiApiKey || null, 
      updatedAt: new Date() 
    } as any)
    .where(eq(users.id, session.user.id));

  revalidatePath('/profile');
  return { success: true };
}

// Helper: Automatic retry wrapper for overloaded Gemini models (503 / 429)
async function generateWithRetry(ai: GoogleGenAI, params: any, retries = 4, delay = 4000): Promise<any> {
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
      console.warn(`Gemini API overloaded (${status || '503'}). Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return generateWithRetry(ai, params, retries - 1, delay * 2);
    }
    throw error;
  }
}

// 2. Multi-Provider AI Portfolio Assistant Action
export async function askPortfolioAIAction(userPrompt: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  // Fetch user's custom API key settings
  const [currentUser] = await db.select().from(users).where(eq(users.id, session.user.id));
  const provider = currentUser?.aiProvider || 'gemini';
  const apiKey = currentUser?.aiApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { success: false, error: 'No API key found. Please configure your personal AI key in your Profile settings.' };
  }

  // Gather live household portfolio context
  const householdAssets = await db.select().from(assets).where(eq(assets.householdId, session.household.id));
  
  let totalVal = 0;
  const portfolioSummary = await Promise.all(householdAssets.map(async (a) => {
    const fx = await getExchangeRate(a.nativeCurrency || 'USD', session.household.baseCurrency);
    const converted = parseFloat(a.nativeValue || '0') * fx;
    totalVal += converted;
    return {
      name: a.name,
      category: a.accountCategory,
      type: a.assetType,
      accountLast4: a.accountNumber,
      rationale: a.rationale,
      valueInBaseCurrency: Math.round(converted),
      currency: session.household.baseCurrency
    };
  }));

  const systemPrompt = `You are a warm, reassuring, plain-English family wealth assistant helping family members who are not finance-savvy understand their wealth and legacy setup. 
  Here is the household's current portfolio summary (Total Net Worth: ${Math.round(totalVal)} ${session.household.baseCurrency}):
  ${JSON.stringify(portfolioSummary, null, 2)}
  
  Answer the user's question accurately based strictly on this data. Keep explanations crystal clear, friendly, and structured.`;

  try {
    let answer = '';

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });
      const data = await res.json();
      answer = data.choices?.[0]?.message?.content || 'Failed to generate response from OpenAI.';

    } else if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      const data = await res.json();
      answer = data.content?.[0]?.text || 'Failed to generate response from Anthropic.';

    } else {
      // Google Gemini with built-in retry guard for 503 / overload spikes
      const ai = new GoogleGenAI({ apiKey });
      const response = await generateWithRetry(ai, {
        model: 'gemini-3.7-flash',
        contents: [{ text: `${systemPrompt}\n\nUser Question: ${userPrompt}` }]
      });
      answer = response.text || 'Failed to generate response from Gemini.';
    }

    return { success: true, answer };
  } catch (err: any) {
    console.error('AI Q&A Error:', err);
    return { success: false, error: err.message || 'AI request failed due to high demand. Please try again in a moment.' };
  }
}