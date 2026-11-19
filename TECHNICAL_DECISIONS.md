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
