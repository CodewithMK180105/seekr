# Project Master Context — Seekr
## AI-Powered Hybrid Search & Research Engine

## 1. Project Overview

I am building a production-oriented AI-powered Hybrid Search and Research Engine called **Seekr**.

The objective is to build a search platform that retrieves relevant information from multiple indexed websites and generates contextual answers using Retrieval-Augmented Generation (RAG).

This is not intended to be a simple chatbot or a basic CRUD application.

The project should demonstrate strong software engineering fundamentals, including:

- Backend architecture and API design.
- Web crawling and content extraction.
- Text processing and indexing.
- Keyword-based information retrieval.
- Vector-based semantic search.
- Hybrid search and ranking algorithms.
- Asynchronous background processing.
- Database optimization.
- Caching and rate limiting.
- RAG and LLM integration.
- Testing, deployment and observability.

The project is being developed as a portfolio project targeting SDE-I opportunities.

## 2. Problem Statement

Traditional keyword-based search engines primarily retrieve documents based on matching terms.

However, users frequently search using natural language or different terminology from what appears in the original documents.

For example:

User query:
"How does Redis recover data after an unexpected server crash?"

The indexed document might contain:

"Redis supports AOF persistence, which records write operations and allows the dataset to be reconstructed during recovery."

A traditional keyword search might not rank this document highly.

Seekr should combine:

1. Keyword-based retrieval.
2. Semantic vector-based retrieval.
3. Hybrid ranking.
4. RAG-based answer generation.

The system should return relevant documents and generate answers with verifiable source citations.

## 3. Technology Stack

Use the following technology stack.

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui

### Backend
- Node.js
- Express.js
- TypeScript
- REST APIs

### Database
- PostgreSQL
- pgvector extension
- Prisma ORM
- Raw SQL for advanced PostgreSQL search queries.

### Background Processing
- Redis
- BullMQ

### Web Crawling and Content Processing
- Axios or native fetch
- Cheerio
- Mozilla Readability where appropriate
- JSDOM where required
- Node.js crypto for SHA-256 content hashing.

### AI and Search
- An embedding model API.
- An LLM API for answer generation.
- PostgreSQL Full-Text Search.
- pgvector for vector similarity search.
- Reciprocal Rank Fusion (RRF) for hybrid ranking.

### Testing
- Vitest
- Supertest
- Playwright
- k6 for performance testing.

### Infrastructure
- Docker
- Docker Compose
- Git and GitHub
- AWS or another suitable cloud deployment platform.

Do not introduce additional technologies without explaining why they are necessary.

## 4. Core System Architecture

Use a **Modular Monolith Architecture**.

Do not introduce microservices initially.

The backend should have separate API and background worker processes while sharing the same codebase and domain modules.

The application consists of the following major components:

### A. Frontend
Responsible for:
- Search interface.
- Search suggestions.
- Search result listings.
- Pagination.
- Source information.
- AI-generated answers.
- Citation links.
- Search history.
- Basic user authentication.

### B. Express API Server
Responsible for:
- Authentication.
- Request validation.
- Search requests.
- Search orchestration.
- Source management.
- Crawl job management.
- Research requests.
- Rate limiting.
- Error handling.

### C. Crawler
Responsible for:
- Fetching website content.
- Extracting relevant text.
- Removing unwanted HTML and navigation elements.
- Canonicalizing URLs.
- Detecting duplicate content.
- Calculating SHA-256 content hashes.

Initially support:
- Wikipedia through its API.
- GitHub through its API.
- Official technical documentation.
- Selected publicly accessible websites that permit crawling.

Respect robots.txt, website terms, API limits and domain-specific rate limits.

Implement URL validation and SSRF protection. Never allow arbitrary internal network access through crawler URLs.

### D. Content Processing Pipeline

The pipeline should follow:

Fetch → Extract → Normalize → Deduplicate → Chunk → Generate Embeddings → Index → Store.

Content should be processed asynchronously through BullMQ.

### E. Keyword Search Engine

Use PostgreSQL Full-Text Search.

Implement:
- Text search vector generation.
- GIN indexing.
- Query processing.
- Ranking.
- Pagination.

Do not incorrectly describe PostgreSQL ts_rank_cd as BM25.

### F. Semantic Search Engine

Use pgvector.

Implement:
- Query embedding generation.
- Stored document chunk embeddings.
- Cosine similarity search.
- Vector indexing using HNSW when appropriate.

### G. Hybrid Search Engine

Combine keyword and semantic search results using Reciprocal Rank Fusion.

Use the following formula:

RRF(d) = Σ 1 / (k + rank(d))

Use k = 60 initially.

Implement RRF in TypeScript as an independent, testable service.

Ensure duplicate chunks are merged correctly.

### H. RAG Research Engine

The RAG pipeline should follow:

User Query → Query Embedding → Hybrid Retrieval → Ranking → Context Construction → LLM → Answer with Citations.

Important requirements:

- Generate answers only using retrieved context.
- Include source URLs and document titles.
- Map every citation to an actual retrieved document or chunk.
- Do not allow the LLM to invent citations.
- Handle insufficient evidence.
- Handle LLM provider failures.
- Treat crawled content as untrusted data and protect against prompt injection.

## 5. Database Design

Use PostgreSQL as the primary database.

The initial logical schema should contain:

### users
- id
- email
- password_hash
- created_at
- updated_at

### sources
- id
- name
- base_url
- source_type
- status
- created_at
- updated_at

### documents
- id
- source_id
- url
- title
- content
- content_hash
- language
- crawled_at
- updated_at

### document_chunks
- id
- document_id
- chunk_index
- content
- embedding
- search_vector
- token_count
- created_at

### crawl_jobs
- id
- source_id
- created_by
- status
- pages_processed
- pages_failed
- retry_count
- error_message
- started_at
- completed_at
- created_at

### search_queries
- id
- user_id
- query
- search_mode
- result_count
- latency_ms
- created_at

### search_results
- id
- search_query_id
- chunk_id
- result_rank
- fused_score

### api_keys
- id
- user_id
- key_hash
- expires_at
- created_at

This is the initial logical model. You may recommend changes if there is a clear technical justification.

Use:
- Foreign keys.
- Appropriate unique constraints.
- B-tree indexes.
- GIN indexes for full-text search.
- HNSW indexes for vector search when justified.

Use Prisma for standard relational operations and SQL migrations for PostgreSQL-specific features.

Store API keys and credentials securely. Never store plaintext API keys or passwords.

## 6. API Design

Use versioned REST APIs under `/api/v1`.

### Authentication
- POST /auth/register
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- GET /auth/me

### Sources
- POST /sources
- GET /sources
- GET /sources/:id
- PATCH /sources/:id
- DELETE /sources/:id

### Crawling
- POST /crawl-jobs
- GET /crawl-jobs
- GET /crawl-jobs/:id
- POST /crawl-jobs/:id/retry

### Search
- GET /search
- GET /search/suggestions
- GET /search/:id
- POST /search/feedback

### Research
- POST /research
- GET /research/:id
- GET /research/:id/sources

### System
- GET /health
- GET /ready
- GET /metrics

Use Zod for request validation, centralized error handling, structured logging, request IDs and appropriate HTTP status codes.

Crawl job creation should return HTTP 202 Accepted rather than waiting for processing to complete.

## 7. Expected Backend Folder Structure

Use a clean, modular structure.

```text
seekr/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/
│   │       ├── components/
│   │       ├── hooks/
│   │       └── lib/
│   │
│   ├── api/
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/
│   │       │   ├── users/
│   │       │   ├── sources/
│   │       │   ├── crawler/
│   │       │   ├── indexing/
│   │       │   ├── search/
│   │       │   ├── research/
│   │       │   └── analytics/
│   │       ├── infrastructure/
│   │       ├── middleware/
│   │       ├── config/
│   │       ├── routes/
│   │       └── server.ts
│   │
│   └── worker/
│       └── src/
│           ├── processors/
│           ├── jobs/
│           └── worker.ts
│
├── packages/
│   ├── shared/
│   ├── types/
│   └── config/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── docker-compose.yml
├── .env.example
└── README.md
```

This is a suggested structure. Keep it practical and avoid unnecessary abstraction.

## 8. Development Roadmap

Implement the project incrementally.

### Phase 1: Foundation
- Initialize frontend and backend.
- Configure PostgreSQL and Redis.
- Configure Docker Compose.
- Set up Prisma.
- Implement authentication.
- Create initial database migrations.
- Implement health endpoints.

### Phase 2: Content Ingestion
- Implement source registration.
- Build the crawler.
- Implement HTML extraction.
- Implement text normalization.
- Implement URL canonicalization.
- Implement duplicate detection.
- Configure BullMQ and Redis workers.
- Implement crawl job tracking.

### Phase 3: Content Processing and Indexing
- Implement chunking.
- Integrate embedding provider.
- Store embeddings.
- Implement PostgreSQL full-text indexing.
- Implement GIN and vector indexes.
- Test indexing and re-indexing.

### Phase 4: Search Engine
- Implement keyword search.
- Implement semantic search.
- Implement RRF.
- Implement result deduplication.
- Implement pagination.
- Implement autocomplete.
- Build search API and frontend.

### Phase 5: RAG Integration
- Implement context retrieval.
- Integrate LLM.
- Generate contextual answers.
- Implement citation mapping.
- Handle insufficient context.
- Add error handling.

### Phase 6: Optimization
- Redis caching.
- Cache invalidation.
- Rate limiting.
- Worker retries.
- Idempotency.
- Unit and integration tests.
- Search performance benchmarking.

### Phase 7: Deployment
- Dockerize application.
- Configure production environment.
- Deploy frontend and backend.
- Configure managed PostgreSQL and Redis.
- Add logging and monitoring.
- Write technical documentation.
- Prepare a working demo.

## 9. Search Quality Evaluation

Do not consider the search engine complete just because it returns results.

Create a manually evaluated dataset of 30–50 queries.

Compare:

1. Keyword search.
2. Vector search.
3. Hybrid search.

Measure:

- Precision@5.
- Precision@10.
- Recall@5.
- Recall@10.
- MRR.
- nDCG@10.
- p50 latency.
- p95 latency.

Document the results honestly.

Do not invent benchmark numbers.

## 10. Coding Standards and Engineering Guidelines

Follow these rules throughout development.

### TypeScript
- Enable strict TypeScript mode.
- Avoid using `any`.
- Define proper interfaces and types.
- Use Zod for external input validation.
- Avoid unnecessary type assertions.

### Backend
- Follow separation of concerns.
- Keep controllers thin.
- Put business logic in services.
- Keep database operations in repositories or well-defined data-access modules.
- Use dependency injection where useful.
- Avoid duplicated business logic.
- Handle errors centrally.

### Database
- Use transactions where required.
- Avoid N+1 queries.
- Add indexes based on actual query requirements.
- Avoid fetching unnecessary columns.
- Use pagination.
- Use raw SQL where PostgreSQL-specific functionality is required.

### Background Jobs
- Implement retry policies.
- Use exponential backoff.
- Ensure idempotency.
- Handle failed jobs.
- Prevent duplicate processing.
- Avoid blocking the API request while indexing content.

### Security
- Hash passwords using Argon2id.
- Validate and sanitize inputs.
- Implement rate limiting.
- Protect against SSRF.
- Use secure secrets management.
- Never commit .env files.
- Treat crawled content as untrusted.

### Testing
- Write unit tests for business logic.
- Write integration tests for database and queue operations.
- Write API tests.
- Test failure scenarios.
- Test duplicate jobs and concurrent indexing.
- Add end-to-end tests for the main user workflow.

## 11. Non-Functional Requirements

The system should be designed with:

- Maintainability.
- Reliability.
- Security.
- Scalability.
- Performance.
- Observability.
- Extensibility.

Do not claim enterprise-scale performance without testing.

Start with a manageable dataset and gradually increase its size.

Do not introduce Kafka, Kubernetes, distributed microservices or database sharding in the initial version unless an actual requirement justifies them.

## 12. Important Instructions for Codex

You are acting as a senior software engineer and technical architect assisting me in building this project.

I am developing this project independently and have approximately 2–3 hours available daily.

Follow these instructions strictly:

1. First inspect the existing repository and understand its current structure.
2. Do not overwrite existing working code without inspecting it.
3. Do not generate the entire application in one response.
4. Work incrementally, following the development phases.
5. Before implementing a phase, explain its objective, files involved and technical approach.
6. Break large tasks into smaller implementation steps.
7. Write production-quality, maintainable TypeScript.
8. Explain important architectural decisions.
9. Explain why a particular library or technology is being used.
10. Avoid unnecessary dependencies.
11. Do not introduce features outside the current milestone without approval.
12. Maintain consistency with existing naming conventions and architecture.
13. Update README and relevant documentation as implementation progresses.
14. Create appropriate database migrations.
15. Never hardcode secrets, API keys or environment-specific values.
16. Provide an updated `.env.example` whenever new environment variables are introduced.
17. Run relevant tests and type checks after making changes.
18. Do not claim something works unless it has been verified.
19. Identify incomplete functionality and technical debt honestly.
20. Do not sacrifice correctness for implementation speed.

### Teaching and explanation requirements

I am building this project to improve my software engineering skills and prepare for SDE-I interviews.

Whenever implementing an important feature, explain:

- What problem does this feature solve?
- Why is this approach appropriate?
- How does the implementation work?
- What alternatives exist?
- What are the trade-offs?
- What edge cases should be considered?
- What interview questions could be asked about this implementation?

Prioritize understanding over blindly generating code.

## 13. First Task for Codex

Do not start implementing the complete project immediately.

First:

1. Inspect the repository.
2. Understand the existing files and dependencies.
3. Review this project context.
4. Identify missing architectural decisions.
5. Propose the final folder structure.
6. Propose the initial database schema.
7. Identify required environment variables.
8. Prepare the Docker Compose configuration plan.
9. Create a detailed Phase 1 implementation checklist.

Present the plan and wait for my approval before making major structural changes.

Once approved, implement Phase 1 incrementally.

## 14. Definition of Done

The final application should allow a user to:

1. Register and log in.
2. Register supported content sources.
3. Start asynchronous crawling jobs.
4. View crawling progress.
5. Store extracted documents.
6. Search using keywords.
7. Search using semantic similarity.
8. Retrieve hybrid search results.
9. View paginated search results.
10. Receive AI-generated answers.
11. Inspect citations and original sources.
12. View basic search history.

The application should be deployable using Docker, have automated tests, proper documentation and measurable search quality.

**Final objective:** Build a technically credible search platform that demonstrates strong backend engineering, search algorithms, database design, asynchronous processing and practical AI integration.
