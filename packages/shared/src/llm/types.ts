export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmGenerateOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  timeoutMs?: number;
}

export interface LlmGenerateRequest {
  prompt: string;
  systemInstruction?: string;
  messages?: LlmMessage[];
  options?: LlmGenerateOptions;
}

export interface LlmUsageMetadata {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export type LlmFinishReason = 'stop' | 'length' | 'content_filter' | 'error' | 'other';

export interface LlmGenerateResponse {
  content: string;
  model: string;
  provider: string;
  finishReason?: LlmFinishReason;
  usage?: LlmUsageMetadata;
  latencyMs: number;
}

export interface LlmProviderConfig {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface LlmStreamChunk {
  token: string;
  finishReason?: LlmFinishReason;
  usage?: LlmUsageMetadata;
}

export interface LlmProvider {
  readonly name: string;
  readonly defaultModel: string;

  /**
   * Generates a completion from the LLM given a structured request.
   */
  generate(request: LlmGenerateRequest): Promise<LlmGenerateResponse>;

  /**
   * Streams generation tokens incrementally as they arrive from the model.
   */
  generateStream?(
    request: LlmGenerateRequest,
    onToken: (chunk: LlmStreamChunk) => void | Promise<void>,
    signal?: AbortSignal
  ): Promise<LlmGenerateResponse>;
}
