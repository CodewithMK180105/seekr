import { randomUUID } from 'node:crypto';
import { SearchResultItem } from '@seekr/types';
import {
  LlmProvider,
  getLlmProvider,
  researchRequestsTotal,
  researchTokensTotal,
  researchStreamingRequestsTotal,
  researchStreamingOutcomesTotal,
  researchDurationSeconds,
  llmGenerationDurationSeconds,
  researchCitationsPerSession,
} from '@seekr/shared';
import { SearchService } from '../search/services/search.service.js';
import { ContextAssembler, DEFAULT_SYSTEM_INSTRUCTION } from './context-assembler.js';
import { CitationPostProcessor, VerifiedCitation } from './citation-post-processor.js';
import { ResearchRepository } from './research.repository.js';
import { SemanticCacheService } from '../cache/semantic-cache.service.js';
import {
  ResearchRequest,
  ResearchResponse,
  AssembledContext,
  ContextAssemblerOptions,
  AssembledSource,
} from './types.js';

export interface ResearchStreamCallbacks {
  onSources?: (sources: AssembledSource[]) => void | Promise<void>;
  onToken?: (token: string) => void | Promise<void>;
  onCitations?: (citations: VerifiedCitation[]) => void | Promise<void>;
  onComplete?: (session: ResearchResponse) => void | Promise<void>;
}

export class ResearchService {
  private searchService?: SearchService;
  private explicitLlmProvider?: LlmProvider;
  private assembler: ContextAssembler;
  private citationPostProcessor: CitationPostProcessor;
  private researchRepository: ResearchRepository;
  private semanticCache: SemanticCacheService;

  constructor(options: {
    searchService?: SearchService;
    llmProvider?: LlmProvider;
    assemblerOptions?: ContextAssemblerOptions;
    researchRepository?: ResearchRepository;
    citationPostProcessor?: CitationPostProcessor;
    semanticCache?: SemanticCacheService;
  } = {}) {
    this.searchService = options.searchService || new SearchService();
    this.explicitLlmProvider = options.llmProvider;
    this.assembler = new ContextAssembler(options.assemblerOptions);
    this.citationPostProcessor = options.citationPostProcessor || new CitationPostProcessor();
    this.researchRepository = options.researchRepository || new ResearchRepository();
    this.semanticCache = options.semanticCache || new SemanticCacheService();
  }

  private get llmProvider(): LlmProvider {
    return this.explicitLlmProvider || getLlmProvider();
  }

  /**
   * Conducts research synchronously: retrieves context, assembles it defensively,
   * synthesizes answer via LLM, extracts verified citations, and persists the session.
   */
  async research(
    request: ResearchRequest,
    preRetrievedResults?: SearchResultItem[],
    options: { persist?: boolean } = { persist: true }
  ): Promise<ResearchResponse> {
    const startTime = performance.now();
    const sessionId = randomUUID();
    const searchMode = request.searchMode || 'HYBRID';

    // 0. Check Semantic Cache (Exact L1 + Semantic L2)
    if (!request.skipCache && !preRetrievedResults) {
      const cacheMatch = await this.semanticCache.findMatch<ResearchResponse>({
        cacheType: 'RESEARCH',
        query: request.query,
        searchMode,
      });

      if (cacheMatch.matched && cacheMatch.payload) {
        const latencyMs = Math.round(performance.now() - startTime);
        const cachedResponse: ResearchResponse = {
          ...cacheMatch.payload,
          id: sessionId,
          sessionId,
          query: request.query,
          latencyMs,
          cached: true,
          cacheType: cacheMatch.matchStrategy,
          cacheSimilarity: cacheMatch.similarity,
          createdAt: new Date().toISOString(),
        };

        if (options.persist) {
          await this.persistSession(cachedResponse, request.userId);
        }

        researchRequestsTotal.inc({ mode: searchMode, status: 'success' });
        researchDurationSeconds.observe({ mode: searchMode }, latencyMs / 1000);
        researchCitationsPerSession.observe(cachedResponse.citations?.length || 0);

        return cachedResponse;
      }
    }

    // 1. Fetch retrieval results if not supplied directly
    let candidateResults: SearchResultItem[] = preRetrievedResults || [];
    if (!preRetrievedResults && this.searchService) {
      const searchRes = await this.searchService.search({
        query: request.query,
        mode: searchMode,
        limit: request.maxSources || 8,
        page: 1,
        disableLogging: true, // Do not pollute search suggestions/analytics with background research calls
      });
      candidateResults = searchRes.results;
    }

    // 2. Assemble context defensively
    const assembled: AssembledContext = this.assembler.assemble(
      request.query,
      candidateResults,
      { maxSources: request.maxSources }
    );

    // 3. Handle insufficient context safely
    if (assembled.insufficientContext) {
      const latencyMs = Math.round(performance.now() - startTime);
      const insufficientResponse: ResearchResponse = {
        id: sessionId,
        sessionId,
        query: request.query,
        answer: 'I do not have sufficient information in the indexed sources to answer this question.',
        citations: [],
        sources: [],
        searchMode,
        latencyMs,
        insufficientContext: true,
        insufficientReason: assembled.insufficientReason,
        createdAt: new Date().toISOString(),
      };

      if (options.persist) {
        await this.persistSession(insufficientResponse, request.userId);
      }

      researchRequestsTotal.inc({ mode: searchMode, status: 'success' });
      researchDurationSeconds.observe({ mode: searchMode }, latencyMs / 1000);
      researchCitationsPerSession.observe(0);

      return insufficientResponse;
    }

    // 4. Construct LLM prompt
    const userPrompt = this.buildUserPrompt(request.query, assembled.formattedContext);

    // 5. Invoke LLM provider
    const llmStartTime = performance.now();
    const llmResponse = await this.llmProvider.generate({
      prompt: userPrompt,
      systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
      options: {
        temperature: request.temperature ?? 0.2,
      },
    });
    llmGenerationDurationSeconds.observe(
      { provider: this.llmProvider.name || 'gemini', model: 'default' },
      (performance.now() - llmStartTime) / 1000
    );

    // 6. Extract and verify inline citations
    const verificationResult = this.citationPostProcessor.process(llmResponse.content, assembled.sources);
    const latencyMs = Math.round(performance.now() - startTime);

    const response: ResearchResponse = {
      id: sessionId,
      sessionId,
      query: request.query,
      answer: llmResponse.content.trim(),
      citations: verificationResult.citations,
      sources: assembled.sources,
      searchMode,
      latencyMs,
      insufficientContext: false,
      usage: llmResponse.usage,
      createdAt: new Date().toISOString(),
    };

    // 7. Persist research session
    if (options.persist) {
      await this.persistSession(response, request.userId);
    }

    // 8. Store in Semantic Cache asynchronously
    if (!request.skipCache && !assembled.insufficientContext) {
      this.semanticCache
        .store({
          cacheType: 'RESEARCH',
          query: request.query,
          searchMode,
          payload: response,
        })
        .catch(() => {});
    }

    researchRequestsTotal.inc({ mode: searchMode, status: 'success' });
    researchDurationSeconds.observe({ mode: searchMode }, latencyMs / 1000);
    researchCitationsPerSession.observe(response.citations.length);

    if (response.usage) {
      const provider = this.llmProvider.name || 'gemini';
      if (response.usage.promptTokens) {
        researchTokensTotal.inc({ token_type: 'prompt', provider, model: 'default' }, response.usage.promptTokens);
      }
      if (response.usage.completionTokens) {
        researchTokensTotal.inc({ token_type: 'completion', provider, model: 'default' }, response.usage.completionTokens);
      }
      if (response.usage.totalTokens) {
        researchTokensTotal.inc({ token_type: 'total', provider, model: 'default' }, response.usage.totalTokens);
      }
    }

    return response;
  }

  /**
   * Conducts research with real-time token streaming via Server-Sent Events (SSE).
   */
  async researchStream(
    request: ResearchRequest,
    callbacks: ResearchStreamCallbacks,
    signal?: AbortSignal,
    preRetrievedResults?: SearchResultItem[]
  ): Promise<ResearchResponse> {
    const startTime = performance.now();
    const sessionId = randomUUID();
    const searchMode = request.searchMode || 'HYBRID';
    researchStreamingRequestsTotal.inc();

    // 0. Check Semantic Cache (Exact L1 + Semantic L2)
    if (!request.skipCache && !preRetrievedResults) {
      const cacheMatch = await this.semanticCache.findMatch<ResearchResponse>({
        cacheType: 'RESEARCH',
        query: request.query,
        searchMode,
      });

      if (cacheMatch.matched && cacheMatch.payload) {
        const cached = cacheMatch.payload;
        const latencyMs = Math.round(performance.now() - startTime);

        if (callbacks.onSources) {
          await callbacks.onSources(cached.sources || []);
        }

        if (callbacks.onToken && cached.answer) {
          const words = cached.answer.split(' ');
          for (let i = 0; i < words.length; i++) {
            if (signal?.aborted) return cached;
            const token = i === 0 ? words[i] : ' ' + words[i];
            await callbacks.onToken(token);
          }
        }

        if (callbacks.onCitations) {
          await callbacks.onCitations(cached.citations || []);
        }

        const cachedResponse: ResearchResponse = {
          ...cached,
          id: sessionId,
          sessionId,
          query: request.query,
          latencyMs,
          cached: true,
          cacheType: cacheMatch.matchStrategy,
          cacheSimilarity: cacheMatch.similarity,
          createdAt: new Date().toISOString(),
        };

        await this.persistSession(cachedResponse, request.userId);

        if (callbacks.onComplete) {
          await callbacks.onComplete(cachedResponse);
        }

        return cachedResponse;
      }
    }

    // 1. Fetch retrieval results if not supplied directly
    let candidateResults: SearchResultItem[] = preRetrievedResults || [];
    if (!preRetrievedResults && this.searchService) {
      const searchRes = await this.searchService.search({
        query: request.query,
        mode: searchMode,
        limit: request.maxSources || 8,
        page: 1,
        disableLogging: true,
      });
      candidateResults = searchRes.results;
    }

    // 2. Assemble context defensively
    const assembled: AssembledContext = this.assembler.assemble(
      request.query,
      candidateResults,
      { maxSources: request.maxSources }
    );

    // 3. Handle insufficient context safely
    if (assembled.insufficientContext) {
      const latencyMs = Math.round(performance.now() - startTime);
      const insufficientResponse: ResearchResponse = {
        id: sessionId,
        sessionId,
        query: request.query,
        answer: 'I do not have sufficient information in the indexed sources to answer this question.',
        citations: [],
        sources: [],
        searchMode,
        latencyMs,
        insufficientContext: true,
        insufficientReason: assembled.insufficientReason,
        createdAt: new Date().toISOString(),
      };

      if (callbacks.onSources) await callbacks.onSources([]);
      if (callbacks.onToken) await callbacks.onToken(insufficientResponse.answer);
      if (callbacks.onCitations) await callbacks.onCitations([]);
      if (callbacks.onComplete) await callbacks.onComplete(insufficientResponse);

      await this.persistSession(insufficientResponse, request.userId);
      return insufficientResponse;
    }

    // 4. Send source information upfront
    if (callbacks.onSources) {
      await callbacks.onSources(assembled.sources);
    }

    // 5. Construct LLM prompt
    const userPrompt = this.buildUserPrompt(request.query, assembled.formattedContext);

    // 6. Stream tokens from LLM provider
    let accumulatedText = '';
    const llmRequest = {
      prompt: userPrompt,
      systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
      options: {
        temperature: request.temperature ?? 0.2,
      },
    };

    let llmResponse;
    if (typeof this.llmProvider.generateStream === 'function') {
      llmResponse = await this.llmProvider.generateStream(
        llmRequest,
        async (chunk) => {
          accumulatedText += chunk.token;
          if (callbacks.onToken) {
            await callbacks.onToken(chunk.token);
          }
        },
        signal
      );
    } else {
      // Fallback if provider doesn't support streaming
      llmResponse = await this.llmProvider.generate(llmRequest);
      accumulatedText = llmResponse.content;
      if (callbacks.onToken) {
        await callbacks.onToken(accumulatedText);
      }
    }

    // 7. Verify citations on final text
    const verificationResult = this.citationPostProcessor.process(accumulatedText, assembled.sources);
    if (callbacks.onCitations) {
      await callbacks.onCitations(verificationResult.citations);
    }

    const latencyMs = Math.round(performance.now() - startTime);
    const finalResponse: ResearchResponse = {
      id: sessionId,
      query: request.query,
      answer: accumulatedText.trim(),
      citations: verificationResult.citations,
      sources: assembled.sources,
      searchMode,
      latencyMs,
      insufficientContext: false,
      usage: llmResponse.usage,
      createdAt: new Date().toISOString(),
    };

    // 8. Persist completed research session
    await this.persistSession(finalResponse, request.userId);

    // 9. Emit complete event
    if (callbacks.onComplete) {
      await callbacks.onComplete(finalResponse);
    }

    // 10. Store in Semantic Cache asynchronously
    if (!request.skipCache && !assembled.insufficientContext && accumulatedText.trim().length > 0) {
      this.semanticCache
        .store({
          cacheType: 'RESEARCH',
          query: request.query,
          searchMode,
          payload: finalResponse,
        })
        .catch(() => {});
    }

    researchStreamingOutcomesTotal.inc({ outcome: 'completed' });
    return finalResponse;
  }

  /**
   * Helper to extract citations from answer text using CitationPostProcessor.
   */
  public extractCitations(answer: string, assembled: AssembledContext): VerifiedCitation[] {
    return this.citationPostProcessor.process(answer, assembled.sources).citations;
  }

  /**
   * Helper to persist research session to PostgreSQL.
   */
  private async persistSession(response: ResearchResponse, userId?: string) {
    try {
      await this.researchRepository.createSession({
        id: response.id,
        userId: userId || null,
        query: response.query,
        answer: response.answer,
        searchMode: response.searchMode,
        citations: response.citations,
        sources: response.sources,
        latencyMs: response.latencyMs,
      });
    } catch (err) {
      console.error('[ResearchService] Failed to persist research session:', err);
    }
  }

  private buildUserPrompt(query: string, formattedContext: string): string {
    return [
      formattedContext,
      '',
      `RESEARCH QUESTION: ${query}`,
      '',
      'INSTRUCTIONS:',
      'Synthesize an accurate, factual answer based strictly on the sources above.',
      'Cite sources inline using bracketed numbers like [1] or [2] immediately following each statement.',
      'Do not include information that cannot be directly attributed to one of the numbered sources.',
    ].join('\n');
  }
}
