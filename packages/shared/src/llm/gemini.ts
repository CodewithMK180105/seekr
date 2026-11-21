import {
  LlmProvider,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmFinishReason,
  LlmProviderConfig,
} from './types.js';

export class GeminiLlmProvider implements LlmProvider {
  public readonly name = 'gemini';
  public readonly defaultModel: string;
  private apiKey: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(apiKey: string, config: LlmProviderConfig = {}) {
    this.apiKey = apiKey.trim().replace(/^["']|["']$/g, '');
    this.defaultModel = config.model || process.env.LLM_MODEL || 'gemini-3.5-flash-lite';
    this.timeoutMs = config.timeoutMs || 30000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const model = request.options?.model || this.defaultModel;
    const strippedModel = model.replace(/^models\//, '');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${strippedModel}:generateContent`;

    // 1. Build contents array (support single prompt or conversation history)
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (request.messages && request.messages.length > 0) {
      for (const msg of request.messages) {
        if (msg.role === 'system') continue; // handled via systemInstruction
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: request.prompt }],
      });
    }

    // 2. Build system instruction
    const systemInstructionText = request.systemInstruction || request.options?.systemInstruction;
    const systemInstruction = systemInstructionText
      ? { parts: [{ text: systemInstructionText }] }
      : undefined;

    // 3. Build generationConfig
    const generationConfig: Record<string, unknown> = {};
    if (request.options?.temperature !== undefined) {
      generationConfig.temperature = request.options.temperature;
    }
    if (request.options?.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = request.options.maxTokens;
    }
    if (request.options?.topP !== undefined) {
      generationConfig.topP = request.options.topP;
    }
    if (request.options?.stopSequences && request.options.stopSequences.length > 0) {
      generationConfig.stopSequences = request.options.stopSequences;
    }

    const payload: Record<string, unknown> = { contents };
    if (systemInstruction) payload.systemInstruction = systemInstruction;
    if (Object.keys(generationConfig).length > 0) payload.generationConfig = generationConfig;

    const startTime = performance.now();
    const data = await this.callWithRetry(endpoint, payload);
    const latencyMs = Math.round(performance.now() - startTime);

    // 4. Parse response
    const candidate = data.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text || '';
    const finishReasonRaw = candidate?.finishReason || 'STOP';

    let finishReason: LlmFinishReason = 'stop';
    if (finishReasonRaw === 'MAX_TOKENS') finishReason = 'length';
    else if (finishReasonRaw === 'SAFETY') finishReason = 'content_filter';
    else if (finishReasonRaw === 'RECITATION') finishReason = 'content_filter';
    else if (finishReasonRaw !== 'STOP') finishReason = 'other';

    const usageMetadata = data.usageMetadata;

    return {
      content: textPart,
      model: strippedModel,
      provider: this.name,
      finishReason,
      usage: usageMetadata
        ? {
            promptTokens: usageMetadata.promptTokenCount,
            completionTokens: usageMetadata.candidatesTokenCount,
            totalTokens: usageMetadata.totalTokenCount,
          }
        : undefined,
      latencyMs,
    };
  }

  async generateStream(
    request: LlmGenerateRequest,
    onToken: (chunk: { token: string; finishReason?: LlmFinishReason }) => void | Promise<void>,
    signal?: AbortSignal
  ): Promise<LlmGenerateResponse> {
    const model = request.options?.model || this.defaultModel;
    const strippedModel = model.replace(/^models\//, '');
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${strippedModel}:streamGenerateContent?alt=sse`;

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    if (request.messages && request.messages.length > 0) {
      for (const msg of request.messages) {
        if (msg.role === 'system') continue;
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: request.prompt }],
      });
    }

    const systemInstructionText = request.systemInstruction || request.options?.systemInstruction;
    const systemInstruction = systemInstructionText
      ? { parts: [{ text: systemInstructionText }] }
      : undefined;

    const generationConfig: Record<string, unknown> = {};
    if (request.options?.temperature !== undefined) {
      generationConfig.temperature = request.options.temperature;
    }
    if (request.options?.maxTokens !== undefined) {
      generationConfig.maxOutputTokens = request.options.maxTokens;
    }
    if (request.options?.topP !== undefined) {
      generationConfig.topP = request.options.topP;
    }

    const payload: Record<string, unknown> = { contents };
    if (systemInstruction) payload.systemInstruction = systemInstruction;
    if (Object.keys(generationConfig).length > 0) payload.generationConfig = generationConfig;

    const startTime = performance.now();
    let response: Response | null = null;
    let attempt = 0;
    let delay = 1000;

    while (attempt < this.maxRetries) {
      if (signal?.aborted) {
        throw new Error('This operation was aborted');
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(payload),
        signal,
      });

      if (res.ok) {
        response = res;
        break;
      }

      const errText = await res.text();
      const isRetryable = res.status === 429 || res.status === 503 || res.status === 502;
      if (!isRetryable || attempt >= this.maxRetries - 1) {
        throw new Error(`Gemini LLM streaming failed (${res.status}): ${errText}`);
      }

      console.warn(
        `[GeminiLlm] Streaming rate limit / server error (${res.status}). Retrying in ${delay}ms... (attempt ${attempt + 1}/${this.maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
      attempt++;
    }

    if (!response) {
      throw new Error('Gemini streaming response could not be established');
    }

    if (!response.body) {
      throw new Error('Gemini streaming response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let buffer = '';
    let lastFinishReason: LlmFinishReason = 'stop';
    let lastUsage: any = undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, '');
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const candidate = parsed.candidates?.[0];
            const token = candidate?.content?.parts?.[0]?.text || '';
            if (candidate?.finishReason) {
              const raw = candidate.finishReason;
              if (raw === 'MAX_TOKENS') lastFinishReason = 'length';
              else if (raw === 'SAFETY' || raw === 'RECITATION') lastFinishReason = 'content_filter';
              else if (raw === 'STOP') lastFinishReason = 'stop';
            }
            if (parsed.usageMetadata) {
              lastUsage = parsed.usageMetadata;
            }

            if (token) {
              accumulatedText += token;
              await onToken({ token, finishReason: lastFinishReason });
            }
          } catch {
            // ignore non-json SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const latencyMs = Math.round(performance.now() - startTime);

    return {
      content: accumulatedText,
      model: strippedModel,
      provider: this.name,
      finishReason: lastFinishReason,
      usage: lastUsage
        ? {
            promptTokens: lastUsage.promptTokenCount,
            completionTokens: lastUsage.candidatesTokenCount,
            totalTokens: lastUsage.totalTokenCount,
          }
        : undefined,
      latencyMs,
    };
  }

  private async callWithRetry(endpoint: string, payload: unknown): Promise<any> {
    let attempt = 0;
    let delay = 1000;

    while (attempt < this.maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': this.apiKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.ok) {
          return await response.json();
        }

        const errorBody = await response.text();
        const isRateLimit = response.status === 429;
        const isServerUnavailable = response.status === 503 || response.status === 502;

        if (!isRateLimit && !isServerUnavailable) {
          // Client error (e.g. 400 Invalid API Key, 403 Forbidden) is not retryable
          throw new Error(`Gemini LLM API failed with status ${response.status}: ${errorBody}`);
        }

        if (attempt < this.maxRetries - 1) {
          console.warn(
            `[GeminiLlm] Rate limit / server error (${response.status}). Retrying in ${delay}ms... (attempt ${attempt + 1}/${this.maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          attempt++;
          continue;
        }

        throw new Error(`Gemini LLM API failed with status ${response.status}: ${errorBody}`);
      } catch (err: any) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
          if (attempt < this.maxRetries - 1) {
            console.warn(
              `[GeminiLlm] Request timed out after ${this.timeoutMs}ms. Retrying... (attempt ${attempt + 1}/${this.maxRetries})`
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
            attempt++;
            continue;
          }
          throw new Error(`Gemini LLM request timed out after ${this.timeoutMs}ms`);
        }
        // If error is already a formatted non-retryable API error, do not retry
        if (err.message && err.message.startsWith('Gemini LLM API failed with status')) {
          throw err;
        }
        if (attempt >= this.maxRetries - 1) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        attempt++;
      }
    }

    throw new Error('Gemini LLM API exceeded maximum retry attempts');
  }
}
