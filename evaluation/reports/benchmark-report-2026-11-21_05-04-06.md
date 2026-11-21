# Seekr Search Quality Benchmark Report

- **Benchmark Version**: `1.0.0`
- **Execution Timestamp**: `2026-11-21T05:04:06.651Z`
- **Evaluated Queries**: `8`
- **Latency Warmup Runs**: `1`
- **Latency Measured Runs**: `2`

---

## 1. Executive Summary & Aggregate Metrics

| Metric | KEYWORD | SEMANTIC | HYBRID | Best Mode |
|---|---|---|---|---|
| **Precision@10** | 0.175 | 0.225 | 0.225 | **HYBRID** |
| **Recall@10** | 0.7813 | 1 | 1 | **HYBRID** |
| **MRR (Mean Reciprocal Rank)** | 0.9167 | 0.9375 | 0.8542 | **SEMANTIC** |
| **nDCG@10** | 0.7987 | 0.8833 | 0.8602 | **SEMANTIC** |
| **P50 Latency (ms)** | 3.18 ms | 471.36 ms | 477.51 ms | **KEYWORD** |
| **P95 Latency (ms)** | 7.79 ms | 502.65 ms | 501.87 ms | **KEYWORD** |
| **Mean Latency (ms)** | 3.93 ms | 469.34 ms | 475.61 ms | **KEYWORD** |

> **Best Overall Retrieval Mode**: **SEMANTIC**

---

## 2. Category Breakdown

| Category | Queries | KEYWORD nDCG | SEMANTIC nDCG | HYBRID nDCG | Winner |
|---|---|---|---|---|---|
| **EXACT_KEYWORD** | 8 | 0.7987 | 0.8833 | 0.8602 | **SEMANTIC** |
| **CONCEPTUAL** | 0 | 0 | 0 | 0 | **KEYWORD** |
| **NATURAL_LANGUAGE** | 0 | 0 | 0 | 0 | **KEYWORD** |
| **AMBIGUOUS** | 0 | 0 | 0 | 0 | **KEYWORD** |
| **EXACT_PHRASE** | 0 | 0 | 0 | 0 | **KEYWORD** |
| **LONG_TAIL** | 0 | 0 | 0 | 0 | **KEYWORD** |

---

## 3. Comparative Insights & Trade-Offs

HYBRID delivers the most consistent ranking quality across categories (nDCG@10: 0.8602, MRR: 0.8542) at P50 latency of 477.51ms. KEYWORD provides ultra-low latency (3.18ms) and excels on verbatim exact phrasing, but suffers on natural language queries. SEMANTIC retrieves conceptually related chunks (P50: 471.36ms) but can lose precision on exact technical identifiers. HYBRID balances both with reciprocal rank fusion.

### Notable Hybrid Improvements (0)
*None identified in this run.*

### Notable Keyword Wins (1)
- **[Q003] "Turing machine programs"**: Keyword nDCG (0.7453) exceeded Semantic (0.6122) and Hybrid (0.6075)

### Notable Semantic Wins (2)
- **[Q001] "Linux kernel source tree"**: Semantic nDCG (0.6764) exceeded Keyword (0.5241) and Hybrid (0.5077)
- **[Q006] "Agent Playbooks"**: Semantic nDCG (0.9907) exceeded Keyword (0.8944) and Hybrid (0.9794)

---

## 4. Query-Level Performance Table

| ID | Category | Query | KW nDCG | SEM nDCG | HYB nDCG | HYB P@10 | HYB R@10 | HYB Latency |
|---|---|---|---|---|---|---|---|---|
| `Q001` | EXACT_KEYWORD | Linux kernel source tree | 0.5241 | 0.6764 | **0.5077** | 0.2 | 1 | 466.15ms |
| `Q002` | EXACT_KEYWORD | al-Khwarizmi | 0.7453 | 0.8996 | **0.8996** | 0.2 | 1 | 474.95ms |
| `Q003` | EXACT_KEYWORD | Turing machine programs | 0.7453 | 0.6122 | **0.6075** | 0.2 | 1 | 490ms |
| `Q004` | EXACT_KEYWORD | Redis Intent Router | 0.9839 | 1 | **1** | 0.3 | 1 | 483.27ms |
| `Q005` | EXACT_KEYWORD | Euclid division algorithm | 0.7453 | 0.9049 | **0.9049** | 0.2 | 1 | 490.49ms |
| `Q006` | EXACT_KEYWORD | Agent Playbooks | 0.8944 | 0.9907 | **0.9794** | 0.4 | 1 | 475.08ms |
| `Q007` | EXACT_KEYWORD | GitHub Enterprise Importer migrations | 0.834 | 1 | **1** | 0.2 | 1 | 490.26ms |
| `Q008` | EXACT_KEYWORD | Jacquard loom punch cards | 0.9173 | 0.9828 | **0.9828** | 0.1 | 1 | 501.87ms |
