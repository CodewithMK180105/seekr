import {
  LlmProvider,
  LlmGenerateRequest,
  LlmGenerateResponse,
  LlmFinishReason,
} from './types.js';

export interface MockLlmOptions {
  defaultReply?: string;
  latencyMs?: number;
  throwError?: Error | null;
  finishReason?: LlmFinishReason;
}

export class MockLlmProvider implements LlmProvider {
  public readonly name = 'mock';
  public readonly defaultModel = 'mock-llm-v1';

  private defaultReply: string;
  private latencyMs: number;
  private throwError: Error | null;
  private finishReason: LlmFinishReason;
  public recordedRequests: LlmGenerateRequest[] = [];

  constructor(options: MockLlmOptions = {}) {
    this.defaultReply =
      options.defaultReply ||
      'This is a synthesized research answer based on the provided sources [1]. The findings demonstrate that data is retained reliably [2].';
    this.latencyMs = options.latencyMs ?? 5;
    this.throwError = options.throwError ?? null;
    this.finishReason = options.finishReason ?? 'stop';
  }

  public setReply(reply: string): void {
    this.defaultReply = reply;
  }

  public setThrowError(error: Error | null): void {
    this.throwError = error;
  }

  public clearHistory(): void {
    this.recordedRequests = [];
  }

  async generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    this.recordedRequests.push(request);

    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }

    if (this.throwError) {
      throw this.throwError;
    }

    const promptTokens = Math.ceil((request.prompt.length + (request.systemInstruction?.length || 0)) / 4);
    const completionTokens = Math.ceil(this.defaultReply.length / 4);

    return {
      content: this.defaultReply,
      model: request.options?.model || this.defaultModel,
      provider: this.name,
      finishReason: this.finishReason,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      latencyMs: this.latencyMs,
    };
  }

  async generateStream(
    request: LlmGenerateRequest,
    onToken: (chunk: { token: string; finishReason?: LlmFinishReason }) => void | Promise<void>,
    signal?: AbortSignal
  ): Promise<LlmGenerateResponse> {
    this.recordedRequests.push(request);

    if (this.throwError) {
      throw this.throwError;
    }

    // Split reply by word boundary keeping whitespace
    const tokens = this.defaultReply.match(/\S+\s*/g) || [this.defaultReply];
    const startTime = performance.now();

    for (let i = 0; i < tokens.length; i++) {
      if (signal?.aborted) {
        throw new Error('LLM generation stream aborted by client');
      }

      const token = tokens[i];
      const isLast = i === tokens.length - 1;
      await onToken({
        token,
        finishReason: isLast ? this.finishReason : undefined,
      });

      if (this.latencyMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, Math.floor(this.latencyMs / tokens.length))));
      }
    }

    const latencyMs = Math.round(performance.now() - startTime);
    const promptTokens = Math.ceil((request.prompt.length + (request.systemInstruction?.length || 0)) / 4);
    const completionTokens = Math.ceil(this.defaultReply.length / 4);

    return {
      content: this.defaultReply,
      model: request.options?.model || this.defaultModel,
      provider: this.name,
      finishReason: this.finishReason,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      latencyMs,
    };
  }
}
