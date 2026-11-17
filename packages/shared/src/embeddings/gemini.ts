import { EmbeddingProvider } from './types.js';

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  public readonly name = 'gemini';
  public readonly dimension = 768;
  private apiKey: string;
  private modelName: string;
  private endpoint: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey.trim().replace(/^["']|["']$/g, '');
    this.modelName = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
    // Normalize model identifier
    const strippedModel = this.modelName.replace(/^models\//, '');
    this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${strippedModel}:batchEmbedContents`;
  }

  async embedText(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Gemini supports up to 100 contents per batchEmbedContents request
    const BATCH_SIZE = 50;
    const allVectors: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const slice = texts.slice(i, i + BATCH_SIZE);
      const batchVectors = await this.callApiWithRetry(slice);
      allVectors.push(...batchVectors);
    }

    return allVectors;
  }

  private async callApiWithRetry(texts: string[], maxRetries = 3): Promise<number[][]> {
    const modelPath = this.modelName.startsWith('models/') ? this.modelName : `models/${this.modelName}`;
    const payload = {
      requests: texts.map((text) => ({
        model: modelPath,
        content: {
          parts: [{ text }],
        },
        outputDimensionality: this.dimension,
      })),
    };

    let attempt = 0;
    let delay = 1000;

    while (attempt < maxRetries) {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 429 || response.status >= 500) {
          attempt++;
          console.warn(`[GeminiEmbeddings] Rate limit / server error (${response.status}). Retrying in ${delay}ms...`);
          await new Promise((res) => setTimeout(res, delay));
          delay *= 2;
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini Embedding API Error (${response.status}): ${errText}`);
        }

        const data: any = await response.json();
        if (!data.embeddings || !Array.isArray(data.embeddings)) {
          throw new Error('Invalid response structure from Gemini Embedding API');
        }

        return data.embeddings.map((e: any) => e.values);
      } catch (err: any) {
        attempt++;
        if (attempt >= maxRetries) throw err;
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
      }
    }

    throw new Error('Gemini embedding generation failed after retries');
  }
}
