import {
  LlmProvider,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmFinishReason,
  LlmProviderConfig,
} from './types.js';

export class OpenAILlmProvider implements LlmProvider {
  public readonly name = 'openai';
  public readonly defaultModel: string;
  private apiKey: string;
  private timeoutMs: number;
  private maxRetries: number;

  constructor(apiKey: string, config: LlmProviderConfig = {}) {
    this.apiKey = apiKey.trim().replace(/^["']|["']$/g, '');
    this.defaultModel = config.model || process.env.LLM_MODEL || 'gpt-4o-mini';
    this.timeoutMs = config.timeoutMs || 30000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const model = request.options?.model || this.defaultModel;
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const messages: Array<{ role: string; content: string }> = [];

    // 1. Add system instruction
    const systemInstruction = request.systemInstruction || request.options?.systemInstruction;
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }

    // 2. Add history or prompt
    if (request.messages && request.messages.length > 0) {
      for (const msg of request.messages) {
        messages.push({ role: msg.role, content: msg.content });
      }
    } else {
      messages.push({ role: 'user', content: request.prompt });
    }

    // 3. Payload
    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: request.options?.temperature ?? 0.2,
    };

    if (request.options?.maxTokens !== undefined) {
      payload.max_tokens = request.options.maxTokens;
    }
    if (request.options?.topP !== undefined) {
      payload.top_p = request.options.topP;
    }
    if (request.options?.stopSequences && request.options.stopSequences.length > 0) {
      payload.stop = request.options.stopSequences;
    }

    const startTime = performance.now();
    const data = await this.callWithRetry(endpoint, payload);
    const latencyMs = Math.round(performance.now() - startTime);

    const choice = data.choices?.[0];
    const content = choice?.message?.content || '';
    const finishReasonRaw = choice?.finish_reason || 'stop';

    let finishReason: LlmFinishReason = 'stop';
    if (finishReasonRaw === 'length') finishReason = 'length';
    else if (finishReasonRaw === 'content_filter') finishReason = 'content_filter';
    else if (finishReasonRaw !== 'stop') finishReason = 'other';

    const usage = data.usage;

    return {
      content,
      model,
      provider: this.name,
      finishReason,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
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
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const messages: Array<{ role: string; content: string }> = [];
    const systemInstruction = request.systemInstruction || request.options?.systemInstruction;
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }

    if (request.messages && request.messages.length > 0) {
      for (const msg of request.messages) {
        messages.push({ role: msg.role, content: msg.content });
      }
    } else {
      messages.push({ role: 'user', content: request.prompt });
    }

    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: request.options?.temperature ?? 0.2,
      stream: true,
    };

    if (request.options?.maxTokens !== undefined) {
      payload.max_tokens = request.options.maxTokens;
    }

    const startTime = performance.now();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI LLM streaming failed (${response.status}): ${errText}`);
    }

    if (!response.body) {
      throw new Error('OpenAI streaming response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let buffer = '';
    let lastFinishReason: LlmFinishReason = 'stop';

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
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const choice = parsed.choices?.[0];
            const token = choice?.delta?.content || '';
            if (choice?.finish_reason) {
              lastFinishReason = choice.finish_reason === 'length' ? 'length' : 'stop';
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
      model,
      provider: this.name,
      finishReason: lastFinishReason,
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
            Authorization: `Bearer ${this.apiKey}`,
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
        const isServerUnavailable = response.status >= 500;

        if (!isRateLimit && !isServerUnavailable) {
          throw new Error(`OpenAI LLM API failed with status ${response.status}: ${errorBody}`);
        }

        if (attempt < this.maxRetries - 1) {
          console.warn(
            `[OpenAILlm] Rate limit / server error (${response.status}). Retrying in ${delay}ms... (attempt ${attempt + 1}/${this.maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          attempt++;
          continue;
        }

        throw new Error(`OpenAI LLM API failed with status ${response.status}: ${errorBody}`);
      } catch (err: any) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
          throw new Error(`OpenAI LLM request timed out after ${this.timeoutMs}ms`);
        }
        if (err.message && err.message.startsWith('OpenAI LLM API failed with status')) {
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

    throw new Error('OpenAI LLM API exceeded maximum retry attempts');
  }
}
