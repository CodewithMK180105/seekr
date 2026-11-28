import { SearchResultItem } from '@seekr/types';
import { ParsedQuery } from './query-understanding.service.js';

export type SufficiencyAction =
  | 'SUFFICIENT_RETURN_LOCAL'
  | 'TRIGGER_WEB_DISCOVERY'
  | 'RETURN_PARTIAL_RESULTS'
  | 'REJECT_GIBBERISH';

export interface SufficiencyEvaluation {
  action: SufficiencyAction;
  reason: string;
  uniqueCount: number;
  topScore: number;
  averageScore: number;
  isDiverse: boolean;
  targetDiscoveryCount: number;
}

export interface SufficiencyPolicyOptions {
  /** Minimum desired unique documents before considering search sufficient. Default: 3 */
  minSufficientResults?: number;
  /** Score threshold above which a result is considered high confidence. Default: 0.75 */
  highConfidenceThreshold?: number;
  /** Minimum score floor below which results are considered marginal. Default: 0.55 */
  marginalScoreFloor?: number;
  /** Maximum pages to dynamically crawl when discovery is triggered. Default: 3 */
  maxDiscoveryPages?: number;
}

export class SearchSufficiencyService {
  private minSufficientResults: number;
  private highConfidenceThreshold: number;
  private marginalScoreFloor: number;
  private maxDiscoveryPages: number;

  constructor(options: SufficiencyPolicyOptions = {}) {
    this.minSufficientResults = options.minSufficientResults ?? 3;
    this.highConfidenceThreshold = options.highConfidenceThreshold ?? 0.75;
    this.marginalScoreFloor = options.marginalScoreFloor ?? 0.55;
    this.maxDiscoveryPages = options.maxDiscoveryPages ?? 3;
  }

  /**
   * Evaluates whether retrieved results are sufficient to satisfy the user's information need,
   * or whether additional on-demand web discovery is warranted.
   */
  evaluateSufficiency(
    results: SearchResultItem[],
    parsedQuery: ParsedQuery,
    isScopedSearch = false
  ): SufficiencyEvaluation {
    // 1. Scoped search (e.g. filtered to a specific source UUID) should not trigger external discovery
    if (isScopedSearch) {
      return {
        action: 'SUFFICIENT_RETURN_LOCAL',
        reason: 'Scoped search constraint active (source-specific filter)',
        uniqueCount: results.length,
        topScore: results[0]?.score || 0,
        averageScore: this.computeAverageScore(results),
        isDiverse: true,
        targetDiscoveryCount: 0,
      };
    }

    // 2. Gibberish queries must never trigger external web discovery
    if (parsedQuery.isGibberish) {
      return {
        action: 'REJECT_GIBBERISH',
        reason: 'Query classified as gibberish / keyboard-mash',
        uniqueCount: 0,
        topScore: 0,
        averageScore: 0,
        isDiverse: false,
        targetDiscoveryCount: 0,
      };
    }

    // 3. Zero local results: immediate discovery requirement
    if (results.length === 0) {
      return {
        action: 'TRIGGER_WEB_DISCOVERY',
        reason: 'Zero local matching results in technical library',
        uniqueCount: 0,
        topScore: 0,
        averageScore: 0,
        isDiverse: false,
        targetDiscoveryCount: this.maxDiscoveryPages,
      };
    }

    const uniqueCount = results.length;
    const topScore = Number(results[0].score) || 0;
    const avgScore = this.computeAverageScore(results);

    // Check domain diversity across top results
    const domains = new Set<string>();
    for (const r of results) {
      try {
        domains.add(new URL(r.url).hostname.replace(/^www\./, ''));
      } catch {}
    }
    const isDiverse = domains.size >= Math.min(2, uniqueCount);

    // 4. Sufficient condition:
    // If we have >= minSufficientResults AND top score is high confidence, local index is sufficient!
    if (uniqueCount >= this.minSufficientResults && topScore >= this.highConfidenceThreshold) {
      return {
        action: 'SUFFICIENT_RETURN_LOCAL',
        reason: `Local index satisfies sufficiency (${uniqueCount} documents, top score: ${topScore.toFixed(2)})`,
        uniqueCount,
        topScore,
        averageScore: avgScore,
        isDiverse,
        targetDiscoveryCount: 0,
      };
    }

    // 5. Special Factual Entity check:
    // For direct factual or biographical queries ("Who is Virat Kohli?"), 1 highly confident
    // authoritative document (score >= 0.85) is fully sufficient.
    if (parsedQuery.category === 'FACTUAL' && topScore >= 0.85 && uniqueCount >= 1) {
      return {
        action: 'SUFFICIENT_RETURN_LOCAL',
        reason: `High confidence factual match satisfied (${results[0].title})`,
        uniqueCount,
        topScore,
        averageScore: avgScore,
        isDiverse: true,
        targetDiscoveryCount: 0,
      };
    }

    // 6. Insufficient condition for Comparative / Troubleshooting / Conceptual queries:
    // If count < minSufficientResults OR top score is marginal, trigger discovery to augment
    if (
      parsedQuery.category === 'COMPARISON' ||
      parsedQuery.category === 'TROUBLESHOOTING' ||
      parsedQuery.category === 'CONCEPTUAL'
    ) {
      if (uniqueCount < this.minSufficientResults || topScore < this.highConfidenceThreshold) {
        const needed = Math.min(this.maxDiscoveryPages, this.minSufficientResults - uniqueCount + 1);
        return {
          action: 'TRIGGER_WEB_DISCOVERY',
          reason: `Insufficient multi-source coverage for ${parsedQuery.category} query (${uniqueCount} local docs, need >= ${this.minSufficientResults})`,
          uniqueCount,
          topScore,
          averageScore: avgScore,
          isDiverse,
          targetDiscoveryCount: Math.max(1, needed),
        };
      }
    }

    // 7. Marginal score check
    if (topScore < this.marginalScoreFloor && uniqueCount < this.minSufficientResults) {
      return {
        action: 'TRIGGER_WEB_DISCOVERY',
        reason: `Local results are marginal (top score ${topScore.toFixed(2)} < ${this.marginalScoreFloor})`,
        uniqueCount,
        topScore,
        averageScore: avgScore,
        isDiverse,
        targetDiscoveryCount: 2,
      };
    }

    // Default: Accept local results
    return {
      action: 'SUFFICIENT_RETURN_LOCAL',
      reason: `Acceptable local relevance (${uniqueCount} documents)`,
      uniqueCount,
      topScore,
      averageScore: avgScore,
      isDiverse,
      targetDiscoveryCount: 0,
    };
  }

  private computeAverageScore(results: SearchResultItem[]): number {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, r) => acc + (Number(r.score) || 0), 0);
    return sum / results.length;
  }
}

export const searchSufficiencyService = new SearchSufficiencyService();
