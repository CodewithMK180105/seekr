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
