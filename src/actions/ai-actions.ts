'use server';

import { db } from '@/db';
import { users, assets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionUserAction, getExchangeRate } from '@/actions/vault';
import { GoogleGenAI } from '@google/genai';
import { revalidatePath } from 'next/cache';
import { checkRateLimit } from '@/lib/rate-limit';
import { encryptSecret, decryptSecret } from '@/lib/crypto';
import { isBusyError, SHARED_BUSY_MESSAGE, OWN_KEY_BUSY_MESSAGE } from '@/lib/aiErrors';

/**
 * Provider model IDs. Free/hosted model slugs change often (Groq retires
 * models, OpenRouter moves ":free" variants to paid), so each is
 * overridable via env without a code change.
 */
const AI_MODELS = {
  groq: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
  cerebras: process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
  openrouter: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
  gemini: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  openai: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  anthropic: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
};

export async function updateAiSettingsAction(formData: FormData) {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  // API keys are short; reject anything that clearly isn't one.
  const key = (name: string) => {
    const v = (formData.get(name) as string || '').trim();
    return v.length > 400 ? '' : v;
  };
  const groqApiKey = key('groqApiKey');
  const cerebrasApiKey = key('cerebrasApiKey');
  const openrouterApiKey = key('openrouterApiKey');
  const geminiApiKey = key('geminiApiKey');
  const openaiApiKey = key('openaiApiKey');
  const anthropicApiKey = key('anthropicApiKey');

  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (groqApiKey) updateData.groqApiKey = encryptSecret(groqApiKey);
  if (cerebrasApiKey) updateData.cerebrasApiKey = encryptSecret(cerebrasApiKey);
  if (openrouterApiKey) updateData.openrouterApiKey = encryptSecret(openrouterApiKey);
  if (geminiApiKey) updateData.geminiApiKey = encryptSecret(geminiApiKey);
  if (openaiApiKey) updateData.openaiApiKey = encryptSecret(openaiApiKey);
  if (anthropicApiKey) updateData.anthropicApiKey = encryptSecret(anthropicApiKey);

  await db.update(users).set(updateData as any).where(eq(users.id, session.user.id));
  revalidatePath('/profile');
  return { success: true };
}

export async function askPortfolioAIAction(rawPrompt: string, forcedProvider: string = 'auto') {
  const session = await getSessionUserAction();
  if (!session) return { success: false, error: 'Unauthorized' };

  const userPrompt = String(rawPrompt ?? '').trim().slice(0, 4000);
  if (!userPrompt) return { success: false, error: 'Ask a question first.' };

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

  const cerebrasOwn = decryptSecret(currentUser?.cerebrasApiKey);
  const cerebrasKey = cerebrasOwn || process.env.CEREBRAS_API_KEY;

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
    const magnitude = Math.abs(parseFloat(a.nativeValue || '0') * fx);
    // nativeValue is stored as a positive magnitude for liabilities too
    // (same convention the dashboard totals use) — subtract, don't add.
    const isLiability =
      (a.assetType || '').toUpperCase() === 'LIABILITY' ||
      (a.assetType || '').toUpperCase() === 'DEBT' ||
      (a.accountCategory || '').toUpperCase() === 'LIABILITY';
    const converted = isLiability ? -magnitude : magnitude;
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
  Household Net Worth: ${Math.round(totalVal)} ${session.household.baseCurrency} (assets minus liabilities; a negative "valueInBaseCurrency" below is a liability/debt).
  Portfolio: ${JSON.stringify(portfolioSummary)}
  Keep answers clean, concise, use Markdown bullet points (*), and never use LaTeX math brackets.`;

  let answer = '';
  let providerUsed = '';

  // --- HELPER EXECUTION FUNCTIONS (Guaranteed string return) ---
  const providerErrors: string[] = [];
  let sawBusy = false;

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
        signal: AbortSignal.timeout(25_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = JSON.stringify(data).slice(0, 400);
        console.error(`[ai] ${label} ${res.status}: ${detail}`);
        providerErrors.push(`${label} ${res.status}`);
        if (res.status === 429 || res.status === 503) sawBusy = true;
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

  async function runCerebras(key: string): Promise<string> {
    return runOpenAICompatible(
      'Cerebras',
      'https://api.cerebras.ai/v1/chat/completions',
      AI_MODELS.cerebras,
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
        'HTTP-Referer': process.env.APP_URL || 'https://www.omniwealth.org',
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
      if (isBusyError(err)) sawBusy = true;
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
        }),
        signal: AbortSignal.timeout(25_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(`[ai] Claude ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
        providerErrors.push(`Claude ${res.status}`);
        if (res.status === 429 || res.status === 503 || res.status === 529) sawBusy = true;
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
  } else if (forcedProvider === 'cerebras' && cerebrasKey) {
    answer = await runCerebras(cerebrasKey);
    if (answer) providerUsed = `Cerebras · ${AI_MODELS.cerebras} · ${src(cerebrasOwn)}`;
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
    // --- AUTO CASCADE ---
    // 1) Providers the user added themselves (an explicit choice), then
    // 2) the shared server keys, with Gemini first (the default engine) and the
    //    free-tier providers only as a last-resort fallback. Previously the free
    //    models ran first, which made answers slower and lower quality.
    const attempts: { id: string; key: string | undefined; own: boolean; run: (k: string) => Promise<string>; label: string }[] = [
      { id: 'gemini', key: geminiKey, own: Boolean(geminiOwn), run: runGemini, label: `Google Gemini · ${AI_MODELS.gemini}` },
      { id: 'anthropic', key: anthropicKey, own: Boolean(anthropicOwn), run: runClaude, label: `Anthropic · ${AI_MODELS.anthropic}` },
      { id: 'openai', key: openaiKey, own: Boolean(openaiOwn), run: runOpenAI, label: `OpenAI · ${AI_MODELS.openai}` },
      { id: 'groq', key: groqKey, own: Boolean(groqOwn), run: runGroq, label: `Groq · ${AI_MODELS.groq}` },
      { id: 'cerebras', key: cerebrasKey, own: Boolean(cerebrasOwn), run: runCerebras, label: `Cerebras · ${AI_MODELS.cerebras}` },
      { id: 'openrouter', key: openrouterKey, own: Boolean(openrouterOwn), run: runOpenRouter, label: `OpenRouter · ${AI_MODELS.openrouter}` },
    ];
    // Array.prototype.sort is stable: own keys first, default order kept within each group.
    const ordered = attempts.filter((x) => x.key).sort((x, y) => Number(y.own) - Number(x.own));
    for (const attempt of ordered) {
      if (answer) break;
      answer = await attempt.run(attempt.key as string);
      if (answer) providerUsed = `${attempt.label} · ${src(attempt.own ? 'own' : '')}`;
    }
  }

  if (!answer) {
    const anyKey = groqKey || cerebrasKey || openrouterKey || geminiKey || openaiKey || anthropicKey;
    console.error('[ai] askPortfolioAIAction: no provider produced an answer.', {
      forcedProvider,
      tried: providerErrors,
      hasGroq: Boolean(groqKey),
      hasCerebras: Boolean(cerebrasKey),
      hasOpenRouter: Boolean(openrouterKey),
      hasGemini: Boolean(geminiKey),
      hasOpenAI: Boolean(openaiKey),
      hasAnthropic: Boolean(anthropicKey),
    });
    return {
      success: false,
      error: !anyKey
        ? 'No AI provider key is configured. Add one in Profile → AI settings.'
        : sawBusy
          ? (geminiOwn || groqOwn || cerebrasOwn || openrouterOwn || openaiOwn || anthropicOwn
              ? OWN_KEY_BUSY_MESSAGE
              : SHARED_BUSY_MESSAGE)
          : `AI request failed (${providerErrors.join(', ') || 'no response'}). Check your provider keys.`,
    };
  }

  return { success: true, answer, providerUsed };
}