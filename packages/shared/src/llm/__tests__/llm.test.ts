import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MockLlmProvider,
  GeminiLlmProvider,
  OpenAILlmProvider,
  getLlmProvider,
  registerLlmProvider,
  resetLlmProvider,
  LlmProvider,
} from '../index.js';

describe('LLM Provider Abstraction & Implementations', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_MODEL;
    resetLlmProvider();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetLlmProvider();
  });

  describe('MockLlmProvider', () => {
    it('should generate a default mock response with token usage', async () => {
      const provider = new MockLlmProvider({ latencyMs: 0 });
      const res = await provider.generate({
        prompt: 'What is Seekr?',
        systemInstruction: 'Answer accurately.',
      });

      expect(res.content).toContain('synthesized research answer');
      expect(res.provider).toBe('mock');
      expect(res.model).toBe('mock-llm-v1');
      expect(res.finishReason).toBe('stop');
      expect(res.usage?.promptTokens).toBeGreaterThan(0);
      expect(res.usage?.completionTokens).toBeGreaterThan(0);
      expect(res.usage?.totalTokens).toBe(res.usage!.promptTokens! + res.usage!.completionTokens!);
      expect(provider.recordedRequests).toHaveLength(1);
    });

    it('should allow custom replies and error simulation', async () => {
      const provider = new MockLlmProvider({ latencyMs: 0 });
      provider.setReply('Custom synthetic reply.');

      let res = await provider.generate({ prompt: 'Hello' });
      expect(res.content).toBe('Custom synthetic reply.');

      provider.setThrowError(new Error('Simulated LLM outage'));
      await expect(provider.generate({ prompt: 'Hello again' })).rejects.toThrow('Simulated LLM outage');
    });

    it('should stream tokens incrementally through generateStream and respect abort signal', async () => {
      const provider = new MockLlmProvider({
        defaultReply: 'Token one and token two.',
        latencyMs: 1,
      });

      const collectedTokens: string[] = [];
      const res = await provider.generateStream(
        { prompt: 'Stream test' },
        (chunk) => {
          collectedTokens.push(chunk.token);
        }
      );

      expect(collectedTokens.length).toBeGreaterThan(1);
      expect(collectedTokens.join('')).toBe('Token one and token two.');
      expect(res.content).toBe('Token one and token two.');

      // Test abort signal
      const controller = new AbortController();
      controller.abort();
      await expect(
        provider.generateStream({ prompt: 'Aborted' }, () => {}, controller.signal)
      ).rejects.toThrow('aborted by client');
    });
  });

  describe('Factory & Registry (getLlmProvider)', () => {
    it('should return MockLlmProvider when no API keys are configured', () => {
      const provider = getLlmProvider();
      expect(provider.name).toBe('mock');
    });

    it('should return GeminiLlmProvider when GEMINI_API_KEY is present', () => {
      process.env.GEMINI_API_KEY = 'test-gemini-key';
      const provider = getLlmProvider();
      expect(provider.name).toBe('gemini');
      expect(provider).toBeInstanceOf(GeminiLlmProvider);
    });

    it('should return OpenAILlmProvider when configured with OpenAI key and provider', () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.LLM_PROVIDER = 'openai';
      const provider = getLlmProvider();
      expect(provider.name).toBe('openai');
      expect(provider).toBeInstanceOf(OpenAILlmProvider);
    });

    it('should support registering custom providers via registerLlmProvider', async () => {
      const customProvider: LlmProvider = {
        name: 'custom-ai',
        defaultModel: 'custom-v1',
        generate: async () => ({
          content: 'from custom',
          model: 'custom-v1',
          provider: 'custom-ai',
          latencyMs: 1,
        }),
      };

      registerLlmProvider('custom-ai', customProvider);
      const retrieved = getLlmProvider({ provider: 'custom-ai' });
      expect(retrieved.name).toBe('custom-ai');
      const res = await retrieved.generate({ prompt: 'hi' });
      expect(res.content).toBe('from custom');
    });

    it('should cache singleton provider instance when called without custom config', () => {
      process.env.GEMINI_API_KEY = 'test-key';
      const p1 = getLlmProvider();
      const p2 = getLlmProvider();
      expect(p1).toBe(p2);
    });
  });

  describe('GeminiLlmProvider', () => {
    it('should format request payload correctly and parse response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: 'Grounded answer [1].' }] },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: {
            promptTokenCount: 150,
            candidatesTokenCount: 30,
            totalTokenCount: 180,
          },
        }),
      });
      global.fetch = mockFetch;

      const provider = new GeminiLlmProvider('fake-gemini-key', {
        model: 'gemini-2.5-flash',
        timeoutMs: 5000,
      });

      const res = await provider.generate({
        prompt: 'Explain Redis persistence.',
        systemInstruction: 'Be concise.',
        options: {
          temperature: 0.1,
          maxTokens: 500,
        },
      });

      expect(res.content).toBe('Grounded answer [1].');
      expect(res.model).toBe('gemini-2.5-flash');
      expect(res.provider).toBe('gemini');
      expect(res.finishReason).toBe('stop');
      expect(res.usage?.promptTokens).toBe(150);
      expect(res.usage?.completionTokens).toBe(30);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const call = mockFetch.mock.calls[0];
      const url = call[0];
      const options = call[1];

      expect(url).toContain('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
      expect(options.headers['X-goog-api-key']).toBe('fake-gemini-key');

      const body = JSON.parse(options.body);
      expect(body.contents[0].parts[0].text).toBe('Explain Redis persistence.');
      expect(body.systemInstruction.parts[0].text).toBe('Be concise.');
      expect(body.generationConfig.temperature).toBe(0.1);
      expect(body.generationConfig.maxOutputTokens).toBe(500);
    });

    it('should handle API errors and throw meaningful message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid request parameter',
      });

      const provider = new GeminiLlmProvider('fake-gemini-key', { maxRetries: 1 });
      await expect(
        provider.generate({ prompt: 'test' })
      ).rejects.toThrow('Gemini LLM API failed with status 400: Invalid request parameter');
    });

    it('should handle timeouts gracefully', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      const provider = new GeminiLlmProvider('fake-gemini-key', { timeoutMs: 100, maxRetries: 1 });
      await expect(
        provider.generate({ prompt: 'test' })
      ).rejects.toThrow('Gemini LLM request timed out after 100ms');
    });
  });

  describe('OpenAILlmProvider', () => {
    it('should format request payload and map messages correctly', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: { content: 'OpenAI answer [1].' },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 25,
            total_tokens: 125,
          },
        }),
      });
      global.fetch = mockFetch;

      const provider = new OpenAILlmProvider('fake-openai-key', {
        model: 'gpt-4o-mini',
      });

      const res = await provider.generate({
        prompt: 'User query',
        systemInstruction: 'You are a research assistant.',
        options: { temperature: 0.3 },
      });

      expect(res.content).toBe('OpenAI answer [1].');
      expect(res.provider).toBe('openai');
      expect(res.usage?.totalTokens).toBe(125);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[0]).toEqual({ role: 'system', content: 'You are a research assistant.' });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'User query' });
      expect(body.temperature).toBe(0.3);
    });
  });
});
