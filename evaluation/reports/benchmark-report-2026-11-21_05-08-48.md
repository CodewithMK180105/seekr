# Seekr Search Quality Benchmark Report

- **Benchmark Version**: `1.0.0`
- **Execution Timestamp**: `2026-11-21T05:08:48.273Z`
- **Evaluated Queries**: `40`
- **Latency Warmup Runs**: `1`
- **Latency Measured Runs**: `2`

---

## 1. Executive Summary & Aggregate Metrics

| Metric | KEYWORD | SEMANTIC | HYBRID | Best Mode |
|---|---|---|---|---|
| **Precision@10** | 0.075 | 0.19 | 0.1875 | **SEMANTIC** |
| **Recall@10** | 0.3896 | 0.9583 | 0.9458 | **SEMANTIC** |
| **MRR (Mean Reciprocal Rank)** | 0.4258 | 0.8438 | 0.8111 | **SEMANTIC** |
| **nDCG@10** | 0.3778 | 0.8408 | 0.8209 | **SEMANTIC** |
| **P50 Latency (ms)** | 3.17 ms | 459.45 ms | 466.1 ms | **KEYWORD** |
| **P95 Latency (ms)** | 11.08 ms | 508.93 ms | 601.01 ms | **KEYWORD** |
| **Mean Latency (ms)** | 4.34 ms | 487.45 ms | 505.95 ms | **KEYWORD** |

> **Best Overall Retrieval Mode**: **SEMANTIC**

---

## 2. Category Breakdown

| Category | Queries | KEYWORD nDCG | SEMANTIC nDCG | HYBRID nDCG | Winner |
|---|---|---|---|---|---|
| **EXACT_KEYWORD** | 8 | 0.7987 | 0.8833 | 0.8602 | **SEMANTIC** |
| **CONCEPTUAL** | 8 | 0 | 0.7558 | 0.7558 | **SEMANTIC** |
| **NATURAL_LANGUAGE** | 8 | 0.0984 | 0.8757 | 0.8757 | **SEMANTIC** |
| **AMBIGUOUS** | 4 | 0.6781 | 0.7304 | 0.8016 | **HYBRID** |
| **EXACT_PHRASE** | 6 | 0.7178 | 0.9696 | 0.9214 | **SEMANTIC** |
| **LONG_TAIL** | 6 | 0.1529 | 0.7955 | 0.6946 | **SEMANTIC** |

---

## 3. Comparative Insights & Trade-Offs

HYBRID delivers the most consistent ranking quality across categories (nDCG@10: 0.8209, MRR: 0.8111) at P50 latency of 466.1ms. KEYWORD provides ultra-low latency (3.17ms) and excels on verbatim exact phrasing, but suffers on natural language queries. SEMANTIC retrieves conceptually related chunks (P50: 459.45ms) but can lose precision on exact technical identifiers. HYBRID balances both with reciprocal rank fusion.

### Notable Hybrid Improvements (1)
- **[Q028] "rules"**: Hybrid nDCG (0.6419) outperformed Keyword (0.5997) and Semantic (0.2624)

### Notable Keyword Wins (2)
- **[Q003] "Turing machine programs"**: Keyword nDCG (0.7453) exceeded Semantic (0.6122) and Hybrid (0.6075)
- **[Q033] ""Agent Mesh""**: Keyword nDCG (0.9197) exceeded Semantic (0.8175) and Hybrid (0.8772)

### Notable Semantic Wins (6)
- **[Q001] "Linux kernel source tree"**: Semantic nDCG (0.6764) exceeded Keyword (0.5241) and Hybrid (0.5077)
- **[Q006] "Agent Playbooks"**: Semantic nDCG (0.9907) exceeded Keyword (0.8944) and Hybrid (0.9794)
- **[Q025] "memory"**: Semantic nDCG (0.7753) exceeded Keyword (0.3903) and Hybrid (0.7516)
- **[Q026] "routing"**: Semantic nDCG (0.8839) exceeded Keyword (0.7226) and Hybrid (0.8129)
- **[Q030] ""Context Gateway""**: Semantic nDCG (1) exceeded Keyword (0.3869) and Hybrid (0.6509)

---

## 4. Query-Level Performance Table

| ID | Category | Query | KW nDCG | SEM nDCG | HYB nDCG | HYB P@10 | HYB R@10 | HYB Latency |
|---|---|---|---|---|---|---|---|---|
| `Q001` | EXACT_KEYWORD | Linux kernel source tree | 0.5241 | 0.6764 | **0.5077** | 0.2 | 1 | 562.83ms |
| `Q002` | EXACT_KEYWORD | al-Khwarizmi | 0.7453 | 0.8996 | **0.8996** | 0.2 | 1 | 493.68ms |
| `Q003` | EXACT_KEYWORD | Turing machine programs | 0.7453 | 0.6122 | **0.6075** | 0.2 | 1 | 470.86ms |
| `Q004` | EXACT_KEYWORD | Redis Intent Router | 0.9839 | 1 | **1** | 0.3 | 1 | 485.37ms |
| `Q005` | EXACT_KEYWORD | Euclid division algorithm | 0.7453 | 0.9049 | **0.9049** | 0.2 | 1 | 503.95ms |
| `Q006` | EXACT_KEYWORD | Agent Playbooks | 0.8944 | 0.9907 | **0.9794** | 0.4 | 1 | 1114.94ms |
| `Q007` | EXACT_KEYWORD | GitHub Enterprise Importer migrations | 0.834 | 1 | **1** | 0.2 | 1 | 478.17ms |
| `Q008` | EXACT_KEYWORD | Jacquard loom punch cards | 0.9173 | 0.9828 | **0.9828** | 0.1 | 1 | 486.51ms |
| `Q009` | CONCEPTUAL | how to reduce LLM inference costs and eliminate redundant prompt lookups | 0 | 0.9049 | **0.9049** | 0.2 | 1 | 456.42ms |
| `Q010` | CONCEPTUAL | difference between heuristic approaches and guaranteed algorithms | 0 | 0.9049 | **0.9049** | 0.2 | 1 | 503.5ms |
| `Q011` | CONCEPTUAL | persisting state and long-term memory in autonomous AI agents | 0 | 0.5009 | **0.5009** | 0.3 | 1 | 472.7ms |
| `Q012` | CONCEPTUAL | operating system kernel guidelines and code of conduct | 0 | 1 | **1** | 0.2 | 1 | 453.7ms |
| `Q013` | CONCEPTUAL | evaluating time and memory requirements as algorithm input increases | 0 | 0.7872 | **0.7872** | 0.1 | 0.5 | 465.8ms |
| `Q014` | CONCEPTUAL | safeguarding private personal email addresses when pushing git commits | 0 | 1 | **1** | 0.2 | 1 | 480.18ms |
| `Q015` | CONCEPTUAL | theoretical formalization of effective computability and mechanical calculation | 0 | 0.5938 | **0.5938** | 0.2 | 1 | 484.62ms |
| `Q016` | CONCEPTUAL | accessing business data from LLM agents with standardized schemas | 0 | 0.3546 | **0.3546** | 0.2 | 1 | 463.19ms |
| `Q017` | NATURAL_LANGUAGE | Where does the word algorithm come from historically? | 0 | 0.9049 | **0.9049** | 0.2 | 1 | 470.51ms |
| `Q018` | NATURAL_LANGUAGE | What documentation covers system administration for Linux kernels? | 0 | 0.9461 | **0.9461** | 0.2 | 1 | 601.01ms |
| `Q019` | NATURAL_LANGUAGE | What are the main capabilities of Redis Iris for AI developers? | 0 | 0.5807 | **0.5807** | 0.3 | 1 | 485.81ms |
| `Q020` | NATURAL_LANGUAGE | How did telephone switching machines and looms lead to modern computers? | 0 | 1 | **1** | 0.1 | 1 | 468.26ms |
| `Q021` | NATURAL_LANGUAGE | Why do AI agents need persistent context across conversations? | 0 | 0.9049 | **0.9049** | 0.2 | 1 | 475.55ms |
| `Q022` | NATURAL_LANGUAGE | How do live repository migrations minimize downtime for engineering teams? | 0 | 1 | **1** | 0.2 | 1 | 490.28ms |
| `Q023` | NATURAL_LANGUAGE | What formal models proved equivalent in algorithmic theory? | 0.7872 | 0.9324 | **0.9324** | 0.2 | 1 | 483.59ms |
| `Q024` | NATURAL_LANGUAGE | How does matching questions by meaning speed up responses? | 0 | 0.7364 | **0.7364** | 0.2 | 1 | 463.33ms |
| `Q025` | AMBIGUOUS | memory | 0.3903 | 0.7753 | **0.7516** | 0.2 | 0.6667 | 484.46ms |
| `Q026` | AMBIGUOUS | routing | 0.7226 | 0.8839 | **0.8129** | 0.2 | 0.6667 | 1561.87ms |
| `Q027` | AMBIGUOUS | migration | 1 | 1 | **1** | 0.2 | 1 | 481.05ms |
| `Q028` | AMBIGUOUS | rules | 0.5997 | 0.2624 | **0.6419** | 0.2 | 1 | 461.44ms |
| `Q029` | EXACT_PHRASE | "finite sequence of rigorous instructions" | 0 | 1 | **1** | 0.1 | 1 | 551.83ms |
| `Q030` | EXACT_PHRASE | "Context Gateway" | 0.3869 | 1 | **0.6509** | 0.2 | 1 | 532.24ms |
| `Q031` | EXACT_PHRASE | "Documentation/process/changes.rst" | 1 | 1 | **1** | 0.1 | 1 | 462.95ms |
| `Q032` | EXACT_PHRASE | "Book of Indian computation" | 1 | 1 | **1** | 0.1 | 1 | 454.29ms |
| `Q033` | EXACT_PHRASE | "Agent Mesh" | 0.9197 | 0.8175 | **0.8772** | 0.2 | 1 | 448.39ms |
| `Q034` | EXACT_PHRASE | "Jacquard loom" | 1 | 1 | **1** | 0.1 | 1 | 484.43ms |
| `Q035` | LONG_TAIL | guidelines and documentation files for academic researchers exploring Linux kernel internals | 0 | 1 | **1** | 0.2 | 1 | 481.22ms |
| `Q036` | LONG_TAIL | ancient clay tablets and division arithmetic algorithms before mechanical calculation | 0.9173 | 0.968 | **0.968** | 0.1 | 1 | 491.24ms |
| `Q037` | LONG_TAIL | persisting agent conversations and routing streams through dropped network connections with Agent Mesh | 0 | 0.6053 | **0** | 0 | 0 | 1545.61ms |
| `Q038` | LONG_TAIL | blocking command line git pushes that expose private personal email address | 0 | 1 | **1** | 0.2 | 1 | 463.01ms |
| `Q039` | LONG_TAIL | formal equivalence between lambda calculus Turing machines and general recursive functions | 0 | 0.506 | **0.506** | 0.2 | 1 | 467.05ms |
| `Q040` | LONG_TAIL | turn agent behavior into an explainable queryable record of decisions with Lens in Redis Iris | 0 | 0.6934 | **0.6934** | 0.2 | 1 | 445.65ms |
