import { EmbeddingProvider } from './types.js';
import { GeminiEmbeddingProvider } from './gemini.js';
import { OpenAIEmbeddingProvider } from './openai.js';
import { MockEmbeddingProvider } from './mock.js';
import { CachedEmbeddingProvider } from '../cache/cachedEmbeddingProvider.js';

let cachedProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const providerType = (process.env.EMBEDDING_PROVIDER || 'gemini').toLowerCase();
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  let baseProvider: EmbeddingProvider;

  if (providerType === 'openai' && openaiKey) {
    baseProvider = new OpenAIEmbeddingProvider(openaiKey);
  } else if (geminiKey) {
    baseProvider = new GeminiEmbeddingProvider(geminiKey);
  } else if (openaiKey) {
    baseProvider = new OpenAIEmbeddingProvider(openaiKey);
  } else {
    console.warn(
      '⚠️ [Embeddings] No valid GEMINI_API_KEY or OPENAI_API_KEY found in environment.' +
      ' Using MockEmbeddingProvider (768-dim deterministic vectors). Add GEMINI_API_KEY to .env for production vectors.'
    );
    baseProvider = new MockEmbeddingProvider();
  }

  if (process.env.EMBEDDING_CACHE_DISABLED === 'true') {
    cachedProvider = baseProvider;
  } else {
    cachedProvider = new CachedEmbeddingProvider(baseProvider);
  }

  return cachedProvider;
}

export function resetEmbeddingProvider(): void {
  cachedProvider = null;
}
