'use server';

import { db } from '@/db';
import { users, assets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUserAction, getExchangeRate } from '@/actions/vault';
import { GoogleGenAI } from '@google/genai';
import { revalidatePath } from 'next/cache';
import { checkRateLimit } from '@/lib/rate-limit';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

export async function updateAiSettingsAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const groqApiKey = (formData.get('groqApiKey') as string || '').trim();
  const openrouterApiKey = (formData.get('openrouterApiKey') as string || '').trim();
  const geminiApiKey = (formData.get('geminiApiKey') as string || '').trim();
  const openaiApiKey = (formData.get('openaiApiKey') as string || '').trim();
  const anthropicApiKey = (formData.get('anthropicApiKey') as string || '').trim();

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (groqApiKey) updateData.groqApiKey = encryptSecret(groqApiKey);
  if (openrouterApiKey) updateData.openrouterApiKey = encryptSecret(openrouterApiKey);
  if (geminiApiKey) updateData.geminiApiKey = encryptSecret(geminiApiKey);
  if (openaiApiKey) updateData.openaiApiKey = encryptSecret(openaiApiKey);
  if (anthropicApiKey) updateData.anthropicApiKey = encryptSecret(anthropicApiKey);

  await db.update(users).set(updateData as any).where(eq(users.id, session.user.id));
  revalidatePath('/profile');
  return { success: true };
}

export async function askPortfolioAIAction(userPrompt: string, forcedProvider: string = 'auto') {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  // Protect the shared/fallback API keys from a runaway session.
  const limit = await checkRateLimit(`ai-chat:${session.user.id}`, 30, 60);
  if (!limit.allowed) {
    return {
      success: false,
      error: `AI assistant limit reached. Try again in about ${limit.retryAfterMinutes} minute(s).`,
    };
  }

  const [currentUser] = await db.select().from(users).where(eq(users.id, session.user.id));
  
  const groqKey = decryptSecret(currentUser?.groqApiKey) || process.env.GROQ_API_KEY;
  const openrouterKey = decryptSecret(currentUser?.openrouterApiKey) || process.env.OPENROUTER_API_KEY;
  const geminiKey = decryptSecret(currentUser?.geminiApiKey) || process.env.GEMINI_API_KEY;
  const openaiKey = decryptSecret(currentUser?.openaiApiKey) || process.env.OPENAI_API_KEY;
  const anthropicKey = decryptSecret(currentUser?.anthropicApiKey) || process.env.ANTHROPIC_API_KEY;

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

  // --- HELPER EXECUTION FUNCTIONS (Guaranteed string return) ---
  async function runGroq(key: string): Promise<string> {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
        })
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch {
      return '';
    }
  }

  async function runOpenRouter(key: string): Promise<string> {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${key}`, 
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://omniwealth.org' 
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
        })
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch {
      return '';
    }
  }

  async function runGemini(key: string): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ text: `${systemPrompt}\n\nUser Question: ${userPrompt}` }]
      });
      return response.text || '';
    } catch {
      return '';
    }
  }

  async function runOpenAI(key: string): Promise<string> {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
        })
      });
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch {
      return '';
    }
  }

  async function runClaude(key: string): Promise<string> {
    try {
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
      return data.content?.[0]?.text || '';
    } catch {
      return '';
    }
  }

  // --- FORCED PROVIDER OR AUTO CASCADE ---
  if (forcedProvider === 'groq' && groqKey) {
    answer = await runGroq(groqKey);
    if (answer) providerUsed = 'Groq (Llama 3.3)';
  } else if (forcedProvider === 'openrouter' && openrouterKey) {
    answer = await runOpenRouter(openrouterKey);
    if (answer) providerUsed = 'OpenRouter (Free Router)';
  } else if (forcedProvider === 'gemini' && geminiKey) {
    answer = await runGemini(geminiKey);
    if (answer) providerUsed = 'Google Gemini (3.6 Flash)';
  } else if (forcedProvider === 'openai' && openaiKey) {
    answer = await runOpenAI(openaiKey);
    if (answer) providerUsed = 'OpenAI (GPT-4o-mini)';
  } else if (forcedProvider === 'anthropic' && anthropicKey) {
    answer = await runClaude(anthropicKey);
    if (answer) providerUsed = 'Anthropic Claude';
  } else {
    // --- AUTO FREE-FIRST CASCADE ---
    if (groqKey && !answer) {
      answer = await runGroq(groqKey);
      if (answer) providerUsed = 'Groq (Llama 3.3)';
    }
    if (openrouterKey && !answer) {
      answer = await runOpenRouter(openrouterKey);
      if (answer) providerUsed = 'OpenRouter (Free Router)';
    }
    if (geminiKey && !answer) {
      answer = await runGemini(geminiKey);
      if (answer) providerUsed = 'Google Gemini (3.6 Flash)';
    }
    if (openaiKey && !answer) {
      answer = await runOpenAI(openaiKey);
      if (answer) providerUsed = 'OpenAI (GPT-4o-mini)';
    }
    if (anthropicKey && !answer) {
      answer = await runClaude(anthropicKey);
      if (answer) providerUsed = 'Anthropic Claude';
    }
  }

  if (!answer) {
    return { success: false, error: 'Selected AI provider failed or is unavailable.' };
  }

  return { success: true, answer, providerUsed };
}