'use server';

import { db } from '@/db';
import { users, assets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUserAction, getExchangeRate } from '@/actions/vault';
import { GoogleGenAI } from '@google/genai';
import { revalidatePath } from 'next/cache';

// 1. Save User's AI Keys (Free & Paid Providers)
export async function updateAiSettingsAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const groqApiKey = (formData.get('groqApiKey') as string || '').trim();
  const openrouterApiKey = (formData.get('openrouterApiKey') as string || '').trim();
  const geminiApiKey = (formData.get('geminiApiKey') as string || '').trim();
  const openaiApiKey = (formData.get('openaiApiKey') as string || '').trim();
  const anthropicApiKey = (formData.get('anthropicApiKey') as string || '').trim();

  await db.update(users)
    .set({ 
      groqApiKey: groqApiKey || null,
      openrouterApiKey: openrouterApiKey || null,
      geminiApiKey: geminiApiKey || null, 
      openaiApiKey: openaiApiKey || null,
      anthropicApiKey: anthropicApiKey || null,
      updatedAt: new Date() 
    } as any)
    .where(eq(users.id, session.user.id));

  revalidatePath('/profile');
  return { success: true };
}

// 2. Free-First Priority Cascade AI Portfolio Assistant Action
export async function askPortfolioAIAction(userPrompt: string) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const [currentUser] = await db.select().from(users).where(eq(users.id, session.user.id));
  
  // Retrieve all configured keys (with environment fallbacks if available)
  const groqKey = currentUser?.groqApiKey || process.env.GROQ_API_KEY;
  const openrouterKey = currentUser?.openrouterApiKey || process.env.OPENROUTER_API_KEY;
  const geminiKey = currentUser?.geminiApiKey || process.env.GEMINI_API_KEY;
  const openaiKey = currentUser?.openaiApiKey || process.env.OPENAI_API_KEY;
  const anthropicKey = currentUser?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;

  if (!groqKey && !openrouterKey && !geminiKey && !openaiKey && !anthropicKey) {
    return { success: false, error: 'Please configure at least one free or paid AI API key in your Profile settings.' };
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

  const systemPrompt = `You are a warm, reassuring, plain-English family wealth assistant helping family members understand their wealth and legacy setup. 
  Here is the household's current portfolio summary (Total Net Worth: ${Math.round(totalVal)} ${session.household.baseCurrency}):
  ${JSON.stringify(portfolioSummary, null, 2)}
  
  CRITICAL FORMATTING INSTRUCTIONS FOR THE CHAT WINDOW:
  - NEVER use LaTeX math tags, backslashes, or formulas (like $$ or text).
  - Use clean Markdown only: short paragraphs, bullet points (*), and bold text (**).
  - Keep numbers clean and readable (e.g., $77,805 USD).
  - Keep answers concise, direct, and structured for a small chat screen.`;

  let answer = '';
  let success = false;

  // --- PRIORITY 1: Groq (Free Tier - Ultra-Fast Llama 3.3) ---
  if (groqKey && !success) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) {
        answer = data.choices[0].message.content;
        success = true;
      }
    } catch (err: any) {
      console.warn('Groq failed, trying next free provider...', err?.message || err);
    }
  }

  // --- PRIORITY 2: OpenRouter (Free Router - Automatically picks zero-cost models) ---
  if (openrouterKey && !success) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openrouterKey}`,
          'HTTP-Referer': 'https://omniwealth.org',
          'X-Title': 'OmniWealth'
        },
        body: JSON.stringify({
          model: 'openrouter/free',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        })
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) {
        answer = data.choices[0].message.content;
        success = true;
      }
    } catch (err: any) {
      console.warn('OpenRouter failed, trying next free provider...', err?.message || err);
    }
  }

  // --- PRIORITY 3: Google Gemini (Free Tier - Gemini 3.7 Flash) ---
  if (geminiKey && !success) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: [{ text: `${systemPrompt}\n\nUser Question: ${userPrompt}` }]
      });
      if (response.text) {
        answer = response.text;
        success = true;
      }
    } catch (err: any) {
      console.warn('Gemini failed, trying paid backups...', err?.message || err);
    }
  }

  // --- PRIORITY 4: OpenAI (Paid Backup - gpt-4o-mini) ---
  if (openaiKey && !success) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
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
      if (data.choices?.[0]?.message?.content) {
        answer = data.choices[0].message.content;
        success = true;
      }
    } catch (err: any) {
      console.warn('OpenAI backup failed...', err?.message || err);
    }
  }

  // --- PRIORITY 5: Anthropic Claude (Paid Backup - Claude 3.5 Sonnet) ---
  if (anthropicKey && !success) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
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
      if (data.content?.[0]?.text) {
        answer = data.content[0].text;
        success = true;
      }
    } catch (err: any) {
      console.warn('Anthropic backup failed...', err?.message || err);
    }
  }

  if (!success) {
    return { success: false, error: 'All configured AI providers (Groq, OpenRouter, Gemini, OpenAI, Claude) are currently unavailable. Please check your keys or try again shortly.' };
  }

  return { success: true, answer };
}