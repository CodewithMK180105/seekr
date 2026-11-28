import { SearchService } from '../services/search.service.js';

export interface BenchmarkQueryCase {
  id: string;
  query: string;
  category:
    | 'PEOPLE'
    | 'CITIES'
    | 'HISTORY'
    | 'SCIENCE'
    | 'TECHNOLOGY'
    | 'PROGRAMMING'
    | 'CONCEPT'
    | 'COMPARISON'
    | 'TROUBLESHOOTING'
    | 'CURRENT'
    | 'SHORT'
    | 'AMBIGUOUS'
    | 'CONVERSATIONAL'
    | 'OUT_OF_CORPUS'
    | 'GIBBERISH';
  expectedResult: 'MATCH' | 'ZERO_RESULTS';
  targetTopic: string;
  expectedKeywords: string[];
}

export const MILESTONE9_CASES: BenchmarkQueryCase[] = [
  // 1. People and Public Figures
  { id: 'Q01', query: 'Who is Virat Kohli?', category: 'PEOPLE', expectedResult: 'MATCH', targetTopic: 'Virat Kohli', expectedKeywords: ['virat', 'kohli'] },
  { id: 'Q02', query: 'Alan Turing biography and contributions', category: 'PEOPLE', expectedResult: 'MATCH', targetTopic: 'Alan Turing', expectedKeywords: ['alan', 'turing'] },
  { id: 'Q03', query: 'Ada Lovelace first computer programmer', category: 'PEOPLE', expectedResult: 'MATCH', targetTopic: 'Ada Lovelace', expectedKeywords: ['ada', 'lovelace'] },
  { id: 'Q04', query: 'Guido van Rossum creator of Python', category: 'PEOPLE', expectedResult: 'MATCH', targetTopic: 'Guido van Rossum', expectedKeywords: ['guido', 'rossum', 'python'] },

  // 2. Cities and Locations
  { id: 'Q05', query: 'Give me details about Paris', category: 'CITIES', expectedResult: 'MATCH', targetTopic: 'Paris', expectedKeywords: ['paris', 'france'] },
  { id: 'Q06', query: 'Tokyo public transit and metro system', category: 'CITIES', expectedResult: 'MATCH', targetTopic: 'Tokyo', expectedKeywords: ['tokyo', 'transit'] },
  { id: 'Q07', query: 'San Francisco Bay Area geography', category: 'CITIES', expectedResult: 'MATCH', targetTopic: 'San Francisco', expectedKeywords: ['san', 'francisco'] },
  { id: 'Q08', query: 'Ancient history of Cairo Egypt', category: 'CITIES', expectedResult: 'MATCH', targetTopic: 'Cairo', expectedKeywords: ['cairo', 'egypt'] },

  // 3. History
  { id: 'Q09', query: 'Industrial revolution technological impact', category: 'HISTORY', expectedResult: 'MATCH', targetTopic: 'Industrial Revolution', expectedKeywords: ['industrial', 'revolution'] },
  { id: 'Q10', query: 'Roman aqueducts engineering and construction', category: 'HISTORY', expectedResult: 'MATCH', targetTopic: 'Roman aqueduct', expectedKeywords: ['roman', 'aqueduct'] },
  { id: 'Q11', query: 'History of the global Internet and ARPANET', category: 'HISTORY', expectedResult: 'MATCH', targetTopic: 'Internet', expectedKeywords: ['internet', 'arpanet'] },
  { id: 'Q12', query: 'Apollo 11 mission and first moon landing', category: 'HISTORY', expectedResult: 'MATCH', targetTopic: 'Apollo 11', expectedKeywords: ['apollo', 'moon'] },

  // 4. Science
  { id: 'Q13', query: 'How do supermassive black holes form?', category: 'SCIENCE', expectedResult: 'MATCH', targetTopic: 'Black hole', expectedKeywords: ['black', 'hole'] },
  { id: 'Q14', query: 'CRISPR Cas9 gene editing mechanism', category: 'SCIENCE', expectedResult: 'MATCH', targetTopic: 'CRISPR', expectedKeywords: ['crispr', 'gene'] },
  { id: 'Q15', query: 'Einstein theory of general relativity principles', category: 'SCIENCE', expectedResult: 'MATCH', targetTopic: 'General relativity', expectedKeywords: ['relativity', 'einstein'] },
  { id: 'Q16', query: 'Photosynthesis light-dependent reactions', category: 'SCIENCE', expectedResult: 'MATCH', targetTopic: 'Photosynthesis', expectedKeywords: ['photosynthesis', 'chlorophyll'] },

  // 5. Technology (Core Infrastructure)
  { id: 'Q17', query: 'Redis persistence and data recovery', category: 'TECHNOLOGY', expectedResult: 'MATCH', targetTopic: 'Redis persistence', expectedKeywords: ['redis', 'persistence'] },
  { id: 'Q18', query: 'How does PostgreSQL indexing work?', category: 'TECHNOLOGY', expectedResult: 'MATCH', targetTopic: 'Indexes', expectedKeywords: ['postgresql', 'index'] },
  { id: 'Q19', query: 'Docker bridge network driver configuration', category: 'TECHNOLOGY', expectedResult: 'MATCH', targetTopic: 'Bridge network driver', expectedKeywords: ['docker', 'bridge', 'network'] },
  { id: 'Q20', query: 'Kubernetes pod lifecycle and eviction', category: 'TECHNOLOGY', expectedResult: 'MATCH', targetTopic: 'Deployments', expectedKeywords: ['kubernetes', 'deployment', 'pod'] },

  // 6. Programming Languages & Paradigms
  { id: 'Q21', query: 'Python asyncio event loop architecture', category: 'PROGRAMMING', expectedResult: 'MATCH', targetTopic: 'Asyncio', expectedKeywords: ['python', 'asyncio'] },
  { id: 'Q22', query: 'TypeScript discriminated union pattern', category: 'PROGRAMMING', expectedResult: 'MATCH', targetTopic: 'TypeScript', expectedKeywords: ['typescript', 'union'] },
  { id: 'Q23', query: 'Rust ownership and borrowing rules', category: 'PROGRAMMING', expectedResult: 'MATCH', targetTopic: 'Rust', expectedKeywords: ['rust', 'ownership'] },
  { id: 'Q24', query: 'React server components vs client components', category: 'PROGRAMMING', expectedResult: 'MATCH', targetTopic: 'React', expectedKeywords: ['react', 'component'] },

  // 7. Conceptual Questions
  { id: 'Q25', query: 'How does vector similarity search work?', category: 'CONCEPT', expectedResult: 'MATCH', targetTopic: 'Vector similarity', expectedKeywords: ['vector', 'similarity'] },
  { id: 'Q26', query: 'What is retrieval augmented generation?', category: 'CONCEPT', expectedResult: 'MATCH', targetTopic: 'RAG', expectedKeywords: ['retrieval', 'generation'] },
  { id: 'Q27', query: 'Explain CAP theorem consistency availability partition tolerance', category: 'CONCEPT', expectedResult: 'MATCH', targetTopic: 'CAP theorem', expectedKeywords: ['cap', 'theorem'] },
  { id: 'Q28', query: 'Zero-knowledge proofs cryptographic principles', category: 'CONCEPT', expectedResult: 'MATCH', targetTopic: 'Zero-knowledge proof', expectedKeywords: ['zero-knowledge', 'proof'] },

  // 8. Comparisons
  { id: 'Q29', query: 'Redis RDB vs AOF difference', category: 'COMPARISON', expectedResult: 'MATCH', targetTopic: 'Redis persistence', expectedKeywords: ['redis', 'rdb', 'aof'] },
  { id: 'Q30', query: 'PostgreSQL B-Tree vs GIN index performance', category: 'COMPARISON', expectedResult: 'MATCH', targetTopic: 'Index Types', expectedKeywords: ['index', 'btree', 'gin'] },
  { id: 'Q31', query: 'TCP vs UDP transport protocol differences', category: 'COMPARISON', expectedResult: 'MATCH', targetTopic: 'TCP', expectedKeywords: ['tcp', 'udp'] },
  { id: 'Q32', query: 'REST vs GraphQL API design trade-offs', category: 'COMPARISON', expectedResult: 'MATCH', targetTopic: 'GraphQL', expectedKeywords: ['rest', 'graphql'] },

  // 9. Troubleshooting
  { id: 'Q33', query: 'Retrying failing jobs in BullMQ', category: 'TROUBLESHOOTING', expectedResult: 'MATCH', targetTopic: 'BullMQ', expectedKeywords: ['retrying', 'failing', 'bullmq'] },
  { id: 'Q34', query: 'Resolving PostgreSQL deadlocks and lock contention', category: 'TROUBLESHOOTING', expectedResult: 'MATCH', targetTopic: 'PostgreSQL', expectedKeywords: ['deadlock', 'postgresql'] },
  { id: 'Q35', query: 'Docker container out of memory OOMKilled error', category: 'TROUBLESHOOTING', expectedResult: 'MATCH', targetTopic: 'Docker', expectedKeywords: ['docker', 'memory', 'oom'] },
  { id: 'Q36', query: 'Node.js EADDRINUSE port already in use error', category: 'TROUBLESHOOTING', expectedResult: 'MATCH', targetTopic: 'Node.js', expectedKeywords: ['node', 'port', 'address'] },

  // 10. Current Information & Standards
  { id: 'Q37', query: 'Latest ECMAScript features and syntax additions', category: 'CURRENT', expectedResult: 'MATCH', targetTopic: 'ECMAScript', expectedKeywords: ['ecmascript', 'javascript'] },
  { id: 'Q38', query: 'HTTP/3 and QUIC transport protocol specification', category: 'CURRENT', expectedResult: 'MATCH', targetTopic: 'HTTP/3', expectedKeywords: ['http', 'quic'] },
  { id: 'Q39', query: 'PostgreSQL 16 performance improvements', category: 'CURRENT', expectedResult: 'MATCH', targetTopic: 'PostgreSQL', expectedKeywords: ['postgresql'] },
  { id: 'Q40', query: 'Recent developments in multimodal foundation models', category: 'CURRENT', expectedResult: 'MATCH', targetTopic: 'Artificial intelligence', expectedKeywords: ['model', 'intelligence'] },

  // 11. Short Queries
  { id: 'Q41', query: 'Redis', category: 'SHORT', expectedResult: 'MATCH', targetTopic: 'Redis', expectedKeywords: ['redis'] },
  { id: 'Q42', query: 'Docker', category: 'SHORT', expectedResult: 'MATCH', targetTopic: 'Docker', expectedKeywords: ['docker'] },
  { id: 'Q43', query: 'Kubernetes', category: 'SHORT', expectedResult: 'MATCH', targetTopic: 'Kubernetes', expectedKeywords: ['kubernetes'] },
  { id: 'Q44', query: 'PostgreSQL', category: 'SHORT', expectedResult: 'MATCH', targetTopic: 'PostgreSQL', expectedKeywords: ['postgresql'] },

  // 12. Ambiguous Queries
  { id: 'Q45', query: 'Apple', category: 'AMBIGUOUS', expectedResult: 'MATCH', targetTopic: 'Apple', expectedKeywords: ['apple'] },
  { id: 'Q46', query: 'Python', category: 'AMBIGUOUS', expectedResult: 'MATCH', targetTopic: 'Python', expectedKeywords: ['python'] },
  { id: 'Q47', query: 'Go', category: 'AMBIGUOUS', expectedResult: 'MATCH', targetTopic: 'Go', expectedKeywords: ['go'] },
  { id: 'Q48', query: 'Java', category: 'AMBIGUOUS', expectedResult: 'MATCH', targetTopic: 'Java', expectedKeywords: ['java'] },

  // 13. Conversational Queries
  { id: 'Q49', query: 'Can you please tell me how snapshotting works in Redis?', category: 'CONVERSATIONAL', expectedResult: 'MATCH', targetTopic: 'Redis persistence', expectedKeywords: ['redis', 'snapshot'] },
  { id: 'Q50', query: 'Could you explain the difference between processes and threads?', category: 'CONVERSATIONAL', expectedResult: 'MATCH', targetTopic: 'Thread', expectedKeywords: ['thread', 'process'] },
  { id: 'Q51', query: 'I would like to know more about the city of Paris', category: 'CONVERSATIONAL', expectedResult: 'MATCH', targetTopic: 'Paris', expectedKeywords: ['paris'] },
  { id: 'Q52', query: 'Explain how indexing speeds up database queries please', category: 'CONVERSATIONAL', expectedResult: 'MATCH', targetTopic: 'Indexes', expectedKeywords: ['index', 'database'] },

  // 14. Out-of-Corpus Queries (Dynamic Discovery)
  { id: 'Q53', query: 'James Webb Space Telescope deep field galaxy discoveries', category: 'OUT_OF_CORPUS', expectedResult: 'MATCH', targetTopic: 'James Webb Space Telescope', expectedKeywords: ['telescope', 'webb', 'galaxy'] },
  { id: 'Q54', query: 'Quantum computing error correction surface codes', category: 'OUT_OF_CORPUS', expectedResult: 'MATCH', targetTopic: 'Quantum error correction', expectedKeywords: ['quantum', 'error', 'code'] },
  { id: 'Q55', query: 'Bose-Einstein condensate quantum state properties', category: 'OUT_OF_CORPUS', expectedResult: 'MATCH', targetTopic: 'Bose–Einstein condensate', expectedKeywords: ['bose', 'einstein', 'condensate'] },
  { id: 'Q56', query: 'AlphaFold protein structure prediction algorithm', category: 'OUT_OF_CORPUS', expectedResult: 'MATCH', targetTopic: 'AlphaFold', expectedKeywords: ['alphafold', 'protein'] },

  // 15. Gibberish & Invalid Queries (Must Return ZERO Results)
  { id: 'Q57', query: 'fttxtx', category: 'GIBBERISH', expectedResult: 'ZERO_RESULTS', targetTopic: 'None', expectedKeywords: [] },
  { id: 'Q58', query: 'aslkdjfhlaksjdf', category: 'GIBBERISH', expectedResult: 'ZERO_RESULTS', targetTopic: 'None', expectedKeywords: [] },
  { id: 'Q59', query: 'zzxxqq99', category: 'GIBBERISH', expectedResult: 'ZERO_RESULTS', targetTopic: 'None', expectedKeywords: [] },
  { id: 'Q60', query: '!@#$%^&*', category: 'GIBBERISH', expectedResult: 'ZERO_RESULTS', targetTopic: 'None', expectedKeywords: [] },
];

export async function runMilestone9Benchmark(): Promise<void> {
  console.log('================================================================');
  console.log('🚀 RUNNING MILESTONE 9 COMPREHENSIVE SEARCH QUALITY BENCHMARK');
  console.log(`Evaluating ${MILESTONE9_CASES.length} diverse queries across 15 real-world categories`);
  console.log('================================================================\n');

  const searchService = new SearchService();
  const resultsTable: any[] = [];

  let totalPrecisionAt5 = 0;
  let totalPrecisionAt10 = 0;
  let totalMrr = 0;
  let totalNdcgAt10 = 0;
  let totalDuplicates = 0;
  let totalResultsCount = 0;
  let gibberishTests = 0;
  let gibberishRejections = 0;
  let localHits = 0;
  let dynamicCrawlHits = 0;
  const latencies: number[] = [];

  for (let idx = 0; idx < MILESTONE9_CASES.length; idx++) {
    const testCase = MILESTONE9_CASES[idx];
    const start = Date.now();

    let res;
    try {
      res = await searchService.search({
        query: testCase.query,
        mode: 'HYBRID',
        limit: 10,
        disableLogging: true,
        skipCache: true,
      });
    } catch (err: any) {
      console.error(`Error executing ${testCase.id} ("${testCase.query}"):`, err?.message || err);
      res = { results: [], pagination: { total: 0 }, dynamicallyCrawled: false, latencyMs: Date.now() - start } as any;
    }

    const duration = Date.now() - start;
    latencies.push(duration);

    const items = res.results || [];
    const count = items.length;
    totalResultsCount += count;

    if (res.dynamicallyCrawled) {
      dynamicCrawlHits++;
    } else if (count > 0) {
      localHits++;
    }

    // Check document-level uniqueness
    const seenDocs = new Set<string>();
    let duplicates = 0;
    for (const it of items) {
      const key = it.documentId || it.url;
      if (seenDocs.has(key)) duplicates++;
      seenDocs.add(key);
    }
    totalDuplicates += duplicates;

    // Evaluate relevance against targetTopic and expected keywords
    let relevantCountAt5 = 0;
    let relevantCountAt10 = 0;
    let firstRelevantRank = 0;
    let dcgAt10 = 0;
    let idcgAt10 = 0;

    items.forEach((item, rIdx) => {
      const rank = rIdx + 1;
      const titleLower = (item.title || '').toLowerCase();
      const contentLower = (item.content || '').toLowerCase();
      const urlLower = (item.url || '').toLowerCase();

      const topicMatch = titleLower.includes(testCase.targetTopic.toLowerCase()) || urlLower.includes(testCase.targetTopic.toLowerCase());
      const kwMatches = testCase.expectedKeywords.filter((kw) =>
        titleLower.includes(kw) || contentLower.includes(kw)
      ).length;
      const kwRatio = testCase.expectedKeywords.length > 0 ? kwMatches / testCase.expectedKeywords.length : 0;

      const isRelevant = topicMatch || kwRatio >= 0.50;

      if (isRelevant) {
        if (rank <= 5) relevantCountAt5++;
        if (rank <= 10) relevantCountAt10++;
        if (firstRelevantRank === 0) firstRelevantRank = rank;

        // Graded gain for nDCG
        const gain = topicMatch ? 2 : 1;
        dcgAt10 += gain / Math.log2(rank + 1);
      }
    });

    // Ideal DCG calculation for nDCG@10
    const maxGainCount = Math.min(items.length, 10);
    for (let r = 1; r <= maxGainCount; r++) {
      idcgAt10 += (r === 1 ? 2 : 1) / Math.log2(r + 1);
    }
    const ndcgAt10 = idcgAt10 > 0 ? dcgAt10 / idcgAt10 : (count === 0 && testCase.expectedResult === 'ZERO_RESULTS' ? 1.0 : 0);

    const pAt5 = Math.min(5, count) > 0 ? relevantCountAt5 / Math.min(5, count) : 0;
    const pAt10 = count > 0 ? relevantCountAt10 / Math.min(10, count) : 0;
    const mrr = firstRelevantRank > 0 ? 1 / firstRelevantRank : 0;

    let status = 'PASS';
    if (testCase.expectedResult === 'ZERO_RESULTS') {
      gibberishTests++;
      if (count === 0) {
        gibberishRejections++;
        status = 'PASS';
      } else {
        status = 'FAIL';
      }
    } else {
      totalPrecisionAt5 += pAt5;
      totalPrecisionAt10 += pAt10;
      totalMrr += mrr;
      totalNdcgAt10 += ndcgAt10;

      if (count === 0 || pAt5 < 0.2) {
        status = 'FAIL';
      }
    }

    const topTitle = items[0]?.title || 'None';
    const topShort = topTitle.length > 30 ? topTitle.slice(0, 27) + '...' : topTitle;

    resultsTable.push({
      ID: testCase.id,
      Query: testCase.query.length > 32 ? testCase.query.slice(0, 29) + '...' : testCase.query,
      Category: testCase.category,
      Ret: count,
      Uniq: seenDocs.size,
      P5: Number(pAt5.toFixed(2)),
      P10: Number(pAt10.toFixed(2)),
      MRR: Number(mrr.toFixed(2)),
      nDCG: Number(ndcgAt10.toFixed(2)),
      TopResult: topShort,
      Lat: duration,
      Crawl: res.dynamicallyCrawled ? 'YES' : 'NO',
      Status: status,
    });
  }

  console.table(resultsTable);

  // Aggregate Metrics Computation
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const meanLat = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

  const nonGibberishCount = MILESTONE9_CASES.length - gibberishTests;
  const avgPAt5 = nonGibberishCount > 0 ? totalPrecisionAt5 / nonGibberishCount : 0;
  const avgPAt10 = nonGibberishCount > 0 ? totalPrecisionAt10 / nonGibberishCount : 0;
  const avgMrr = nonGibberishCount > 0 ? totalMrr / nonGibberishCount : 0;
  const avgNdcg = nonGibberishCount > 0 ? totalNdcgAt10 / nonGibberishCount : 0;

  const passedCount = resultsTable.filter((r) => r.Status === 'PASS').length;
  const duplicateRate = totalResultsCount > 0 ? (totalDuplicates / totalResultsCount) * 100 : 0;
  const gibberishRate = gibberishTests > 0 ? (gibberishRejections / gibberishTests) * 100 : 100;

  console.log('\n================================================================');
  console.log('📈 MILESTONE 9 AGGREGATE BENCHMARK EVALUATION RESULTS');
  console.log('================================================================');
  console.log(`Evaluated Query Cases:     ${MILESTONE9_CASES.length} total across 15 categories`);
  console.log(`Test Cases Passed:         ${passedCount} / ${MILESTONE9_CASES.length} (${((passedCount / MILESTONE9_CASES.length) * 100).toFixed(1)}%)`);
  console.log(`Document Duplicate Rate:   ${duplicateRate.toFixed(2)}% (Target: 0.0%)`);
  console.log(`Average Precision@5:       ${avgPAt5.toFixed(2)}`);
  console.log(`Average Precision@10:      ${avgPAt10.toFixed(2)}`);
  console.log(`Mean Reciprocal Rank (MRR): ${avgMrr.toFixed(2)}`);
  console.log(`Average nDCG@10:           ${avgNdcg.toFixed(2)}`);
  console.log(`Gibberish Zero-Result:     ${gibberishRate.toFixed(1)}% rejection (${gibberishRejections}/${gibberishTests})`);
  console.log(`Local Index Searches:      ${localHits} queries satisfied locally`);
  console.log(`Dynamic Web Searches:      ${dynamicCrawlHits} queries expanded via web discovery`);
  console.log(`Latency (P50):             ${p50} ms`);
  console.log(`Latency (P95):             ${p95} ms`);
  console.log(`Mean Latency:              ${meanLat} ms`);
  console.log('================================================================\n');

  process.exit(passedCount >= 54 ? 0 : 1);
}

// Direct execution entry point
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  runMilestone9Benchmark().catch((err) => {
    console.error('Fatal benchmark execution error:', err);
    process.exit(1);
  });
}
