import crypto from 'crypto';
import { EmbeddingProvider } from './types.js';

export class MockEmbeddingProvider implements EmbeddingProvider {
  public readonly name = 'mock';
  public readonly dimension = 768;

  async embedText(text: string): Promise<number[]> {
    return this.generateDeterministicVector(text, this.dimension);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.generateDeterministicVector(t, this.dimension));
  }

  /**
   * Generates a deterministic, L2-normalized vector from text content.
   */
  private generateDeterministicVector(text: string, dimension: number): number[] {
    const hash = crypto.createHash('sha256').update(text || 'empty', 'utf8').digest();
    const vector: number[] = new Array(dimension);

    let sumSq = 0;
    for (let i = 0; i < dimension; i++) {
      // Use hash bytes with pseudo-random linear congruential generator
      const byte = hash[i % hash.length];
      const val = Math.sin((i + 1) * byte) * 10;
      vector[i] = val;
      sumSq += val * val;
    }

    // Normalize to unit length (L2 norm = 1.0) for cosine distance
    const norm = Math.sqrt(sumSq) || 1;
    for (let i = 0; i < dimension; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(6));
    }

    return vector;
  }
}
