-- CreateTable semantic_cache
CREATE TABLE IF NOT EXISTS "semantic_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cache_type" VARCHAR(32) NOT NULL,
    "query" TEXT NOT NULL,
    "normalized_query" TEXT NOT NULL,
    "search_mode" VARCHAR(32),
    "embedding" vector(768) NOT NULL,
    "payload" JSONB NOT NULL,
    "hit_count" INTEGER NOT NULL DEFAULT 1,
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "semantic_cache_pkey" PRIMARY KEY ("id")
);

-- HNSW Vector Index on embedding for fast cosine distance matching
CREATE INDEX IF NOT EXISTS "semantic_cache_embedding_hnsw_idx" ON "semantic_cache" USING hnsw ("embedding" vector_cosine_ops);

-- B-Tree indexes for fast exact normalized query lookups and TTL expiration cleanups
CREATE INDEX IF NOT EXISTS "semantic_cache_type_normalized_query_idx" ON "semantic_cache"("cache_type", "normalized_query");
CREATE INDEX IF NOT EXISTS "semantic_cache_expires_at_idx" ON "semantic_cache"("expires_at");
