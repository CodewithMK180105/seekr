import { EmbeddingProvider } from './types.js';
import { GeminiEmbeddingProvider } from './gemini.js';
import { OpenAIEmbeddingProvider } from './openai.js';
import { MockEmbeddingProvider } from './mock.js';

let cachedProvider: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const providerType = (process.env.EMBEDDING_PROVIDER || 'gemini').toLowerCase();
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (providerType === 'openai' && openaiKey) {
    cachedProvider = new OpenAIEmbeddingProvider(openaiKey);
    return cachedProvider;
  }

  if (geminiKey) {
    cachedProvider = new GeminiEmbeddingProvider(geminiKey);
    return cachedProvider;
  }

  if (openaiKey) {
    cachedProvider = new OpenAIEmbeddingProvider(openaiKey);
    return cachedProvider;
  }

  console.warn(
    '⚠️ [Embeddings] No valid GEMINI_API_KEY or OPENAI_API_KEY found in environment.' +
    ' Using MockEmbeddingProvider (768-dim deterministic vectors). Add GEMINI_API_KEY to .env for production vectors.'
  );

  cachedProvider = new MockEmbeddingProvider();
  return cachedProvider;
}
