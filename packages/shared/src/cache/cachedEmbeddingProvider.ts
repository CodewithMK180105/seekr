import { EmbeddingProvider } from '../embeddings/types.js';
import { RedisCacheService } from './redisCacheService.js';

export class CachedEmbeddingProvider implements EmbeddingProvider {
  private baseProvider: EmbeddingProvider;
  private cache: RedisCacheService;
  public readonly name: string;
  public readonly dimension: number;

  constructor(baseProvider: EmbeddingProvider, cache: RedisCacheService = new RedisCacheService()) {
    this.baseProvider = baseProvider;
    this.cache = cache;
    this.name = baseProvider.name;
    this.dimension = baseProvider.dimension;
  }

  async embedText(text: string): Promise<number[]> {
    const cached = await this.cache.getEmbedding(this.name, text);
    if (cached && Array.isArray(cached) && cached.length === this.dimension) {
      return cached;
    }

    const vector = await this.baseProvider.embedText(text);
    if (vector && vector.length === this.dimension) {
      // Fire-and-forget cache write
      this.cache.setEmbedding(this.name, text, vector).catch(() => {});
    }

    return vector;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: Array<number[] | null> = new Array(texts.length).fill(null);
    const missingIndices: number[] = [];
    const missingTexts: string[] = [];

    // Check cache for each text
    await Promise.all(
      texts.map(async (t, i) => {
        const cached = await this.cache.getEmbedding(this.name, t);
        if (cached && cached.length === this.dimension) {
          results[i] = cached;
        } else {
          missingIndices.push(i);
          missingTexts.push(t);
        }
      })
    );

    // If all vectors were cached, return directly
    if (missingTexts.length === 0) {
      return results as number[][];
    }

    // Call base provider only for uncached texts
    const generated = await this.baseProvider.embedBatch(missingTexts);

    // Save newly generated vectors to cache and populate results
    for (let j = 0; j < missingIndices.length; j++) {
      const originalIdx = missingIndices[j];
      const vector = generated[j];
      results[originalIdx] = vector;

      if (vector && vector.length === this.dimension) {
        this.cache.setEmbedding(this.name, texts[originalIdx], vector).catch(() => {});
      }
    }

    return results as number[][];
  }
}
