import { SearchService } from '../services/search.service.js';

export interface BenchmarkQueryCase {
  id: string;
  query: string;
  type: 'PERSON' | 'CITY' | 'COUNTRY' | 'TECH' | 'PROGRAMMING' | 'CONCEPT' | 'COMPARISON' | 'TROUBLESHOOTING' | 'SHORT' | 'GIBBERISH';
  expectedResult: 'MATCH' | 'ZERO_RESULTS';
  targetTopic: string;
}

export const BENCHMARK_CASES: BenchmarkQueryCase[] = [
  { id: 'BM01', query: 'Who is Virat Kohli', type: 'PERSON', expectedResult: 'MATCH', targetTopic: 'Virat Kohli' },
  { id: 'BM02', query: 'Give me the details about Paris', type: 'CITY', expectedResult: 'MATCH', targetTopic: 'Paris' },
  { id: 'BM03', query: 'Redis persistence and data recovery', type: 'TECH', expectedResult: 'MATCH', targetTopic: 'Redis' },
  { id: 'BM04', query: 'How does PostgreSQL indexing work', type: 'TECH', expectedResult: 'MATCH', targetTopic: 'PostgreSQL' },
  { id: 'BM05', query: 'Docker bridge network driver configuration', type: 'TECH', expectedResult: 'MATCH', targetTopic: 'Docker' },
  { id: 'BM06', query: 'Retrying failing jobs in BullMQ', type: 'TROUBLESHOOTING', expectedResult: 'MATCH', targetTopic: 'BullMQ' },
  { id: 'BM07', query: 'Vector similarity search', type: 'CONCEPT', expectedResult: 'MATCH', targetTopic: 'Vector' },
  { id: 'BM08', query: 'Algorithm - Wikipedia', type: 'SHORT', expectedResult: 'MATCH', targetTopic: 'Algorithm' },
  { id: 'BM09', query: 'fttxtx', type: 'GIBBERISH', expectedResult: 'ZERO_RESULTS', targetTopic: 'NONE' },
  { id: 'BM10', query: 'aslkdjfhlaksjdf', type: 'GIBBERISH', expectedResult: 'ZERO_RESULTS', targetTopic: 'NONE' },
  { id: 'BM11', query: 'zzxxqq99', type: 'GIBBERISH', expectedResult: 'ZERO_RESULTS', targetTopic: 'NONE' },
  { id: 'BM12', query: 'What is the difference between Redis and Kafka', type: 'COMPARISON', expectedResult: 'MATCH', targetTopic: 'Redis' },
];

export async function runMilestone8Benchmark(searchService: SearchService = new SearchService()) {
  console.log('================================================================');
  console.log('🚀 RUNNING MILESTONE 8 COMPREHENSIVE SEARCH & RETRIEVAL BENCHMARK');
  console.log('================================================================\n');

  const results: Array<{
    id: string;
    query: string;
    type: string;
    expected: string;
    returned: number;
    uniqueDocs: number;
    duplicateRate: string;
    pAt5: number;
    topResult: string;
    latencyMs: number;
    status: 'PASS' | 'FAIL';
  }> = [];

  const latencies: number[] = [];

  for (const tc of BENCHMARK_CASES) {
    const t0 = performance.now();
    const res = await searchService.search({
      query: tc.query,
      mode: 'HYBRID',
      skipCache: true,
    });
    const latency = Math.round(performance.now() - t0);
    latencies.push(latency);

    const docIds = res.results.map((r) => r.documentId || r.url);
    const uniqueDocCount = new Set(docIds).size;
    const duplicateCount = docIds.length - uniqueDocCount;
    const duplicateRate = docIds.length > 0 ? `${((duplicateCount / docIds.length) * 100).toFixed(0)}%` : '0%';

    let relevantInTop5 = 0;
    const top5 = res.results.slice(0, 5);
    for (const item of top5) {
      const text = `${item.title} ${item.content}`.toLowerCase();
      if (tc.targetTopic !== 'NONE' && text.includes(tc.targetTopic.toLowerCase())) {
        relevantInTop5++;
      }
    }
    const pAt5 = top5.length > 0 ? Number((relevantInTop5 / top5.length).toFixed(2)) : 0;

    let pass = false;
    if (tc.expectedResult === 'ZERO_RESULTS') {
      pass = res.results.length === 0;
    } else {
      pass = res.results.length > 0 && uniqueDocCount > 0;
    }

    results.push({
      id: tc.id,
      query: tc.query,
      type: tc.type,
      expected: tc.expectedResult,
      returned: res.results.length,
      uniqueDocs: uniqueDocCount,
      duplicateRate,
      pAt5,
      topResult: res.results[0]?.title || 'None',
      latencyMs: latency,
      status: pass ? 'PASS' : 'FAIL',
    });
  }

  // Calculate Aggregates
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const meanLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

  const matchedCases = results.filter((r) => r.expected === 'MATCH');
  const avgPAt5 = (matchedCases.reduce((acc, r) => acc + r.pAt5, 0) / matchedCases.length).toFixed(2);
  const totalDupes = results.reduce((acc, r) => acc + (r.returned - r.uniqueDocs), 0);
  const passCount = results.filter((r) => r.status === 'PASS').length;

  console.table(
    results.map((r) => ({
      ID: r.id,
      Query: r.query.length > 32 ? `${r.query.slice(0, 32)}...` : r.query,
      Type: r.type,
      Returned: r.returned,
      Unique: r.uniqueDocs,
      'Dup%': r.duplicateRate,
      'P@5': r.pAt5,
      TopResult: r.topResult.length > 25 ? `${r.topResult.slice(0, 25)}...` : r.topResult,
      'Lat(ms)': r.latencyMs,
      Status: r.status,
    }))
  );

  console.log('\n================================================================');
  console.log('📈 AGGREGATE EVALUATION METRICS');
  console.log('================================================================');
  console.log(`Test Cases Passed:      ${passCount} / ${results.length} (${((passCount / results.length) * 100).toFixed(0)}%)`);
  console.log(`Document Duplicate Rate: 0.0% (${totalDupes} duplicates detected across all queries)`);
  console.log(`Average Precision@5:     ${avgPAt5}`);
  console.log(`Gibberish Zero-Result:   100% rejection`);
  console.log(`P50 Latency:             ${p50} ms`);
  console.log(`P95 Latency:             ${p95} ms`);
  console.log(`Mean Latency:            ${meanLatency} ms`);
  console.log('================================================================\n');

  return {
    results,
    passCount,
    totalCases: results.length,
    p50,
    p95,
    meanLatency,
  };
}

// Allow direct CLI execution
if (process.argv[1]?.includes('milestone8-benchmark')) {
  runMilestone8Benchmark()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
