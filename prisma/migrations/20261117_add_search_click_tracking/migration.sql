-- AlterTable
ALTER TABLE "search_results" ADD COLUMN IF NOT EXISTS "clicked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "search_results" ADD COLUMN IF NOT EXISTS "clicked_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "search_results_clicked_idx" ON "search_results"("clicked");
