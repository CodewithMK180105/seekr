# Seekr Search Quality Evaluation & Benchmark Suite

This directory contains the automated benchmark dataset, runner, and reports for objectively evaluating and comparing Seekr's three search modes:
- **`KEYWORD`**: Full-text lexical search (`ts_rank_cd` cover density ranking with GIN index).
- **`SEMANTIC`**: Dense vector retrieval (pgvector cosine similarity `<=>` with HNSW index and 768-dim embeddings).
- **`HYBRID`**: Concurrent retrieval with Reciprocal Rank Fusion ($RRF(d) = \sum \frac{1}{60 + rank(d)}$).

---

## 1. Quickstart

To run the full evaluation suite across all benchmark queries and all three search modes:

```bash
pnpm evaluation:run
```

### CLI Filters & Options

```bash
# Evaluate only a specific search mode
pnpm evaluation:run --mode=HYBRID

# Evaluate only a specific query category
pnpm evaluation:run --category=CONCEPTUAL

# Evaluate a specific query ID
pnpm evaluation:run --query=Q001

# Adjust latency warm-up runs and measured runs
pnpm evaluation:run --warmup=2 --runs=5

# Custom dataset path
pnpm evaluation:run --dataset=evaluation/datasets/benchmark-v1.json

# Skip saving report files to disk
pnpm evaluation:run --no-save
```

---

## 2. Dataset Structure

The benchmark dataset is versioned in `evaluation/datasets/` (e.g. `benchmark-v1.json`).

### Query Categories

The dataset contains 40 curated queries across 6 categories:
1. `EXACT_KEYWORD` (8 queries): Technical terms and entities (e.g., "Linux kernel source tree", "al-Khwarizmi").
2. `CONCEPTUAL` (8 queries): Abstract concepts and principles without verbatim keyword overlap (e.g., "how to reduce LLM inference costs and eliminate redundant prompt lookups").
3. `NATURAL_LANGUAGE` (8 queries): Conversational questions (e.g., "What is the historical origin of the word algorithm?").
4. `AMBIGUOUS` (4 queries): Polysemous or short queries (e.g., "memory", "routing").
5. `EXACT_PHRASE` (6 queries): Exact quoted phrases (e.g., `"finite sequence of rigorous instructions"`, `"Context Gateway"`).
6. `LONG_TAIL` (6 queries): Complex multi-clause technical inquiries with detailed constraints.

### Graded Relevance Scale

- **`0` — Irrelevant**: Chunk does not answer or pertain to the query.
- **`1` — Weakly Relevant**: Chunk mentions related topics or provides peripheral background.
- **`2` — Relevant**: Chunk contains directly relevant details.
- **`3` — Highly Relevant**: Chunk directly and comprehensively answers the query.

Ground truth relevance judgments are curated against the genuine indexed Seekr corpus chunks (verified in PostgreSQL).

---

## 3. Metric Definitions

### Precision@10
Proportion of top-10 retrieved results that are relevant (`relevance >= 2`):
$$\text{Precision@10} = \frac{\text{Count}(\text{retrieved chunks with relevance} \ge 2)}{10}$$

### Recall@10
Proportion of known relevant ground-truth chunks retrieved in top-10 results:
$$\text{Recall@10} = \frac{\text{Count}(\text{retrieved chunks with relevance} \ge 2)}{\text{Total known ground-truth chunks with relevance} \ge 2}$$

### Mean Reciprocal Rank (MRR)
Evaluates ranking speed to the first relevant result:
$$\text{RR} = \frac{1}{\text{rank of first relevant chunk}}$$
$$\text{MRR} = \frac{1}{|Q|} \sum_{q \in Q} \text{RR}(q)$$

### nDCG@10 (Normalized Discounted Cumulative Gain)
Evaluates graded relevance using exponential gains:
$$\text{DCG@10} = \sum_{i=1}^{10} \frac{2^{rel_i} - 1}{\log_2(i + 1)}$$
$$\text{nDCG@10} = \frac{\text{DCG@10}}{\text{IDCG@10}}$$
where $\text{IDCG@10}$ is the ideal DCG calculated from sorted ground-truth grades.

---

## 4. Latency Benchmarking Methodology

- Monotonic high-resolution timer (`performance.now()`).
- Warm-up executions (default: 1–2 runs, discarded).
- Measured executions (default: 2–5 runs, recorded).
- Calculates:
  - **P50 Latency (median)**
  - **P95 Latency (95th percentile)**
  - **Mean, Minimum, Maximum Latency**
- Database query logging is bypassed during benchmarking (`disableLogging: true`) to prevent measurement distortion and database pollution.

---

## 5. Report Formats

Every execution automatically generates timestamped reports in `evaluation/reports/`:
- **JSON**: `benchmark-report-YYYY-MM-DD_HH-mm-ss.json` (machine-readable)
- **Markdown**: `benchmark-report-YYYY-MM-DD_HH-mm-ss.md` (human-readable executive summary, category breakdown, query-level comparisons, and winner analysis).
