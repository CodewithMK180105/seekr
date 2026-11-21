import { BenchmarkRunner } from './benchmark-runner.js';
import { BenchmarkReporter } from './reporter.js';
import { SearchService } from '../services/search.service.js';
import { SearchMode } from '../search.types.js';
import { BenchmarkCategory, RunnerOptions } from './types.js';

function parseArgs(args: string[]): RunnerOptions {
  const options: RunnerOptions = {};

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      options.mode = arg.split('=')[1].toUpperCase() as SearchMode;
    } else if (arg.startsWith('--category=')) {
      options.category = arg.split('=')[1].toUpperCase() as BenchmarkCategory;
    } else if (arg.startsWith('--query=')) {
      options.queryId = arg.split('=')[1];
    } else if (arg.startsWith('--warmup=')) {
      options.latencyWarmupRuns = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--runs=')) {
      options.latencyMeasuredRuns = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--dataset=')) {
      options.datasetPath = arg.split('=')[1];
    } else if (arg === '--no-save') {
      options.saveReports = false;
    }
  }

  return options;
}

async function main() {
  console.log('====================================================');
  console.log('🔍 SEEKR SEARCH QUALITY BENCHMARK SUITE');
  console.log('====================================================\n');

  const cliOptions = parseArgs(process.argv.slice(2));
  const searchService = new SearchService();
  const runner = new BenchmarkRunner(searchService, cliOptions);
  const reporter = new BenchmarkReporter();

  try {
    const report = await runner.run();

    console.log('\n====================================================');
    console.log('📊 BENCHMARK RESULTS SUMMARY');
    console.log('====================================================');
    console.log(`Evaluated Queries: ${report.totalQueries}`);
    console.log(`Best Overall Mode: ${report.comparativeAnalysis.bestOverallMode}\n`);

    console.table(
      Object.entries(report.aggregateMetrics).map(([mode, m]) => ({
        Mode: mode,
        'P@10': m.precisionAt10,
        'R@10': m.recallAt10,
        MRR: m.mrr,
        'nDCG@10': m.ndcgAt10,
        'P50 (ms)': m.p50LatencyMs,
        'P95 (ms)': m.p95LatencyMs,
        'Mean (ms)': m.meanLatencyMs,
      }))
    );

    console.log('\n📁 Category Winners:');
    for (const [cat, winner] of Object.entries(report.comparativeAnalysis.bestModeByCategory)) {
      console.log(`  - ${cat.padEnd(20)}: ${winner}`);
    }

    if (cliOptions.saveReports !== false) {
      const { jsonPath, markdownPath } = reporter.saveReports(report);
      console.log('\n💾 Reports Saved:');
      console.log(`  - JSON:     ${jsonPath}`);
      console.log(`  - Markdown: ${markdownPath}`);
    }

    console.log('\n✅ Benchmark evaluation completed successfully!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Benchmark evaluation failed:', err);
    process.exit(1);
  }
}

main();
