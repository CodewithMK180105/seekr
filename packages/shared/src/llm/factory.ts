import { LlmProvider } from './types.js';
import { GeminiLlmProvider } from './gemini.js';
import { OpenAILlmProvider } from './openai.js';
import { MockLlmProvider } from './mock.js';

let cachedProvider: LlmProvider | null = null;
const registry = new Map<string, LlmProvider>();

export function registerLlmProvider(name: string, provider: LlmProvider): void {
  registry.set(name.toLowerCase(), provider);
  cachedProvider = provider;
}

export function resetLlmProvider(): void {
  cachedProvider = null;
  registry.clear();
}

export function getLlmProvider(config?: { provider?: string; apiKey?: string; model?: string }): LlmProvider {
  if (!config && cachedProvider) {
    return cachedProvider;
  }

  const providerType = (config?.provider || process.env.LLM_PROVIDER || 'gemini').toLowerCase();
  const geminiKey = config?.apiKey || process.env.GEMINI_API_KEY;
  const openaiKey = config?.apiKey || process.env.OPENAI_API_KEY;

  if (registry.has(providerType)) {
    return registry.get(providerType)!;
  }

  if (providerType === 'mock') {
    const mock = new MockLlmProvider();
    if (!config) cachedProvider = mock;
    return mock;
  }

  if (providerType === 'openai' && openaiKey) {
    const openai = new OpenAILlmProvider(openaiKey, { model: config?.model });
    if (!config) cachedProvider = openai;
    return openai;
  }

  if (geminiKey) {
    const gemini = new GeminiLlmProvider(geminiKey, { model: config?.model });
    if (!config) cachedProvider = gemini;
    return gemini;
  }

  if (openaiKey) {
    const openai = new OpenAILlmProvider(openaiKey, { model: config?.model });
    if (!config) cachedProvider = openai;
    return openai;
  }

  console.warn(
    '⚠️ [LLM] No valid GEMINI_API_KEY or OPENAI_API_KEY found in environment.' +
    ' Using MockLlmProvider. Add GEMINI_API_KEY to .env for production responses.'
  );

  const fallback = new MockLlmProvider();
  if (!config) cachedProvider = fallback;
  return fallback;
}
