import fs from 'node:fs';
import path from 'node:path';
import { BenchmarkReport } from './types.js';

function getMonorepoRoot(): string {
  let curr = process.cwd();
  while (curr && curr !== path.dirname(curr)) {
    if (
      fs.existsSync(path.join(curr, 'pnpm-workspace.yaml')) ||
      fs.existsSync(path.join(curr, 'evaluation'))
    ) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return process.cwd();
}

export class BenchmarkReporter {
  private readonly reportsDir: string;

  constructor(reportsDir?: string) {
    this.reportsDir = reportsDir || path.resolve(getMonorepoRoot(), 'evaluation/reports');
  }

  /**
   * Save both JSON and Markdown reports with timestamped filenames
   */
  saveReports(report: BenchmarkReport): { jsonPath: string; markdownPath: string } {
    fs.mkdirSync(this.reportsDir, { recursive: true });

    // Format ISO string into safe filename: benchmark-report-YYYY-MM-DD-HHMMSS
    const fileTimestamp = report.timestamp
      .replace(/:/g, '-')
      .replace(/\..+/, '')
      .replace('T', '_');

    const jsonPath = path.join(this.reportsDir, `benchmark-report-${fileTimestamp}.json`);
    const markdownPath = path.join(this.reportsDir, `benchmark-report-${fileTimestamp}.md`);

    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

    const markdown = this.generateMarkdown(report);
    fs.writeFileSync(markdownPath, markdown, 'utf8');

    return { jsonPath, markdownPath };
  }

  /**
   * Generate human-readable Markdown report
   */
  generateMarkdown(report: BenchmarkReport): string {
    const kw = report.aggregateMetrics.KEYWORD || ({} as any);
    const sem = report.aggregateMetrics.SEMANTIC || ({} as any);
    const hyb = report.aggregateMetrics.HYBRID || ({} as any);

    let md = `# Seekr Search Quality Benchmark Report

- **Benchmark Version**: \`${report.benchmarkVersion}\`
- **Execution Timestamp**: \`${report.timestamp}\`
- **Evaluated Queries**: \`${report.totalQueries}\`
- **Latency Warmup Runs**: \`${report.latencyWarmupRuns}\`
- **Latency Measured Runs**: \`${report.latencyMeasuredRuns}\`

---

## 1. Executive Summary & Aggregate Metrics

| Metric | KEYWORD | SEMANTIC | HYBRID | Best Mode |
|---|---|---|---|---|
| **Precision@10** | ${kw.precisionAt10 ?? 'N/A'} | ${sem.precisionAt10 ?? 'N/A'} | ${hyb.precisionAt10 ?? 'N/A'} | **${this.findBest(kw.precisionAt10, sem.precisionAt10, hyb.precisionAt10)}** |
| **Recall@10** | ${kw.recallAt10 ?? 'N/A'} | ${sem.recallAt10 ?? 'N/A'} | ${hyb.recallAt10 ?? 'N/A'} | **${this.findBest(kw.recallAt10, sem.recallAt10, hyb.recallAt10)}** |
| **MRR (Mean Reciprocal Rank)** | ${kw.mrr ?? 'N/A'} | ${sem.mrr ?? 'N/A'} | ${hyb.mrr ?? 'N/A'} | **${this.findBest(kw.mrr, sem.mrr, hyb.mrr)}** |
| **nDCG@10** | ${kw.ndcgAt10 ?? 'N/A'} | ${sem.ndcgAt10 ?? 'N/A'} | ${hyb.ndcgAt10 ?? 'N/A'} | **${this.findBest(kw.ndcgAt10, sem.ndcgAt10, hyb.ndcgAt10)}** |
| **P50 Latency (ms)** | ${kw.p50LatencyMs ?? 'N/A'} ms | ${sem.p50LatencyMs ?? 'N/A'} ms | ${hyb.p50LatencyMs ?? 'N/A'} ms | **${this.findBestLowest(kw.p50LatencyMs, sem.p50LatencyMs, hyb.p50LatencyMs)}** |
| **P95 Latency (ms)** | ${kw.p95LatencyMs ?? 'N/A'} ms | ${sem.p95LatencyMs ?? 'N/A'} ms | ${hyb.p95LatencyMs ?? 'N/A'} ms | **${this.findBestLowest(kw.p95LatencyMs, sem.p95LatencyMs, hyb.p95LatencyMs)}** |
| **Mean Latency (ms)** | ${kw.meanLatencyMs ?? 'N/A'} ms | ${sem.meanLatencyMs ?? 'N/A'} ms | ${hyb.meanLatencyMs ?? 'N/A'} ms | **${this.findBestLowest(kw.meanLatencyMs, sem.meanLatencyMs, hyb.meanLatencyMs)}** |

> **Best Overall Retrieval Mode**: **${report.comparativeAnalysis.bestOverallMode}**

---

## 2. Category Breakdown

| Category | Queries | KEYWORD nDCG | SEMANTIC nDCG | HYBRID nDCG | Winner |
|---|---|---|---|---|---|
`;

    for (const [cat, count] of Object.entries(report.categoryDistribution)) {
      const category = cat as import('./types.js').BenchmarkCategory;
      const catData = report.categoryBreakdown[category];
      if (!catData) continue;
      const kwN = catData.KEYWORD?.ndcgAt10 ?? 0;
      const semN = catData.SEMANTIC?.ndcgAt10 ?? 0;
      const hybN = catData.HYBRID?.ndcgAt10 ?? 0;
      const winner = report.comparativeAnalysis.bestModeByCategory[category] || 'N/A';

      md += `| **${category}** | ${count} | ${kwN} | ${semN} | ${hybN} | **${winner}** |\n`;
    }

    md += `\n---

## 3. Comparative Insights & Trade-Offs

${report.comparativeAnalysis.qualityVsLatencySummary}

### Notable Hybrid Improvements (${report.comparativeAnalysis.hybridWins.length})
`;

    if (report.comparativeAnalysis.hybridWins.length === 0) {
      md += `*None identified in this run.*\n`;
    } else {
      for (const win of report.comparativeAnalysis.hybridWins.slice(0, 5)) {
        md += `- **[${win.queryId}] "${win.query}"**: ${win.reason}\n`;
      }
    }

    md += `\n### Notable Keyword Wins (${report.comparativeAnalysis.keywordWins.length})\n`;
    if (report.comparativeAnalysis.keywordWins.length === 0) {
      md += `*None identified in this run.*\n`;
    } else {
      for (const win of report.comparativeAnalysis.keywordWins.slice(0, 5)) {
        md += `- **[${win.queryId}] "${win.query}"**: ${win.reason}\n`;
      }
    }

    md += `\n### Notable Semantic Wins (${report.comparativeAnalysis.semanticWins.length})\n`;
    if (report.comparativeAnalysis.semanticWins.length === 0) {
      md += `*None identified in this run.*\n`;
    } else {
      for (const win of report.comparativeAnalysis.semanticWins.slice(0, 5)) {
        md += `- **[${win.queryId}] "${win.query}"**: ${win.reason}\n`;
      }
    }

    md += `\n---

## 4. Query-Level Performance Table

| ID | Category | Query | KW nDCG | SEM nDCG | HYB nDCG | HYB P@10 | HYB R@10 | HYB Latency |
|---|---|---|---|---|---|---|---|---|
`;

    for (const qr of report.queryResults) {
      const kwR = qr.results.KEYWORD;
      const semR = qr.results.SEMANTIC;
      const hybR = qr.results.HYBRID;

      const safeQuery = qr.query.replace(/\|/g, '\\|');
      md += `| \`${qr.queryId}\` | ${qr.category} | ${safeQuery} | ${kwR?.ndcgAt10 ?? 0} | ${semR?.ndcgAt10 ?? 0} | **${hybR?.ndcgAt10 ?? 0}** | ${hybR?.precisionAt10 ?? 0} | ${hybR?.recallAt10 ?? 0} | ${hybR?.latencyMs ?? 0}ms |\n`;
    }

    return md;
  }

  private findBest(kw?: number, sem?: number, hyb?: number): string {
    const k = kw ?? -1;
    const s = sem ?? -1;
    const h = hyb ?? -1;
    const max = Math.max(k, s, h);
    if (max <= 0) return 'TIE';
    if (h === max && (h > k || h > s)) return 'HYBRID';
    if (h === max && k === max && s === max) return 'ALL';
    if (k === max && k > s) return 'KEYWORD';
    if (s === max && s > k) return 'SEMANTIC';
    return 'HYBRID';
  }

  private findBestLowest(kw?: number, sem?: number, hyb?: number): string {
    const k = kw ?? Infinity;
    const s = sem ?? Infinity;
    const h = hyb ?? Infinity;
    const min = Math.min(k, s, h);
    if (min === Infinity) return 'N/A';
    if (k === min) return 'KEYWORD';
    if (s === min) return 'SEMANTIC';
    return 'HYBRID';
  }
}
