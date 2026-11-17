import { EmbeddingProvider } from './types.js';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  public readonly name = 'openai';
  public readonly dimension = 1536;
  private apiKey: string;
  private endpoint = 'https://api.openai.com/v1/embeddings';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async embedText(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const BATCH_SIZE = 100;
    const allVectors: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const slice = texts.slice(i, i + BATCH_SIZE);
      const batchVectors = await this.callApiWithRetry(slice);
      allVectors.push(...batchVectors);
    }

    return allVectors;
  }

  private async callApiWithRetry(texts: string[], maxRetries = 3): Promise<number[][]> {
    const payload = {
      model: 'text-embedding-3-small',
      input: texts,
    };

    let attempt = 0;
    let delay = 1000;

    while (attempt < maxRetries) {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 429 || response.status >= 500) {
          attempt++;
          console.warn(`[OpenAIEmbeddings] Rate limit (${response.status}). Retrying in ${delay}ms...`);
          await new Promise((res) => setTimeout(res, delay));
          delay *= 2;
          continue;
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenAI Embedding API Error (${response.status}): ${errText}`);
        }

        const data: any = await response.json();
        return data.data.map((item: any) => item.embedding);
      } catch (err: any) {
        attempt++;
        if (attempt >= maxRetries) throw err;
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2;
      }
    }

    throw new Error('OpenAI embedding generation failed after retries');
  }
}
