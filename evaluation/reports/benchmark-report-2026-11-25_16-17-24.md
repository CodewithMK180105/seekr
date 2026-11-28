# Seekr Search Quality Benchmark Report

- **Benchmark Version**: `1.0.0`
- **Execution Timestamp**: `2026-11-25T16:17:24.793Z`
- **Evaluated Queries**: `40`
- **Latency Warmup Runs**: `1`
- **Latency Measured Runs**: `2`

---

## 1. Executive Summary & Aggregate Metrics

| Metric | KEYWORD | SEMANTIC | HYBRID | Best Mode |
|---|---|---|---|---|
| **Precision@10** | 0.0725 | 0.17 | 0.1825 | **HYBRID** |
| **Recall@10** | 0.3771 | 0.875 | 0.925 | **HYBRID** |
| **MRR (Mean Reciprocal Rank)** | 0.4133 | 0.8028 | 0.7911 | **SEMANTIC** |
| **nDCG@10** | 0.3677 | 0.7817 | 0.7943 | **HYBRID** |
| **P50 Latency (ms)** | 51.55 ms | 2 ms | 2.31 ms | **SEMANTIC** |
| **P95 Latency (ms)** | 61.29 ms | 133.84 ms | 49.05 ms | **HYBRID** |
| **Mean Latency (ms)** | 32.42 ms | 16.04 ms | 11.76 ms | **HYBRID** |

> **Best Overall Retrieval Mode**: **HYBRID**

---

## 2. Category Breakdown

| Category | Queries | KEYWORD nDCG | SEMANTIC nDCG | HYBRID nDCG | Winner |
|---|---|---|---|---|---|
| **EXACT_KEYWORD** | 8 | 0.7987 | 0.8775 | 0.8534 | **SEMANTIC** |
| **CONCEPTUAL** | 8 | 0 | 0.7354 | 0.7354 | **SEMANTIC** |
| **NATURAL_LANGUAGE** | 8 | 0.0984 | 0.8025 | 0.8025 | **SEMANTIC** |
| **AMBIGUOUS** | 4 | 0.577 | 0.3855 | 0.577 | **KEYWORD** |
| **EXACT_PHRASE** | 6 | 0.7178 | 0.9355 | 0.924 | **SEMANTIC** |
| **LONG_TAIL** | 6 | 0.1529 | 0.7985 | 0.7985 | **SEMANTIC** |

---

## 3. Comparative Insights & Trade-Offs

HYBRID delivers the most consistent ranking quality across categories (nDCG@10: 0.7943, MRR: 0.7911) at P50 latency of 2.31ms. KEYWORD provides ultra-low latency (51.55ms) and excels on verbatim exact phrasing, but suffers on natural language queries. SEMANTIC retrieves conceptually related chunks (P50: 2ms) but can lose precision on exact technical identifiers. HYBRID balances both with reciprocal rank fusion.

### Notable Hybrid Improvements (0)
*None identified in this run.*

### Notable Keyword Wins (2)
- **[Q003] "Turing machine programs"**: Keyword nDCG (0.7453) exceeded Semantic (0.6122) and Hybrid (0.6075)
- **[Q033] ""Agent Mesh""**: Keyword nDCG (0.9197) exceeded Semantic (0.6131) and Hybrid (0.8503)

### Notable Semantic Wins (4)
- **[Q001] "Linux kernel source tree"**: Semantic nDCG (0.6764) exceeded Keyword (0.5241) and Hybrid (0.5077)
- **[Q002] "al-Khwarizmi"**: Semantic nDCG (0.8828) exceeded Keyword (0.7453) and Hybrid (0.8688)
- **[Q006] "Agent Playbooks"**: Semantic nDCG (0.9843) exceeded Keyword (0.8944) and Hybrid (0.9794)
- **[Q030] ""Context Gateway""**: Semantic nDCG (1) exceeded Keyword (0.3869) and Hybrid (0.6934)

---

## 4. Query-Level Performance Table

| ID | Category | Query | KW nDCG | SEM nDCG | HYB nDCG | HYB P@10 | HYB R@10 | HYB Latency |
|---|---|---|---|---|---|---|---|---|
| `Q001` | EXACT_KEYWORD | Linux kernel source tree | 0.5241 | 0.6764 | **0.5077** | 0.2 | 1 | 2.35ms |
| `Q002` | EXACT_KEYWORD | al-Khwarizmi | 0.7453 | 0.8828 | **0.8688** | 0.2 | 1 | 6.73ms |
| `Q003` | EXACT_KEYWORD | Turing machine programs | 0.7453 | 0.6122 | **0.6075** | 0.2 | 1 | 45.27ms |
| `Q004` | EXACT_KEYWORD | Redis Intent Router | 0.9839 | 1 | **1** | 0.3 | 1 | 49.05ms |
| `Q005` | EXACT_KEYWORD | Euclid division algorithm | 0.7453 | 0.9468 | **0.9468** | 0.2 | 1 | 3.69ms |
| `Q006` | EXACT_KEYWORD | Agent Playbooks | 0.8944 | 0.9843 | **0.9794** | 0.4 | 1 | 3.47ms |
| `Q007` | EXACT_KEYWORD | GitHub Enterprise Importer migrations | 0.834 | 1 | **1** | 0.2 | 1 | 1.6ms |
| `Q008` | EXACT_KEYWORD | Jacquard loom punch cards | 0.9173 | 0.9173 | **0.9173** | 0.1 | 1 | 1.05ms |
| `Q009` | CONCEPTUAL | how to reduce LLM inference costs and eliminate redundant prompt lookups | 0 | 0.9049 | **0.9049** | 0.2 | 1 | 47.68ms |
| `Q010` | CONCEPTUAL | difference between heuristic approaches and guaranteed algorithms | 0 | 0.9049 | **0.9049** | 0.2 | 1 | 49.57ms |
| `Q011` | CONCEPTUAL | persisting state and long-term memory in autonomous AI agents | 0 | 0.3381 | **0.3381** | 0.2 | 0.6667 | 3.28ms |
| `Q012` | CONCEPTUAL | operating system kernel guidelines and code of conduct | 0 | 1 | **1** | 0.2 | 1 | 1.49ms |
| `Q013` | CONCEPTUAL | evaluating time and memory requirements as algorithm input increases | 0 | 0.7872 | **0.7872** | 0.1 | 0.5 | 44.28ms |
| `Q014` | CONCEPTUAL | safeguarding private personal email addresses when pushing git commits | 0 | 1 | **1** | 0.2 | 1 | 2.63ms |
| `Q015` | CONCEPTUAL | theoretical formalization of effective computability and mechanical calculation | 0 | 0.5938 | **0.5938** | 0.2 | 1 | 43.51ms |
| `Q016` | CONCEPTUAL | accessing business data from LLM agents with standardized schemas | 0 | 0.3546 | **0.3546** | 0.2 | 1 | 45.16ms |
| `Q017` | NATURAL_LANGUAGE | Where does the word algorithm come from historically? | 0 | 0.9357 | **0.9357** | 0.2 | 1 | 48.26ms |
| `Q018` | NATURAL_LANGUAGE | What documentation covers system administration for Linux kernels? | 0 | 0.9461 | **0.9461** | 0.2 | 1 | 2.11ms |
| `Q019` | NATURAL_LANGUAGE | What are the main capabilities of Redis Iris for AI developers? | 0 | 0.5942 | **0.5942** | 0.3 | 1 | 47.59ms |
| `Q020` | NATURAL_LANGUAGE | How did telephone switching machines and looms lead to modern computers? | 0 | 1 | **1** | 0.1 | 1 | 1.46ms |
| `Q021` | NATURAL_LANGUAGE | Why do AI agents need persistent context across conversations? | 0 | 0.9049 | **0.9049** | 0.2 | 1 | 51ms |
| `Q022` | NATURAL_LANGUAGE | How do live repository migrations minimize downtime for engineering teams? | 0 | 1 | **1** | 0.2 | 1 | 1.87ms |
| `Q023` | NATURAL_LANGUAGE | What formal models proved equivalent in algorithmic theory? | 0.7872 | 0.9324 | **0.9324** | 0.2 | 1 | 48.39ms |
| `Q024` | NATURAL_LANGUAGE | How does matching questions by meaning speed up responses? | 0 | 0.1065 | **0.1065** | 0 | 0 | 3.49ms |
| `Q025` | AMBIGUOUS | memory | 0.3903 | 0 | **0.3903** | 0.2 | 0.6667 | 48.19ms |
| `Q026` | AMBIGUOUS | routing | 0.7051 | 0.5419 | **0.7051** | 0.2 | 0.6667 | 42.65ms |
| `Q027` | AMBIGUOUS | migration | 1 | 1 | **1** | 0.2 | 1 | 2.76ms |
| `Q028` | AMBIGUOUS | rules | 0.2128 | 0 | **0.2128** | 0.1 | 0.5 | 47.31ms |
| `Q029` | EXACT_PHRASE | "finite sequence of rigorous instructions" | 0 | 1 | **1** | 0.1 | 1 | 59.95ms |
| `Q030` | EXACT_PHRASE | "Context Gateway" | 0.3869 | 1 | **0.6934** | 0.2 | 1 | 3.83ms |
| `Q031` | EXACT_PHRASE | "Documentation/process/changes.rst" | 1 | 1 | **1** | 0.1 | 1 | 1.3ms |
| `Q032` | EXACT_PHRASE | "Book of Indian computation" | 1 | 1 | **1** | 0.1 | 1 | 3.25ms |
| `Q033` | EXACT_PHRASE | "Agent Mesh" | 0.9197 | 0.6131 | **0.8503** | 0.2 | 1 | 0.99ms |
| `Q034` | EXACT_PHRASE | "Jacquard loom" | 1 | 1 | **1** | 0.1 | 1 | 1.24ms |
| `Q035` | LONG_TAIL | guidelines and documentation files for academic researchers exploring Linux kernel internals | 0 | 1 | **1** | 0.2 | 1 | 1.85ms |
| `Q036` | LONG_TAIL | ancient clay tablets and division arithmetic algorithms before mechanical calculation | 0.9173 | 0.968 | **0.968** | 0.1 | 1 | 46.04ms |
| `Q037` | LONG_TAIL | persisting agent conversations and routing streams through dropped network connections with Agent Mesh | 0 | 0.6053 | **0.6053** | 0.2 | 1 | 4.47ms |
| `Q038` | LONG_TAIL | blocking command line git pushes that expose private personal email address | 0 | 1 | **1** | 0.2 | 1 | 1.63ms |
| `Q039` | LONG_TAIL | formal equivalence between lambda calculus Turing machines and general recursive functions | 0 | 0.5241 | **0.5241** | 0.2 | 1 | 3.85ms |
| `Q040` | LONG_TAIL | turn agent behavior into an explainable queryable record of decisions with Lens in Redis Iris | 0 | 0.6934 | **0.6934** | 0.2 | 1 | 45.23ms |
