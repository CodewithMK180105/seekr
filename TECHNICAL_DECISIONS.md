# Architecture Decision Records (ADRs) — Seekr

This document records the architectural and technical decisions made during the design and development of **Seekr**.

---

## ADR 001: Monorepo Architecture with pnpm Workspaces
- **Status**: Accepted
- **Context**: The system consists of an Express API Gateway, a BullMQ background crawler/worker, a Next.js frontend, and shared domain modules. We need clean code sharing without the overhead of publishing private packages.
- **Decision**: Adopt a monorepo structure managed by `pnpm` workspaces (`apps/*` and `packages/*`).
- **Consequences**:
  - Direct TypeScript dependency resolution between `apps/api`, `apps/worker`, and `packages/shared`, `packages/types`.
  - Fast, deduplicated symlinked installations and unified lint/test execution via root scripts.

---

## ADR 002: Modular Monolith vs Microservices
- **Status**: Accepted
- **Context**: The system requires multiple processes (API server, asynchronous crawler/indexer worker, UI). Early microservice decomposition introduces network latency, distributed transactions, and deployment complexity.
- **Decision**: Adopt a **Modular Monolith** pattern.
- **Consequences**:
  - Single codebase and domain boundaries (`auth`, `sources`, `crawler`, `indexing`, `search`, `research`).
  - The API and Worker run as separate runtime processes communicating exclusively through Redis and BullMQ queues, while sharing models and database clients.

---

## ADR 003: Password Hashing using Argon2id
- **Status**: Accepted
- **Context**: Modern authentication requires high resistance to both GPU cracking and ASIC brute-force attacks.
- **Decision**: Use `argon2id` (`memoryCost = 64MB`, `timeCost = 3`, `parallelism = 1`) via native bindings.
- **Consequences**:
  - Provides state-of-the-art resistance against side-channel and memory-tradeoff attacks compared to legacy bcrypt or PBKDF2.

---

## ADR 004: Dual-Token JWT Authentication Architecture
- **Status**: Accepted
- **Context**: Stateless APIs need short-lived authorization tokens with secure revocation mechanisms.
- **Decision**:
  - **Access Token**: Signed JWT with 15-minute expiration, passed via `Authorization: Bearer <token>`.
  - **Refresh Token**: Signed JWT with 7-day expiration, stored in an `HttpOnly`, `SameSite=Lax` secure cookie (with fallback support in request body for programmatic API clients).
  - Rotation on refresh to mitigate token hijacking.

---

## ADR 005: Dual-Index Strategy for Hybrid Search (PostgreSQL + pgvector)
- **Status**: Accepted
- **Context**: Seekr requires both keyword search (exact terms, technical acronyms) and semantic search (natural language intent).
- **Decision**:
  - **Keyword Search**: Native PostgreSQL Full-Text Search with `tsvector` columns and a GIN index (`document_chunks_search_vector_gin_idx`). Ranking computed via `ts_rank_cd`.
  - **Semantic Search**: `pgvector` with 768 dimensions (optimized for Gemini `text-embedding-004`) and an **HNSW** (Hierarchical Navigable Small World) index with cosine distance (`vector_cosine_ops`).
- **Consequences**:
  - Single database engine (PostgreSQL 16) manages relational data, full-text indexes, and high-dimensional vector embeddings, eliminating distributed data sync issues between separate vector databases.
  - 768 dimensions requires 50% less RAM than 1536 dimensions, maximizing local Docker efficiency.
  - Uses dedicated external port `5435` in `docker-compose.yml` to prevent port collisions with any existing PostgreSQL services running on the host machine (default port 5432).

---

## ADR 006: Centralized Error Handling & Correlation ID Tracing
- **Status**: Accepted
- **Context**: Debugging distributed search operations requires tracing requests across middleware, controllers, and services.
- **Decision**:
  - Every incoming HTTP request is assigned or preserves an `x-request-id` correlation header.
  - Standardized error hierarchy (`AppError`, `NotFoundError`, `UnauthorizedError`, `ConflictError`, `ValidationError`).
  - Errors format into a uniform `ApiResponse<T>` contract `{ success, data, error: { code, message, details }, meta: { requestId } }`.

---

## ADR 007: Decoupled Queue Architecture (Crawler vs Indexer)
- **Status**: Accepted
- **Context**: A crawler fetching web pages is subject to network latency, server timeouts, and rate limits, while text chunking and vector embedding generation are bound by compute and LLM API rate limits. Coupling both in a single job causes failure cascades and inefficient retries.
- **Decision**: Split ingestion into two independent BullMQ queues:
  1. `seekr-crawler`: Fetches, extracts, normalizes, and commits raw document state to PostgreSQL.
  2. `seekr-indexer`: Consumes a `documentId`, executes sliding-window chunking, generates embeddings, and writes to `document_chunks`.
- **Consequences**:
  - Embedding rate limit backoff will never stall the web crawler.
  - If embedding generation fails, only the indexing job retries without re-fetching external websites.

---

## ADR 008: Document Versioning via SHA-256 Content Hashing
- **Status**: Accepted
- **Context**: Re-crawling updated websites must not produce duplicate documents, nor should it perform redundant chunking and embedding if content hasn't changed.
- **Decision**: Compute a SHA-256 hash of normalized document text:
  - If `content_hash` matches existing record: update `crawled_at` timestamp and skip indexing.
  - If `content_hash` differs: update document record, bump `updated_at`, and trigger an update indexing job that atomically replaces old chunks in a database transaction.

---

## ADR 009: SSRF Guard & Crawler Safety Policy
- **Status**: Accepted
- **Context**: Crawling arbitrary user-submitted URLs exposes internal network services (like Redis on 6379, Postgres on 5432/5435, or cloud metadata endpoints `169.254.169.254`) to Server-Side Request Forgery (SSRF).
- **Decision**: Perform pre-fetch DNS resolution and strictly block RFC 1918 private IP ranges, loopbacks (`127.0.0.1`, `::1`), link-local IPs, and cloud metadata IPs. Respect `robots.txt` disallow rules and crawl-delay directives.

---

## ADR 010: Shift-Left Frontend Integration
- **Status**: Accepted
- **Context**: Deferring frontend development to the final phase creates high risk of integration mismatch and poor visibility during backend development.
- **Decision**: Scaffold the Next.js frontend (`apps/web`) in Phase 2 alongside ingestion APIs, providing a live dashboard for sources and crawl jobs.

---

## ADR 011: Sentence-Boundary Sliding-Window Chunking & Dual Representation
- **Status**: Accepted
- **Context**: Raw document text must be partitioned into searchable units for both dense vector retrieval and sparse full-text lexical ranking. Naive character or token slicing cuts sentences and technical words in half, destroying semantic coherence and corrupting keyword queries.
- **Decision**:
  1. **Sliding-Window Sentence Chunker**: Token-aware chunking ($300\text{--}500$ tokens, 40-token overlap) that strictly preserves sentence boundaries (`packages/shared/src/chunker.ts`).
  2. **Contextual Title Grounding**: Chunk embeddings are generated from `${doc.title}\n\n${chunk.content}`, preventing isolated paragraphs from losing their document subject matter.
  3. **Dual Representation**:
     - **Semantic Vector**: 768-dimensional dense vector (`vector(768)`) with HNSW cosine index.
     - **Lexical `tsvector`**: PostgreSQL `tsvector` with weighted fields — document title has weight `'A'` and chunk content has weight `'B'` (`setweight(...)`).
  4. **Atomic Upsert Transactions**: On update (`isUpdate = true`), existing chunks are deleted and new chunks are inserted within an explicit `prisma.$transaction`, with `ON CONFLICT ("document_id", "chunk_index")` upsert logic preventing duplicate chunks.
- **Consequences**:
  - Eliminates semantic context fragmentation across chunk boundaries.
  - Title weighting substantially boosts BM25 / `ts_rank_cd` search precision in Phase 4.
  - Guarantees database consistency even if worker instances crash mid-job.

---

## ADR 012: Reciprocal Rank Fusion (RRF) for Hybrid Search Fusion
- **Status**: Accepted
- **Context**: In hybrid search, lexical retrieval (`ts_rank_cd`) and vector retrieval (cosine similarity) return scores that are fundamentally incompatible in distribution and scale. Linear weighted combinations (e.g. $\alpha \cdot \text{lexical} + \beta \cdot \text{vector}$) suffer from score drift across queries, require dataset-dependent tuning of hyperparameters, and are vulnerable to outliers.
- **Decision**: Adopt Reciprocal Rank Fusion (RRF) with constant $k = 60$:
  $$RRF(d) = \sum_{m \in \mathcal{M}} \frac{1}{60 + rank_m(d)}$$
  - RRF operates exclusively on ordinal rank positions rather than raw uncalibrated scores.
  - Documents appearing in both result lists receive accumulated reciprocal ranks, naturally elevating consensus matches.
  - Results are deduplicated by `chunkId`, ties in RRF score are broken deterministically by `chunkId ASC`, and retriever provenance (`matchedBy: { keyword, vector }`, `keywordRank`, `vectorRank`) is preserved.
- **Consequences**:
  - Robust, scale-invariant fusion without manual calibration across varying query types.
  - Transparent debugging and evaluation through preserved retriever provenance.

---

## ADR 013: Post-Fusion Pagination & Graceful Degradation Strategy
- **Status**: Accepted
- **Context**: Paginating lexical and vector results independently before fusion causes rank truncation and unstable pagination. Furthermore, vector retrieval relies on external embedding providers (e.g. Gemini API), which may encounter network blips, rate limits, or quota exhaustion.
- **Decision**:
  1. **Post-Fusion Pagination**: Retrievers fetch a candidate depth ($K = \min(100, \max(\text{page} \times \text{limit} + 20, 50))$) to ensure adequate ranking depth before applying RRF and deduplication. Slicing for pagination (`offset = (page - 1) * limit`) occurs strictly after ranking.
  2. **Graceful Degradation**: In `HYBRID` mode, retrievers execute concurrently via `Promise.allSettled`. If vector retrieval fails, keyword results are returned seamlessly with `degraded: true, degradedReason: 'Vector retriever failed'`. If keyword retrieval fails, vector results are returned with `degraded: true`. User search never hard-crashes on single-provider failure.
- **Consequences**:
  - Stable pagination guarantees consistent result ordering across pages.
  - Production resilience against third-party AI provider outages.

---

## ADR 014: Search Observability, Asynchronous Non-Blocking Query Logging, Click Feedback & Database-Level Analytics
- **Status**: Accepted
- **Context**: Understanding search usage, retrieval latency, click behavior, and search quality requires real-time query logging and telemetry. However, logging database writes must not add latency to user search responses, click tracking must ensure provenance integrity (preventing clicks on unretrieved chunks), and analytics queries over millions of events must not load raw rows into Node.js application memory.
- **Decision**:
  1. **Non-Blocking Query Logging (`SearchLoggingService`)**: `search_queries` and top result impressions (`search_results`) are persisted asynchronously via a fire-and-forget promise that is not awaited in the main search response path. Any logging errors are caught and logged as warnings, guaranteeing that logging issues never degrade user search requests.
  2. **Fast Autocomplete without LLMs (`SearchSuggestionsService`)**: Suggestions query document titles (`documents.title ILIKE prefix%`) and historical searches (`search_queries.normalized_query LIKE prefix%`) using PostgreSQL B-tree indexes. Bounded at 10 results, deduplicated case-insensitively, with minimum 2 characters prefix, avoiding the latency and financial cost of LLMs or embedding generation.
  3. **Idempotent Click Provenance Verification (`SearchFeedbackService`)**: On `POST /api/v1/search/feedback`, the service verifies that `searchQueryId` exists and that `chunkId` was part of the logged result set for that search. Clicks update `clicked = true` and `clicked_at = COALESCE(clicked_at, NOW())`, ensuring subsequent clicks do not overwrite the initial timestamp.
  4. **Database-Level Analytics Aggregation (`SearchAnalyticsService`)**: Analytics calculations execute entirely inside PostgreSQL using SQL aggregations:
     - Latency percentiles: `PERCENTILE_CONT(0.50)` and `PERCENTILE_CONT(0.95)` within group.
     - Search CTR: `(searches with >= 1 clicked result / total searches) * 100`.
     - Result CTR: `(total clicks / total impressions) * 100`.
     - Zero-result queries and search mode distributions.
     - Zero application memory overhead regardless of search event volume.
- **Consequences**:
  - Zero search latency overhead from query and click logging.
  - Robust protection against fraudulent or invalid click feedback payloads.
  - Real-time visibility into retrieval performance, zero-result gaps, and user interaction metrics.

---

## ADR 015: Search Quality Evaluation & Benchmark Suite
- **Status**: Accepted
- **Context**: A search engine combining lexical (BM25 / `ts_rank_cd`), semantic (dense vector cosine similarity via pgvector), and hybrid (RRF) retrieval strategies needs empirical, objective evaluation. Without an automated benchmark suite, regression detection across algorithm changes, embedding provider migrations, and index parameter tuning is impossible. The evaluation system must measure ranking quality (Precision@K, Recall@K, MRR, nDCG@K) against verified corpus ground truth, record monotonic latencies (P50, P95) without caching bias, avoid contaminating behavioral analytics data, and operate directly through production retrieval services without code duplication.
- **Decision**:
  1. **Corpus-Grounded Benchmark Dataset (`benchmark-v1.json`)**: 40 evaluation queries stratified across 6 distinct linguistic and semantic query categories (`EXACT_KEYWORD`, `CONCEPTUAL`, `NATURAL_LANGUAGE`, `AMBIGUOUS`, `EXACT_PHRASE`, `LONG_TAIL`). Ground-truth relevance is curated directly against actual indexed PostgreSQL chunks using graded relevance scales ($0 = \text{irrelevant}, 1 = \text{weakly relevant}, 2 = \text{relevant}, 3 = \text{highly relevant}$).
  2. **Standard Information Retrieval (IR) Metrics Suite (`metrics.ts`)**: Pure, independently tested mathematical functions:
     - **Precision@10**: Proportion of top-10 retrieved chunks that are relevant ($relevance \ge 1$).
     - **Recall@10**: Proportion of all ground-truth relevant chunks ($relevance \ge 1$) retrieved in top 10.
     - **MRR (Mean Reciprocal Rank)**: $\frac{1}{rank_{first}}$ where $rank_{first}$ is the position of the first relevant chunk ($relevance \ge 2$), or 0 if none found.
     - **nDCG@10 (Normalized Discounted Cumulative Gain)**: $DCG@10 = \sum_{i=1}^{10} \frac{2^{rel_i} - 1}{\log_2(i + 1)}$ normalized by ideal $IDCG@10$.
  3. **Production Pipeline Execution (`SearchService` integration)**: The benchmark runner invokes the exact production `SearchService.search()` implementation sequentially across `KEYWORD`, `SEMANTIC`, and `HYBRID` modes. To prevent benchmark execution from skewing production user analytics and search suggestions, a `disableLogging: true` flag was introduced to bypass `SearchLoggingService`.
  4. **Monotonic High-Resolution Latency Measurement (`performance.now()`)**: Queries execute sequentially with a dedicated warm-up run per mode, followed by timed execution using Node.js `performance.now()`. Computes P50, P95, mean, min, and max latencies.
  5. **Automated Dual-Format Reporting (`reporter.ts`) & CLI (`cli.ts`)**: Results are exported to timestamped JSON (for automated ingestion/CI) and formatted Markdown (for human review) in `evaluation/reports/`, with executive summary tables, per-category breakdowns, query-level performance tables, and comparative insights.
- **Consequences**:
  - Provides empirical baselines: `SEMANTIC` and `HYBRID` achieve $>0.82$ nDCG@10 and $>0.94$ Recall@10, while `KEYWORD` provides sub-5ms latency ($3.17\text{ms}$ P50) and dominates on exact token matches ($0.7987$ nDCG@10 on `EXACT_KEYWORD`), but fails on conceptual/natural queries.
  - Zero divergence between production search and evaluation search.
  - Fully isolated from user query logs and analytics tables.

---

## ADR 016: Vendor-Agnostic LLM Provider Strategy & Factory
- **Status**: Accepted
- **Context**: RAG research synthesis requires executing generation requests against frontier LLMs. Directly coupling application modules to a specific vendor SDK (e.g. Google Generative AI or OpenAI) introduces vendor lock-in, bloats dependencies, complicates offline/mock testing, and prevents seamless failover.
- **Decision**:
  1. **Normalized Provider Contract (`packages/shared/src/llm/types.ts`)**: Define a uniform `LlmProvider` interface with normalized request schemas (`LlmGenerateRequest`), response payloads (`LlmGenerateResponse`), token usage metadata (`LlmUsageMetadata`), and finish reasons (`stop`, `length`, `content_filter`, etc.).
  2. **Native Lightweight REST Clients**: Implement `GeminiLlmProvider` and `OpenAILlmProvider` using native `fetch` with `AbortController` timeout controls and exponential backoff retry on HTTP 429 and 503 errors, avoiding heavy external SDK dependencies.
  3. **Deterministic Mock Provider (`MockLlmProvider`)**: Provide an offline mock implementation capable of configurable synthetic replies, error injection, latency simulation, and token estimation.
  4. **Dynamic Factory & Extensible Registry (`factory.ts`)**: Provider selection resolved at runtime via environment variables (`LLM_PROVIDER`, `GEMINI_API_KEY`, `OPENAI_API_KEY`) with fallback to `MockLlmProvider` and support for custom provider registration via `registerLlmProvider`.
- **Consequences**:
  - Research modules are completely decoupled from external LLM vendors.
  - Zero heavyweight vendor SDK dependencies in the codebase.
  - Fast, deterministic offline testing without external API calls or billing costs.

---

## ADR 017: Multi-Layered Prompt Injection Defense, Token Budgeting & Grounded Context Assembly
- **Status**: Accepted
- **Context**: In RAG systems, retrieved web documents are untrusted user/web data that may contain malicious prompt injections, jailbreaks, or instruction overrides. Furthermore, LLM context windows are bounded, and naive context concatenation risks context overflow errors, truncated outputs, and ungrounded hallucinations.
- **Decision**:
  1. **Multi-Layered Injection Defense in Depth (`injection-guard.ts`)**:
     - *Structural Separation (Primary)*: Trusted system instructions are passed via out-of-band `systemInstruction` parameters, isolating instructions from untrusted data prompts.
     - *Syntactic Boundary Isolation*: Chunks are encapsulated in `<source id="[n]" ...>` XML tags. Any internal closing tags (e.g. `</source>`) are escaped to `&lt;/source&gt;`.
     - *Inert Data Framing*: Retrieved documents are strictly wrapped in `[BEGIN SEARCH RETRIEVAL CONTEXT - UNTRUSTED DATA ONLY]` and `[END SEARCH RETRIEVAL CONTEXT]` boundaries instructing the model to treat content purely as inert factual data.
     - *Heuristic Precautionary Scanning*: Scans for instruction overrides, jailbreaks, persona hijacks, and fake system tags. Flagged chunks receive an in-context security notice rather than being discarded, ensuring articles legitimately discussing security can still be analyzed.
  2. **Conservative Token Budgeting & Boundary Truncation (`token-counter.ts`, `context-assembler.ts`)**:
     - Uses a documented conservative estimator: $\lceil \text{length} / 3.8 \rceil$ tokens.
     - Upfront reservations deduct system prompt tokens, user query tokens, response budget (default 1024), safety margin (default 100), and framing overhead from total context capacity.
     - Oversized chunks are truncated deterministically with truncation markers while strictly preserving closing XML tags.
  3. **Groundedness & Insufficient-Context Safeguards (`context-assembler.ts`, `research.service.ts`)**:
     - Every assembled source maintains full citation traceability (`citationId: [1]`, `chunkId`, `title`, `url`, `rank`, `score`).
     - When retrieval yields 0 results or top scores fall below `minRelevanceScore`, the system immediately returns an explicit insufficient-evidence disclaimer without executing the LLM, eliminating hallucination risks.
- **Consequences**:
  - Robust multi-layered protection against prompt injection and boundary breakout attacks.
  - Provable adherence to token budgets with zero context-window overflow errors.
  - Verifiable citation mapping from generated text back to crawled PostgreSQL chunks.

---

## ADR 018: Research REST APIs, Server-Sent Events (SSE) Streaming & Verifiable Citation Post-Processing
- **Status**: Accepted
- **Context**: Grounded RAG synthesis in Seekr requires exposing both synchronous and real-time streaming endpoints for interactive consumption, persisting research sessions for historical auditability and source inspection, and guaranteeing citation veracity. Raw LLM responses may hallucinate nonexistent citation indices (e.g. `[99]`), misattribute statements, or omit supporting evidence. Furthermore, real-time client consumption demands standard SSE streaming with graceful client disconnect handling and zero fake token buffering.
- **Decision**:
  1. **Dual Research Endpoints (`research.controller.ts`, `research.routes.ts`)**:
     - `POST /api/v1/research`: Synchronous RAG synthesis validating input via Zod (`query`, `mode`, `maxSources`, `temperature`), executing hybrid search retrieval, assembling injected-defended context, generating LLM synthesis, running citation post-processing, persisting to `research_sessions`, and returning structured `ApiResponse<ResearchResponse>`.
     - `POST /api/v1/research/stream`: Server-Sent Events (SSE) endpoint setting standard SSE headers (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`), emitting sequential events: `sources` -> incremental `token` -> `citations` -> `complete` (or `error`).
     - Session persistence is performed upon stream completion, ensuring that stream consumers obtain an immutable persisted session ID.
  2. **Express & Node.js HTTP Streaming Abort Safety**:
     - Monitored response termination using `res.on('close', ...)` rather than `req.on('close')`, as `req.on('close')` fires prematurely upon request body consumption in standard Node.js HTTP servers.
     - Linked an `AbortController` signal to `res.on('close')` when `!res.writableEnded`, cleanly canceling pending LLM stream loops and DB transactions on client disconnect without leaking memory.
  3. **Verifiable Citation Post-Processing (`citation-post-processor.ts`)**:
     - Extracts inline citations (`[n]`) and maps them to assembled source chunks.
     - Sentence segmentation isolates claiming sentences and links them to cited sources.
     - Exact excerpt extraction: computes word-token overlap between claim sentences and source chunk text, locating and extracting the highest-scoring supporting sentence excerpt from the source chunk.
     - Citation validity verification: flags invalid citations where index $n$ exceeds available sources (`isValid: false`, `reason: 'Out of bounds'`), verifies supporting overlap threshold, and identifies unused sources (`cited: false`).
     - Aggregate citations deduplicated by `citationIndex` while preserving all associated claim sentences.
  4. **Relational Persistence Layer (`research_sessions` table, `research.repository.ts`)**:
     - Created `ResearchSession` Prisma model with UUID primary key, `query`, `normalized_query`, `answer`, `search_mode`, `token_budget`, `metadata` (JSONB), `sources` (JSONB snapshot), `citations` (JSONB snapshot), optional `user_id` foreign key, and monotonic `latency_ms`.
     - PostgreSQL indexes added on `user_id`, `created_at`, `search_mode`, and `normalized_query` for fast lookups.
     - Exposed session retrieval endpoints: `GET /api/v1/research/:id` and `GET /api/v1/research/:id/sources` with strict 400 validation on non-UUID format and 404 on nonexistent sessions.
- **Consequences**:
  - Provides deterministic, verifiable citations connecting LLM claims to crawled PostgreSQL chunks.
  - Enables low-latency interactive streaming UX via SSE with robust client-abort cleanup.
  - Complete historical persistence of research queries, answers, verified citations, and source snapshots.

---

## ADR 019: Multi-Tier Hybrid Caching Architecture with pgvector Semantic Matching & Redis L1/L3
- **Status**: Accepted
- **Context**: As query traffic scales, repeated search and LLM research requests impose high latency (hundreds of ms for vector search, multiple seconds for LLM generation) and exhaust external API rate limits (such as Gemini API free-tier quotas). Traditional exact-match caching misses queries that share identical intent but differ in phrasing (e.g., *"What is Redis persistence?"* vs *"Explain Redis persistence mechanism"*).
- **Decision**:
  1. **Three-Tier Hybrid Cache Hierarchy**:
     - *Level 1 (Exact Match, Redis)*: $\mathcal{O}(1)$ key lookup by normalized query hash (`seekr:cache:exact:<type>:<mode>:<hash>`). Responds in $< 1\text{ms}$ with zero vector compute.
     - *Level 2 (Semantic Similarity, PostgreSQL pgvector HNSW)*: Evaluates cosine similarity $1 - (\text{embedding} \Leftrightarrow v_Q) \ge \text{threshold}$ (default 0.95 for search, 0.96 for research synthesis). Retrieves cached payload and increments `hit_count` in $< 5\text{ms}$. Backfills L1 Redis on hit so repeated queries hit L1.
     - *Level 3 (Vector Embedding Cache, Redis)*: Caches 768-dim float embeddings (`seekr:cache:emb:<provider>:<hash>`) with a 7-day TTL via `CachedEmbeddingProvider`, eliminating duplicate calls to upstream embedding APIs.
  2. **Non-Degraded Caching Invariant**:
     - Search responses marked with `degraded: true` (e.g. when one retriever fails due to network/DB timeout) are strictly excluded from being stored in the cache.
  3. **Operational Endpoints & Controls**:
     - `skipCache` parameter supported on search and research endpoints (`?skipCache=true` or `Cache-Control: no-cache`).
     - Cache management REST endpoints: `GET /api/v1/cache/stats`, `POST /api/v1/cache/clear`, `POST /api/v1/cache/cleanup`.
- **Consequences**:
  - Over 95% latency reduction on semantically equivalent queries.
  - Complete elimination of rate limit quota exhaustion for repeated query embeddings.
  - Safe, deterministic cache invalidation and TTL expiration.
