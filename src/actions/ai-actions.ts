'use server';

import { db } from '@/db';
import { users, assets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUserAction, getExchangeRate } from '@/actions/vault';
import { GoogleGenAI } from '@google/genai';
import { revalidatePath } from 'next/cache';
import { checkRateLimit } from '@/lib/rate-limit';
import { encryptSecret, decryptSecret } from '@/lib/crypto';

/**
 * Provider model IDs. Free/hosted model slugs change often (Groq retires
 * models, OpenRouter moves ":free" variants to paid), so each is
 * overridable via env without a code change.
 */
const AI_MODELS = {
  groq: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  openrouter: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
  gemini: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  openai: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  anthropic: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
};

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
  
  const groqOwn = decryptSecret(currentUser?.groqApiKey);
  const openrouterOwn = decryptSecret(currentUser?.openrouterApiKey);
  const geminiOwn = decryptSecret(currentUser?.geminiApiKey);
  const openaiOwn = decryptSecret(currentUser?.openaiApiKey);
  const anthropicOwn = decryptSecret(currentUser?.anthropicApiKey);

  const groqKey = groqOwn || process.env.GROQ_API_KEY;
  const openrouterKey = openrouterOwn || process.env.OPENROUTER_API_KEY;
  const geminiKey = geminiOwn || process.env.GEMINI_API_KEY;
  const openaiKey = openaiOwn || process.env.OPENAI_API_KEY;
  const anthropicKey = anthropicOwn || process.env.ANTHROPIC_API_KEY;

  // "your key" = saved in this user's profile, "shared key" = server .env fallback
  const src = (own: string) => (own ? 'your key' : 'shared key');

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
  const providerErrors: string[] = [];

  async function runOpenAICompatible(
    label: string,
    url: string,
    model: string,
    headers: Record<string, string>,
  ): Promise<string> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = JSON.stringify(data).slice(0, 400);
        console.error(`[ai] ${label} ${res.status}: ${detail}`);
        providerErrors.push(`${label} ${res.status}`);
        return '';
      }
      const content = data.choices?.[0]?.message?.content || '';
      if (!content) {
        console.error(`[ai] ${label} returned no content:`, JSON.stringify(data).slice(0, 400));
        providerErrors.push(`${label} empty`);
      }
      return content;
    } catch (err) {
      console.error(`[ai] ${label} request threw:`, err);
      providerErrors.push(`${label} threw`);
      return '';
    }
  }

  async function runGroq(key: string): Promise<string> {
    return runOpenAICompatible(
      'Groq',
      'https://api.groq.com/openai/v1/chat/completions',
      AI_MODELS.groq,
      { Authorization: `Bearer ${key}` },
    );
  }

  async function runOpenRouter(key: string): Promise<string> {
    return runOpenAICompatible(
      'OpenRouter',
      'https://openrouter.ai/api/v1/chat/completions',
      AI_MODELS.openrouter,
      {
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://omniwealth.org',
        'X-Title': 'OmniWealth',
      },
    );
  }

  async function runGemini(key: string): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model: AI_MODELS.gemini,
        contents: [{ text: `${systemPrompt}\n\nUser Question: ${userPrompt}` }]
      });
      return response.text || '';
    } catch (err) {
      console.error('[ai] Gemini request threw:', err);
      providerErrors.push('Gemini threw');
      return '';
    }
  }

  async function runOpenAI(key: string): Promise<string> {
    return runOpenAICompatible(
      'OpenAI',
      'https://api.openai.com/v1/chat/completions',
      AI_MODELS.openai,
      { Authorization: `Bearer ${key}` },
    );
  }

  async function runClaude(key: string): Promise<string> {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: AI_MODELS.anthropic,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(`[ai] Claude ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
        providerErrors.push(`Claude ${res.status}`);
        return '';
      }
      return data.content?.[0]?.text || '';
    } catch (err) {
      console.error('[ai] Claude request threw:', err);
      providerErrors.push('Claude threw');
      return '';
    }
  }

  // --- FORCED PROVIDER OR AUTO CASCADE ---
  if (forcedProvider === 'groq' && groqKey) {
    answer = await runGroq(groqKey);
    if (answer) providerUsed = `Groq · ${AI_MODELS.groq} · ${src(groqOwn)}`;
  } else if (forcedProvider === 'openrouter' && openrouterKey) {
    answer = await runOpenRouter(openrouterKey);
    if (answer) providerUsed = `OpenRouter · ${AI_MODELS.openrouter} · ${src(openrouterOwn)}`;
  } else if (forcedProvider === 'gemini' && geminiKey) {
    answer = await runGemini(geminiKey);
    if (answer) providerUsed = `Google Gemini · ${AI_MODELS.gemini} · ${src(geminiOwn)}`;
  } else if (forcedProvider === 'openai' && openaiKey) {
    answer = await runOpenAI(openaiKey);
    if (answer) providerUsed = `OpenAI · ${AI_MODELS.openai} · ${src(openaiOwn)}`;
  } else if (forcedProvider === 'anthropic' && anthropicKey) {
    answer = await runClaude(anthropicKey);
    if (answer) providerUsed = `Anthropic · ${AI_MODELS.anthropic} · ${src(anthropicOwn)}`;
  } else {
    // --- AUTO FREE-FIRST CASCADE ---
    if (groqKey && !answer) {
      answer = await runGroq(groqKey);
      if (answer) providerUsed = `Groq · ${AI_MODELS.groq} · ${src(groqOwn)}`;
    }
    if (openrouterKey && !answer) {
      answer = await runOpenRouter(openrouterKey);
      if (answer) providerUsed = `OpenRouter · ${AI_MODELS.openrouter} · ${src(openrouterOwn)}`;
    }
    if (geminiKey && !answer) {
      answer = await runGemini(geminiKey);
      if (answer) providerUsed = `Google Gemini · ${AI_MODELS.gemini} · ${src(geminiOwn)}`;
    }
    if (openaiKey && !answer) {
      answer = await runOpenAI(openaiKey);
      if (answer) providerUsed = `OpenAI · ${AI_MODELS.openai} · ${src(openaiOwn)}`;
    }
    if (anthropicKey && !answer) {
      answer = await runClaude(anthropicKey);
      if (answer) providerUsed = `Anthropic · ${AI_MODELS.anthropic} · ${src(anthropicOwn)}`;
    }
  }

  if (!answer) {
    const anyKey = groqKey || openrouterKey || geminiKey || openaiKey || anthropicKey;
    console.error('[ai] askPortfolioAIAction: no provider produced an answer.', {
      forcedProvider,
      tried: providerErrors,
      hasGroq: Boolean(groqKey),
      hasOpenRouter: Boolean(openrouterKey),
      hasGemini: Boolean(geminiKey),
      hasOpenAI: Boolean(openaiKey),
      hasAnthropic: Boolean(anthropicKey),
    });
    return {
      success: false,
      error: !anyKey
        ? 'No AI provider key is configured. Add one in Profile → AI settings.'
        : `AI request failed (${providerErrors.join(', ') || 'no response'}). Check your provider keys.`,
    };
  }

  return { success: true, answer, providerUsed };
}