'use server';

import { db } from '@/db';
import { users, assets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUserAction, getExchangeRate } from '@/actions/vault';
import { GoogleGenAI } from '@google/genai';
import { revalidatePath } from 'next/cache';

export async function updateAiSettingsAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const groqApiKey = (formData.get('groqApiKey') as string || '').trim();
  const openrouterApiKey = (formData.get('openrouterApiKey') as string || '').trim();
  const geminiApiKey = (formData.get('geminiApiKey') as string || '').trim();
  const openaiApiKey = (formData.get('openaiApiKey') as string || '').trim();
  const anthropicApiKey = (formData.get('anthropicApiKey') as string || '').trim();

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (groqApiKey) updateData.groqApiKey = groqApiKey;
  if (openrouterApiKey) updateData.openrouterApiKey = openrouterApiKey;
  if (geminiApiKey) updateData.geminiApiKey = geminiApiKey;
  if (openaiApiKey) updateData.openaiApiKey = openaiApiKey;
  if (anthropicApiKey) updateData.anthropicApiKey = anthropicApiKey;

  await db.update(users).set(updateData as any).where(eq(users.id, session.user.id));
  revalidatePath('/profile');
  return { success: true };
}

export async function askPortfolioAIAction(userPrompt: string, forcedProvider: string = 'auto') {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const [currentUser] = await db.select().from(users).where(eq(users.id, session.user.id));
  
  const groqKey = currentUser?.groqApiKey || process.env.GROQ_API_KEY;
  const openrouterKey = currentUser?.openrouterApiKey || process.env.OPENROUTER_API_KEY;
  const geminiKey = currentUser?.geminiApiKey || process.env.GEMINI_API_KEY;
  const openaiKey = currentUser?.openaiApiKey || process.env.OPENAI_API_KEY;
  const anthropicKey = currentUser?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;

  // Gather portfolio context
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
      valueInBaseCurrency: Math.round(converted),
      currency: session.household.baseCurrency
    };
  }));

  const systemPrompt = `You are a warm, reassuring family wealth assistant. 
  Household Net Worth: ${Math.round(totalVal)} ${session.household.baseCurrency}.
  Portfolio: ${JSON.stringify(portfolioSummary)}
  Keep answers clean, concise, use Markdown bullet points (*), and never use LaTeX math brackets.`;

  let answer = '';
  let providerUsed = '';

  // --- HELPER EXECUTION FUNCTIONS ---
  async function runGroq(key: string) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content;
  }

  async function runOpenRouter(key: string) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'HTTP-Referer': 'https://omniwealth.org' },
      body: JSON.stringify({
        model: 'openrouter/free',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content;
  }

  async function runGemini(key: string) {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [{ text: `${systemPrompt}\n\nUser Question: ${userPrompt}` }]
    });
    return response.text;
  }

  async function runOpenAI(key: string) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content;
  }

  async function runClaude(key: string) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    const data = await res.json();
    return data.content?.[0]?.text;
  }

  // --- FORCED PROVIDER OR AUTO CASCADE ---
  if (forcedProvider === 'groq' && groqKey) {
    answer = await runGroq(groqKey);
    providerUsed = 'Groq (Llama 3.3)';
  } else if (forcedProvider === 'openrouter' && openrouterKey) {
    answer = await runOpenRouter(openrouterKey);
    providerUsed = 'OpenRouter (Free Router)';
  } else if (forcedProvider === 'gemini' && geminiKey) {
    answer = await runGemini(geminiKey);
    providerUsed = 'Google Gemini (3.6 Flash)';
  } else if (forcedProvider === 'openai' && openaiKey) {
    answer = await runOpenAI(openaiKey);
    providerUsed = 'OpenAI (GPT-4o-mini)';
  } else if (forcedProvider === 'anthropic' && anthropicKey) {
    answer = await runClaude(anthropicKey);
    providerUsed = 'Anthropic Claude';
  } else {
    // --- AUTO FREE-FIRST CASCADE ---
    if (groqKey && !answer) {
      try { answer = await runGroq(groqKey); if (answer) providerUsed = 'Groq (Llama 3.3)'; } catch {}
    }
    if (openrouterKey && !answer) {
      try { answer = await runOpenRouter(openrouterKey); if (answer) providerUsed = 'OpenRouter (Free Router)'; } catch {}
    }
    if (geminiKey && !answer) {
      try { answer = await runGemini(geminiKey); if (answer) providerUsed = 'Google Gemini (3.6 Flash)'; } catch {}
    }
    if (openaiKey && !answer) {
      try { answer = await runOpenAI(openaiKey); if (answer) providerUsed = 'OpenAI (GPT-4o-mini)'; } catch {}
    }
    if (anthropicKey && !answer) {
      try { answer = await runClaude(anthropicKey); if (answer) providerUsed = 'Anthropic Claude'; } catch {}
    }
  }

  if (!answer) {
    return { success: false, error: 'Selected AI provider failed or is unavailable.' };
  }

  return { success: true, answer, providerUsed };
}