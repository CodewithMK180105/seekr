import { SearchProviderCandidate } from './providers/provider.interface.js';
import { queryUnderstandingService, ParsedQuery } from '../search/services/query-understanding.service.js';

export interface CandidateValidationResult {
  valid: boolean;
  score: number;
  reason?: string;
  matchedTokens: string[];
  signals?: {
    titleRelevance: number;
    snippetRelevance: number;
    entityMatch: number;
    providerRankScore: number;
    semanticQuality: number;
  };
}

export class CandidateValidatorService {
  private minThreshold: number;

  constructor(minThreshold = 0.28) {
    this.minThreshold = minThreshold;
  }

  /**
   * Set minimum threshold at runtime for tuning / calibration.
   */
  setMinThreshold(threshold: number): void {
    this.minThreshold = Math.max(0, Math.min(1, threshold));
  }

  getMinThreshold(): number {
    return this.minThreshold;
  }

  /**
   * Tokenizes and filters meaningful query keywords.
   */
  extractKeywords(text: string): string[] {
    return queryUnderstandingService.extractKeywords(text);
  }

  /**
   * Validates whether a discovered candidate URL is sufficiently relevant to the user query
   * to justify crawling and potential ingestion.
   */
  validateCandidate(
    candidate: SearchProviderCandidate,
    query: string,
    parsedQueryOverride?: ParsedQuery
  ): CandidateValidationResult {
    // Direct URL provider is inherently targeted
    if (candidate.provider === 'direct') {
      return { valid: true, score: 1.0, matchedTokens: [] };
    }

    // 1. Guard against empty metadata or search redirect wrappers
    if (!candidate.url || !candidate.title) {
      return {
        valid: false,
        score: 0,
        reason: 'REJECT_EMPTY_METADATA',
        matchedTokens: [],
      };
    }

    const lowerUrl = candidate.url.toLowerCase();
    if (lowerUrl.includes('google.com/url') || lowerUrl.includes('duckduckgo.com/l/')) {
      return {
        valid: false,
        score: 0,
        reason: 'REJECT_SEARCH_REDIRECT',
        matchedTokens: [],
      };
    }

    const parsed = parsedQueryOverride || queryUnderstandingService.parseQuery(query);
    const title = (candidate.title || '').toLowerCase();
    const snippet = (candidate.snippet || '').toLowerCase();
    const queryKeywords = parsed.coreKeywords;
    const entityCandidate = parsed.entityCandidate?.toLowerCase();

    // 2. Exact or Primary Entity Matching (e.g. "Paris", "Virat Kohli", "BullMQ")
    let entityMatchScore = 0;
    if (entityCandidate && entityCandidate.length >= 2) {
      const entityEncoded = encodeURIComponent(entityCandidate.replace(/\s+/g, '_')).toLowerCase();
      const inTitle = title.includes(entityCandidate);
      const inUrl = lowerUrl.includes(entityCandidate) || lowerUrl.includes(entityEncoded);

      if (inTitle && inUrl) {
        entityMatchScore = 1.0;
      } else if (inTitle) {
        entityMatchScore = 0.85;
      } else if (inUrl) {
        entityMatchScore = 0.70;
      } else if (snippet.includes(entityCandidate)) {
        entityMatchScore = 0.50;
      }

      // Strong entity match on title or URL immediately validates with high confidence
      if (entityMatchScore >= 0.70) {
        return {
          valid: true,
          score: Math.max(0.85, entityMatchScore),
          matchedTokens: [entityCandidate],
          signals: {
            titleRelevance: inTitle ? 1.0 : 0.5,
            snippetRelevance: snippet.includes(entityCandidate) ? 0.8 : 0.2,
            entityMatch: entityMatchScore,
            providerRankScore: Math.max(0.1, 1 - (candidate.rank - 1) * 0.15),
            semanticQuality: 0.9,
          },
        };
      }
    }

    // 3. Multi-Signal Token Matching
    const matchedTokens: string[] = [];
    let titleMatches = 0;
    let snippetMatches = 0;
    let urlMatches = 0;

    for (const kw of queryKeywords) {
      const inTitle = title.includes(kw);
      const inSnippet = snippet.includes(kw);
      const inUrl = lowerUrl.includes(kw);

      if (inTitle || inSnippet || inUrl) {
        matchedTokens.push(kw);
      }
      if (inTitle) titleMatches++;
      if (inSnippet) snippetMatches++;
      if (inUrl) urlMatches++;
    }

    const totalKw = Math.max(1, queryKeywords.length);
    const titleRatio = titleMatches / totalKw;
    const snippetRatio = snippetMatches / totalKw;
    const urlRatio = urlMatches / totalKw;

    // Provider Rank Signal (decaying with rank position: rank 1 = 1.0, rank 2 = 0.85, etc.)
    const providerRankScore = Math.max(0.1, 1 - (candidate.rank - 1) * 0.15);

    // Semantic Quality heuristic based on snippet substance and title structure
    let semanticQuality = 0.5;
    if (snippet.length >= 80) semanticQuality += 0.2;
    if (title.length >= 10 && title.length <= 120) semanticQuality += 0.2;
    if (title.includes('documentation') || title.includes('guide') || title.includes('wiki') || title.includes('docs')) {
      semanticQuality += 0.1;
    }
    semanticQuality = Math.min(1.0, semanticQuality);

    // 4. Query-Type-Aware Weight Calibration
    let titleWeight = 0.40;
    let snippetWeight = 0.30;
    let entityWeight = 0.15;
    let providerWeight = 0.10;
    let qualityWeight = 0.05;

    if (parsed.category === 'FACTUAL' || parsed.category === 'AMBIGUOUS_SHORT') {
      titleWeight = 0.45;
      entityWeight = 0.25;
      snippetWeight = 0.20;
    } else if (parsed.category === 'CONCEPTUAL' || parsed.category === 'TROUBLESHOOTING') {
      snippetWeight = 0.40;
      titleWeight = 0.30;
      qualityWeight = 0.10;
    } else if (parsed.category === 'COMPARISON') {
      titleWeight = 0.35;
      snippetWeight = 0.35;
      entityWeight = 0.15;
    }

    const compositeScore =
      titleRatio * titleWeight +
      snippetRatio * snippetWeight +
      entityMatchScore * entityWeight +
      providerRankScore * providerWeight +
      semanticQuality * qualityWeight;

    // 5. Zero Token Overlap Evaluation (Relaxed for Semantic/Conceptual Queries)
    if (matchedTokens.length === 0 && entityMatchScore === 0) {
      // For conceptual or troubleshooting queries, if provider ranked it #1 and snippet is high quality,
      // allow with marginal score rather than hard rejection
      if (
        (parsed.category === 'CONCEPTUAL' || parsed.category === 'TROUBLESHOOTING') &&
        candidate.rank === 1 &&
        snippet.length >= 100
      ) {
        const relaxedScore = 0.32;
        if (relaxedScore >= this.minThreshold) {
          return {
            valid: true,
            score: relaxedScore,
            reason: 'ACCEPTED_SEMANTIC_CONCEPT_OVERLAP',
            matchedTokens: [],
            signals: {
              titleRelevance: 0,
              snippetRelevance: 0.3,
              entityMatch: 0,
              providerRankScore,
              semanticQuality,
            },
          };
        }
      }

      return {
        valid: false,
        score: 0,
        reason: 'REJECT_ZERO_TOKEN_OVERLAP: No query terms or entity matched candidate title, snippet, or URL',
        matchedTokens: [],
      };
    }

    // 6. Threshold Check
    if (compositeScore < this.minThreshold && titleMatches === 0 && entityMatchScore < 0.5) {
      return {
        valid: false,
        score: compositeScore,
        reason: `REJECT_LOW_RELEVANCE: Composite score ${compositeScore.toFixed(2)} is below minimum threshold ${this.minThreshold}`,
        matchedTokens,
      };
    }

    return {
      valid: true,
      score: Math.max(0.30, Math.min(1.0, compositeScore)),
      matchedTokens,
      signals: {
        titleRelevance: titleRatio,
        snippetRelevance: snippetRatio,
        entityMatch: entityMatchScore,
        providerRankScore,
        semanticQuality,
      },
    };
  }
}

export const candidateValidatorService = new CandidateValidatorService();
