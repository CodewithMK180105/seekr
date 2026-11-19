# Development Progress — Seekr

Tracking implementation status across development milestones.

---

## Overall Status
- **Current Phase**: Phase 4 — Hybrid Search Engine & Evaluation (Milestone 4.1 Completed)
- **Next Milestone**: Milestone 4.2 — Keyword Retrieval (PostgreSQL ts_rank_cd, websearch_to_tsquery, GIN)
- **Automated Tests**: 75 / 75 Passing across 14 test suites (Unit, Integration & API)

---

## Milestone Breakdown

### Phase 1: Foundation & Core Infrastructure ✅
- [x] Monorepo workspace configuration (`pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json`).
- [x] `.env.example` and local `.env` configuration template.
- [x] Docker Compose configuration for PostgreSQL (`pgvector/pgvector:pg16` on port 5435) and Redis (`redis:7-alpine`).
- [x] Shared TypeScript definitions package (`@seekr/types`).
- [x] Shared infrastructure & utilities package (`@seekr/shared`).
  - [x] Argon2id password hashing and verification.
  - [x] Dual-token JWT access & refresh token signing and verification.
  - [x] Standard typed error hierarchy (`AppError`, `NotFoundError`, `UnauthorizedError`, `ConflictError`, `ValidationError`).
  - [x] Zod validation schemas for auth, sources, and search queries.
  - [x] Database client singleton (`PrismaClient`) and Redis client singleton (`ioredis`).
- [x] Relational database schema with pgvector (`prisma/schema.prisma`).
  - [x] Initial SQL migration with tables, foreign keys, GIN text search index, and HNSW cosine vector index (`prisma/migrations/0_init/migration.sql`).
  - [x] Prisma client generation verified.
- [x] Express REST API Gateway (`apps/api`).
  - [x] Centralized error handler with unified `ApiResponse` format.
  - [x] Request correlation ID tracking (`x-request-id`) and latency logging.
  - [x] JWT authentication middleware (`requireAuth`).
  - [x] System liveness endpoint (`GET /health`).
  - [x] System readiness endpoint (`GET /ready`).
  - [x] Authentication endpoints (`POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`).
- [x] Background Worker placeholder (`apps/worker`).
- [x] Automated test suites with Vitest & Supertest (27 tests passing).
- [x] Architecture Decision Records recorded in `TECHNICAL_DECISIONS.md`.

---

### Phase 2: Content Ingestion & Job Orchestration ✅
- [x] Queue infrastructure: BullMQ decoupled queues (`seekr-crawler` vs `seekr-indexer`) with shared Redis connection.
- [x] Source management REST APIs (`POST /api/v1/sources`, `GET /sources`, `GET /sources/:id`, `PATCH /sources/:id`, `DELETE /sources/:id`).
- [x] Crawl job trigger & tracking APIs (`POST /api/v1/crawl-jobs` returning HTTP 202 Accepted, `GET /crawl-jobs`, `GET /crawl-jobs/:id`, `POST /crawl-jobs/:id/retry`).
- [x] SSRF guard service (`packages/shared/src/ssrfGuard.ts`) with pre-fetch DNS resolution blocking private IPv4/IPv6, loopbacks, and cloud metadata.
- [x] Robots.txt compliance service (`apps/worker/src/services/robotsService.ts`) with crawl delay and disallow caching.
- [x] HTML content extraction (`apps/worker/src/services/contentExtractor.ts`) using Cheerio for clean text, title, and link discovery.
- [x] Text normalization & SHA-256 content hashing (`apps/worker/src/services/normalizer.ts`).
- [x] Explicit document persistence: committed to PostgreSQL (`documents` table) before any chunking/indexing.
- [x] Document version management & re-indexing: SHA-256 hash comparison (skip unchanged, update & re-index changed).
- [x] Early Frontend scaffolding (`apps/web` with Next.js 14, Tailwind CSS, and dashboard page).
- [x] Unit & integration test suites:
  - `packages/shared/src/__tests__/ssrfGuard.test.ts` (6 tests)
  - `apps/worker/src/__tests__/extractor.test.ts` (2 tests)
  - `apps/api/src/__tests__/sources.test.ts` (4 tests)
  - `apps/api/src/__tests__/crawler.test.ts` (4 tests)
- [x] Recorded ADRs 007 through 010 in `TECHNICAL_DECISIONS.md`.

---

### Phase 3: Content Processing & Search Indexing ✅
- [x] Sliding-window chunking (`packages/shared/src/chunker.ts`): sentence-boundary aware, 300–500 tokens with 40-token overlap.
- [x] Embedding Provider Strategy (`packages/shared/src/embeddings/`):
  - [x] `EmbeddingProvider` interface with batch embedding support.
  - [x] `GeminiEmbeddingProvider`: Google `text-embedding-004` (768-dim) with sub-batching (max 50) and exponential backoff retry.
  - [x] `OpenAIEmbeddingProvider`: OpenAI `text-embedding-3-small` (1536-dim).
  - [x] `MockEmbeddingProvider`: Deterministic L2-normalized 768-dim vector fallback for offline and local testing.
  - [x] `getEmbeddingProvider()` factory selecting provider via `.env` configuration.
- [x] BullMQ `seekr-indexer` worker (`apps/worker/src/processors/indexProcessor.ts`):
  - [x] Fetches document from PostgreSQL.
  - [x] Generates sliding-window chunks with title grounding.
  - [x] Batch generates dense vector embeddings.
  - [x] Atomic transaction: cleans stale chunks when `isUpdate = true`, and inserts chunks into `document_chunks`.
  - [x] Dual representation: `embedding vector(768)` (HNSW cosine index) and `search_vector tsvector` (GIN index with weighted title 'A' and content 'B').
- [x] Background Worker orchestration (`apps/worker/src/worker.ts`): concurrent crawl and index workers with graceful shutdown.
- [x] Live database verification: all 13 crawled documents indexed into 31 searchable chunks in PostgreSQL.
- [x] Automated test suites:
  - `packages/shared/src/__tests__/chunker.test.ts` (5 tests)
  - `packages/shared/src/__tests__/embeddings.test.ts` (5 tests)
  - `apps/worker/src/__tests__/indexer.test.ts` (2 tests)
- [x] Recorded ADR 011 in `TECHNICAL_DECISIONS.md`.

---

### Phase 4: Hybrid Search Engine & Evaluation
- [x] **Milestone 4.1: Search Foundation & Types**:
  - [x] Search domain types (`Retriever`, `RankedSearchResult`, `FusedSearchResult`, `SearchResponse`, `SearchPagination`).
  - [x] Zod validation schemas (`searchQuerySchema`, `suggestionsQuerySchema`, `searchFeedbackSchema`).
  - [x] Database migration: Added `clicked` and `clicked_at` to `search_results` table for click tracking and CTR analytics.
  - [x] Search module skeleton (`search.routes.ts`, `search.controller.ts`, mounted at `/api/v1/search`).
  - [x] Automated unit and API integration tests (20 new tests: 13 schema tests, 7 API foundation tests).
- [ ] Milestone 4.2: Keyword search retrieval via `ts_rank_cd` and `websearch_to_tsquery`.
- [ ] Milestone 4.3: Semantic vector search retrieval via `pgvector` cosine distance.
- [ ] Milestone 4.4: Reciprocal Rank Fusion (RRF with $k=60$) implementation and fallback handling.
- [ ] Milestone 4.5: Search pagination and candidate windowing.
- [ ] Milestone 4.6: Autocomplete search suggestions.
- [ ] Milestone 4.7: Search analytics and click tracking (`/api/v1/analytics/search`, `/api/v1/search/feedback`).
- [ ] Milestone 4.8: Search Quality Evaluation Benchmark Dataset (30–50 queries, Precision@10, Recall@10, MRR, nDCG@10, latency p50/p95).

---

### Phase 5: RAG Research Engine
- [ ] Context retrieval and assembly (Reverse Packing).
- [ ] LLM integration for synthesis (Gemini Flash / OpenAI).
- [ ] Verifiable citation mapping to source chunks.
- [ ] Untrusted prompt injection safeguards.

---

### Phase 6: Optimization & Observability
- [ ] Redis search caching and cache invalidation.
- [ ] API rate limiting.
- [ ] Benchmark suite (Precision@10, Recall@10, MRR, nDCG@10, latency p50/p95).

---

### Phase 7: Frontend & Deployment
- [ ] Next.js search UI with Tailwind CSS and shadcn/ui.
- [ ] Streaming RAG response rendering with citations.
- [ ] Production Docker compose and deployment documentation.
