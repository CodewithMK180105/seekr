import { BenchmarkGroundTruthItem } from './types.js';

export function buildGroundTruthMap(
  relevantChunks: BenchmarkGroundTruthItem[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of relevantChunks) {
    map.set(item.chunkId, item.relevance);
  }
  return map;
}

/**
 * Precision@K
 * Proportion of top-K retrieved results that are relevant (relevance >= threshold).
 * Denominator is strictly K.
 */
export function precisionAtK(
  retrievedChunkIds: string[],
  groundTruth: Map<string, number> | BenchmarkGroundTruthItem[],
  k: number = 10,
  threshold: number = 2
): number {
  if (k <= 0) return 0;

  const gtMap = Array.isArray(groundTruth) ? buildGroundTruthMap(groundTruth) : groundTruth;
  const topK = retrievedChunkIds.slice(0, k);

  let relevantRetrieved = 0;
  for (const id of topK) {
    const rel = gtMap.get(id) ?? 0;
    if (rel >= threshold) {
      relevantRetrieved++;
    }
  }

  return Number((relevantRetrieved / k).toFixed(4));
}

/**
 * Recall@K
 * Proportion of all known relevant ground-truth items (relevance >= threshold)
 * retrieved in top-K results.
 */
export function recallAtK(
  retrievedChunkIds: string[],
  groundTruth: Map<string, number> | BenchmarkGroundTruthItem[],
  k: number = 10,
  threshold: number = 2
): number {
  const gtMap = Array.isArray(groundTruth) ? buildGroundTruthMap(groundTruth) : groundTruth;

  let totalRelevant = 0;
  for (const rel of gtMap.values()) {
    if (rel >= threshold) {
      totalRelevant++;
    }
  }

  if (totalRelevant === 0) return 0;

  const topK = retrievedChunkIds.slice(0, k);
  let relevantRetrieved = 0;
  for (const id of topK) {
    const rel = gtMap.get(id) ?? 0;
    if (rel >= threshold) {
      relevantRetrieved++;
    }
  }

  return Number((relevantRetrieved / totalRelevant).toFixed(4));
}

/**
 * Reciprocal Rank (RR)
 * RR = 1 / rank of the first relevant result (1-indexed).
 * Returns 0 if no relevant result is retrieved.
 */
export function reciprocalRank(
  retrievedChunkIds: string[],
  groundTruth: Map<string, number> | BenchmarkGroundTruthItem[],
  threshold: number = 2
): number {
  const gtMap = Array.isArray(groundTruth) ? buildGroundTruthMap(groundTruth) : groundTruth;

  for (let i = 0; i < retrievedChunkIds.length; i++) {
    const rel = gtMap.get(retrievedChunkIds[i]) ?? 0;
    if (rel >= threshold) {
      return Number((1 / (i + 1)).toFixed(4));
    }
  }

  return 0;
}

/**
 * Discounted Cumulative Gain at K (DCG@K)
 * DCG = SUM_i ((2^rel_i - 1) / log2(i + 1))
 */
export function dcgAtK(
  retrievedChunkIds: string[],
  groundTruth: Map<string, number> | BenchmarkGroundTruthItem[],
  k: number = 10
): number {
  if (k <= 0) return 0;
  const gtMap = Array.isArray(groundTruth) ? buildGroundTruthMap(groundTruth) : groundTruth;
  const topK = retrievedChunkIds.slice(0, k);

  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const rel = gtMap.get(topK[i]) ?? 0;
    if (rel > 0) {
      const numerator = Math.pow(2, rel) - 1;
      const denominator = Math.log2(i + 2); // (i + 1) in 1-based indexing -> i + 2
      dcg += numerator / denominator;
    }
  }

  return dcg;
}

/**
 * Normalized Discounted Cumulative Gain at K (nDCG@K)
 * Evaluates graded relevance ranking against the ideal ranking (IDCG@K).
 * Uses exponential gain formulation (2^rel - 1).
 */
export function ndcgAtK(
  retrievedChunkIds: string[],
  groundTruth: Map<string, number> | BenchmarkGroundTruthItem[],
  k: number = 10
): number {
  if (k <= 0) return 0;
  const gtMap = Array.isArray(groundTruth) ? buildGroundTruthMap(groundTruth) : groundTruth;

  // Extract all positive ground-truth relevance grades and sort descending
  const idealGrades: number[] = [];
  for (const rel of gtMap.values()) {
    if (rel > 0) {
      idealGrades.push(rel);
    }
  }
  idealGrades.sort((a, b) => b - a);

  // Calculate IDCG@K
  let idcg = 0;
  const idealTopK = idealGrades.slice(0, k);
  for (let i = 0; i < idealTopK.length; i++) {
    const numerator = Math.pow(2, idealTopK[i]) - 1;
    const denominator = Math.log2(i + 2);
    idcg += numerator / denominator;
  }

  if (idcg === 0) return 0;

  const actualDcg = dcgAtK(retrievedChunkIds, gtMap, k);
  return Number((actualDcg / idcg).toFixed(4));
}
