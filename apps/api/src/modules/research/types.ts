import { SearchMode } from '@seekr/types';
import { LlmUsageMetadata } from '@seekr/shared';
import { VerifiedCitation } from './citation-post-processor.js';

export interface AssembledSource {
  citationId: string; // e.g. "[1]"
  citationIndex: number; // 1-based index
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  title: string;
  url: string;
  sourceType: string;
  score: number;
  rank: number;
  content: string;
  tokenCount: number;
  truncated: boolean;
  suspicious: boolean;
  suspiciousPatterns?: string[];
}

export interface TokenBudgetSummary {
  maxContextTokens: number;
  reservedResponseTokens: number;
  systemTokens: number;
  queryTokens: number;
  availableContextTokens: number;
  usedContextTokens: number;
  remainingTokens: number;
}

export interface AssembledContext {
  formattedContext: string;
  sources: AssembledSource[];
  tokenBudget: TokenBudgetSummary;
  insufficientContext: boolean;
  insufficientReason?: string;
  totalCandidateCount: number;
  includedSourceCount: number;
}

export interface ContextAssemblerOptions {
  maxContextTokens?: number; // Total model context limit (default 4096)
  reservedResponseTokens?: number; // Space reserved for LLM generation (default 1024)
  safetyMarginTokens?: number; // Headroom buffer (default 100)
  maxSources?: number; // Max sources to include (default 8)
  minRelevanceScore?: number; // Minimum relevance score to qualify (default 0.001)
  maxChunkTokens?: number; // Truncation threshold for individual chunks (default 600)
}

export interface CitationReference {
  citationId: string;
  citationIndex: number;
  chunkId: string;
  documentId: string;
  title: string;
  url: string;
  sourceType: string;
  score: number;
}

export interface ResearchRequest {
  query: string;
  searchMode?: SearchMode;
  maxSources?: number;
  temperature?: number;
  userId?: string;
}

export interface ResearchResponse {
  id?: string;
  sessionId?: string;
  query: string;
  answer: string;
  citations: VerifiedCitation[];
  sources: AssembledSource[];
  searchMode: SearchMode;
  latencyMs: number;
  insufficientContext: boolean;
  insufficientReason?: string;
  usage?: LlmUsageMetadata;
  createdAt?: string;
}

export interface DetailedSourceDTO {
  citationId: string;
  citationIndex: number;
  chunkId: string;
  documentId: string;
  title: string;
  url: string;
  sourceType: string;
  score: number;
  rank: number;
  content: string;
  tokenCount: number;
  truncated: boolean;
  suspicious: boolean;
  citationReferences?: VerifiedCitation[];
}
