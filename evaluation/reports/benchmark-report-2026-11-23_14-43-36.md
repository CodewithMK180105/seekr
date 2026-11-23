# Seekr Search Quality Benchmark Report

- **Benchmark Version**: `1.0.0`
- **Execution Timestamp**: `2026-11-23T14:43:36.316Z`
- **Evaluated Queries**: `40`
- **Latency Warmup Runs**: `2`
- **Latency Measured Runs**: `5`

---

## 1. Executive Summary & Aggregate Metrics

| Metric | KEYWORD | SEMANTIC | HYBRID | Best Mode |
|---|---|---|---|---|
| **Precision@10** | 0.075 | 0.19 | 0.1925 | **HYBRID** |
| **Recall@10** | 0.3896 | 0.9583 | 0.9708 | **HYBRID** |
| **MRR (Mean Reciprocal Rank)** | 0.4258 | 0.8438 | 0.8236 | **SEMANTIC** |
| **nDCG@10** | 0.3778 | 0.8433 | 0.8386 | **SEMANTIC** |
| **P50 Latency (ms)** | 47.89 ms | 0.54 ms | 0.57 ms | **SEMANTIC** |
| **P95 Latency (ms)** | 60.77 ms | 1.94 ms | 2 ms | **SEMANTIC** |
| **Mean Latency (ms)** | 28.97 ms | 0.83 ms | 0.77 ms | **HYBRID** |

> **Best Overall Retrieval Mode**: **SEMANTIC**

---

## 2. Category Breakdown

| Category | Queries | KEYWORD nDCG | SEMANTIC nDCG | HYBRID nDCG | Winner |
|---|---|---|---|---|---|
| **EXACT_KEYWORD** | 8 | 0.7987 | 0.8899 | 0.8658 | **SEMANTIC** |
| **CONCEPTUAL** | 8 | 0 | 0.7554 | 0.7554 | **SEMANTIC** |
| **NATURAL_LANGUAGE** | 8 | 0.0984 | 0.8812 | 0.8812 | **SEMANTIC** |
| **AMBIGUOUS** | 4 | 0.6781 | 0.7304 | 0.8016 | **HYBRID** |
| **EXACT_PHRASE** | 6 | 0.7178 | 0.9678 | 0.9214 | **SEMANTIC** |
| **LONG_TAIL** | 6 | 0.1529 | 0.7985 | 0.7985 | **SEMANTIC** |

---

## 3. Comparative Insights & Trade-Offs

HYBRID delivers the most consistent ranking quality across categories (nDCG@10: 0.8386, MRR: 0.8236) at P50 latency of 0.57ms. KEYWORD provides ultra-low latency (47.89ms) and excels on verbatim exact phrasing, but suffers on natural language queries. SEMANTIC retrieves conceptually related chunks (P50: 0.54ms) but can lose precision on exact technical identifiers. HYBRID balances both with reciprocal rank fusion.

### Notable Hybrid Improvements (1)
- **[Q028] "rules"**: Hybrid nDCG (0.6419) outperformed Keyword (0.5997) and Semantic (0.2624)

### Notable Keyword Wins (2)
- **[Q003] "Turing machine programs"**: Keyword nDCG (0.7453) exceeded Semantic (0.6122) and Hybrid (0.6075)
- **[Q033] ""Agent Mesh""**: Keyword nDCG (0.9197) exceeded Semantic (0.8066) and Hybrid (0.8772)

### Notable Semantic Wins (6)
- **[Q001] "Linux kernel source tree"**: Semantic nDCG (0.6764) exceeded Keyword (0.5241) and Hybrid (0.5077)
- **[Q002] "al-Khwarizmi"**: Semantic nDCG (0.9164) exceeded Keyword (0.7453) and Hybrid (0.9024)
- **[Q006] "Agent Playbooks"**: Semantic nDCG (0.9843) exceeded Keyword (0.8944) and Hybrid (0.9794)
- **[Q025] "memory"**: Semantic nDCG (0.7753) exceeded Keyword (0.3903) and Hybrid (0.7516)
- **[Q026] "routing"**: Semantic nDCG (0.8839) exceeded Keyword (0.7226) and Hybrid (0.8129)

---

## 4. Query-Level Performance Table

| ID | Category | Query | KW nDCG | SEM nDCG | HYB nDCG | HYB P@10 | HYB R@10 | HYB Latency |
|---|---|---|---|---|---|---|---|---|
| `Q001` | EXACT_KEYWORD | Linux kernel source tree | 0.5241 | 0.6764 | **0.5077** | 0.2 | 1 | 0.63ms |
| `Q002` | EXACT_KEYWORD | al-Khwarizmi | 0.7453 | 0.9164 | **0.9024** | 0.2 | 1 | 0.71ms |
| `Q003` | EXACT_KEYWORD | Turing machine programs | 0.7453 | 0.6122 | **0.6075** | 0.2 | 1 | 0.63ms |
| `Q004` | EXACT_KEYWORD | Redis Intent Router | 0.9839 | 1 | **1** | 0.3 | 1 | 0.54ms |
| `Q005` | EXACT_KEYWORD | Euclid division algorithm | 0.7453 | 0.9468 | **0.9468** | 0.2 | 1 | 0.48ms |
| `Q006` | EXACT_KEYWORD | Agent Playbooks | 0.8944 | 0.9843 | **0.9794** | 0.4 | 1 | 0.61ms |
| `Q007` | EXACT_KEYWORD | GitHub Enterprise Importer migrations | 0.834 | 1 | **1** | 0.2 | 1 | 0.41ms |
| `Q008` | EXACT_KEYWORD | Jacquard loom punch cards | 0.9173 | 0.9828 | **0.9828** | 0.1 | 1 | 0.62ms |
| `Q009` | CONCEPTUAL | how to reduce LLM inference costs and eliminate redundant prompt lookups | 0 | 0.9049 | **0.9049** | 0.2 | 1 | 1.7ms |
| `Q010` | CONCEPTUAL | difference between heuristic approaches and guaranteed algorithms | 0 | 0.9049 | **0.9049** | 0.2 | 1 | 0.59ms |
| `Q011` | CONCEPTUAL | persisting state and long-term memory in autonomous AI agents | 0 | 0.4975 | **0.4975** | 0.3 | 1 | 1.3ms |
| `Q012` | CONCEPTUAL | operating system kernel guidelines and code of conduct | 0 | 1 | **1** | 0.2 | 1 | 0.45ms |
| `Q013` | CONCEPTUAL | evaluating time and memory requirements as algorithm input increases | 0 | 0.7872 | **0.7872** | 0.1 | 0.5 | 0.52ms |
| `Q014` | CONCEPTUAL | safeguarding private personal email addresses when pushing git commits | 0 | 1 | **1** | 0.2 | 1 | 0.41ms |
| `Q015` | CONCEPTUAL | theoretical formalization of effective computability and mechanical calculation | 0 | 0.5938 | **0.5938** | 0.2 | 1 | 0.42ms |
| `Q016` | CONCEPTUAL | accessing business data from LLM agents with standardized schemas | 0 | 0.3546 | **0.3546** | 0.2 | 1 | 0.45ms |
| `Q017` | NATURAL_LANGUAGE | Where does the word algorithm come from historically? | 0 | 0.9357 | **0.9357** | 0.2 | 1 | 0.43ms |
| `Q018` | NATURAL_LANGUAGE | What documentation covers system administration for Linux kernels? | 0 | 0.9461 | **0.9461** | 0.2 | 1 | 0.57ms |
| `Q019` | NATURAL_LANGUAGE | What are the main capabilities of Redis Iris for AI developers? | 0 | 0.5942 | **0.5942** | 0.3 | 1 | 0.43ms |
| `Q020` | NATURAL_LANGUAGE | How did telephone switching machines and looms lead to modern computers? | 0 | 1 | **1** | 0.1 | 1 | 1.74ms |
| `Q021` | NATURAL_LANGUAGE | Why do AI agents need persistent context across conversations? | 0 | 0.9049 | **0.9049** | 0.2 | 1 | 0.38ms |
| `Q022` | NATURAL_LANGUAGE | How do live repository migrations minimize downtime for engineering teams? | 0 | 1 | **1** | 0.2 | 1 | 0.49ms |
| `Q023` | NATURAL_LANGUAGE | What formal models proved equivalent in algorithmic theory? | 0.7872 | 0.9324 | **0.9324** | 0.2 | 1 | 0.52ms |
| `Q024` | NATURAL_LANGUAGE | How does matching questions by meaning speed up responses? | 0 | 0.7364 | **0.7364** | 0.2 | 1 | 0.5ms |
| `Q025` | AMBIGUOUS | memory | 0.3903 | 0.7753 | **0.7516** | 0.2 | 0.6667 | 1.7ms |
| `Q026` | AMBIGUOUS | routing | 0.7226 | 0.8839 | **0.8129** | 0.2 | 0.6667 | 0.55ms |
| `Q027` | AMBIGUOUS | migration | 1 | 1 | **1** | 0.2 | 1 | 1.72ms |
| `Q028` | AMBIGUOUS | rules | 0.5997 | 0.2624 | **0.6419** | 0.2 | 1 | 0.57ms |
| `Q029` | EXACT_PHRASE | "finite sequence of rigorous instructions" | 0 | 1 | **1** | 0.1 | 1 | 0.44ms |
| `Q030` | EXACT_PHRASE | "Context Gateway" | 0.3869 | 1 | **0.6509** | 0.2 | 1 | 0.45ms |
| `Q031` | EXACT_PHRASE | "Documentation/process/changes.rst" | 1 | 1 | **1** | 0.1 | 1 | 1.68ms |
| `Q032` | EXACT_PHRASE | "Book of Indian computation" | 1 | 1 | **1** | 0.1 | 1 | 0.45ms |
| `Q033` | EXACT_PHRASE | "Agent Mesh" | 0.9197 | 0.8066 | **0.8772** | 0.2 | 1 | 0.58ms |
| `Q034` | EXACT_PHRASE | "Jacquard loom" | 1 | 1 | **1** | 0.1 | 1 | 0.56ms |
| `Q035` | LONG_TAIL | guidelines and documentation files for academic researchers exploring Linux kernel internals | 0 | 1 | **1** | 0.2 | 1 | 0.45ms |
| `Q036` | LONG_TAIL | ancient clay tablets and division arithmetic algorithms before mechanical calculation | 0.9173 | 0.968 | **0.968** | 0.1 | 1 | 0.37ms |
| `Q037` | LONG_TAIL | persisting agent conversations and routing streams through dropped network connections with Agent Mesh | 0 | 0.6053 | **0.6053** | 0.2 | 1 | 0.44ms |
| `Q038` | LONG_TAIL | blocking command line git pushes that expose private personal email address | 0 | 1 | **1** | 0.2 | 1 | 0.83ms |
| `Q039` | LONG_TAIL | formal equivalence between lambda calculus Turing machines and general recursive functions | 0 | 0.5241 | **0.5241** | 0.2 | 1 | 1.23ms |
| `Q040` | LONG_TAIL | turn agent behavior into an explainable queryable record of decisions with Lens in Redis Iris | 0 | 0.6934 | **0.6934** | 0.2 | 1 | 0.36ms |
