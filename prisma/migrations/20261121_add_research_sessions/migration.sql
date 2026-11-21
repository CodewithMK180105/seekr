-- CreateTable
CREATE TABLE IF NOT EXISTS "research_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "query" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "search_mode" "SearchMode" NOT NULL,
    "citations" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "research_sessions_user_id_idx" ON "research_sessions"("user_id");
CREATE INDEX IF NOT EXISTS "research_sessions_created_at_idx" ON "research_sessions"("created_at");
CREATE INDEX IF NOT EXISTS "research_sessions_search_mode_idx" ON "research_sessions"("search_mode");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'research_sessions_user_id_fkey'
    ) THEN
        ALTER TABLE "research_sessions" ADD CONSTRAINT "research_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
