export interface EmbeddingProvider {
  readonly name: string;
  readonly dimension: number;

  /**
   * Generates a vector embedding for a single text.
   */
  embedText(text: string): Promise<number[]>;

  /**
   * Generates vector embeddings for multiple texts in batch.
   */
  embedBatch(texts: string[]): Promise<number[][]>;
}
