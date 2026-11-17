import { Job } from 'bullmq';
import { prisma, chunkDocument, getEmbeddingProvider } from '@seekr/shared';
import { IndexJobData } from '@seekr/types';

export async function processIndexJob(job: Job<IndexJobData>): Promise<void> {
  const { documentId, isUpdate } = job.data;

  console.log(`[IndexProcessor] Starting job ${job.id} for document ${documentId} (isUpdate: ${isUpdate})`);

  // 1. Fetch document from database
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      url: true,
      title: true,
      content: true,
    },
  });

  if (!doc) {
    console.warn(`[IndexProcessor] Document ${documentId} not found. Skipping indexing.`);
    return;
  }

  // 2. Perform sentence-boundary aware sliding-window chunking
  const chunks = chunkDocument(doc.content, { maxTokens: 400, overlapTokens: 40 });

  if (chunks.length === 0) {
    console.warn(`[IndexProcessor] Document ${doc.url} produced 0 chunks. Skipping.`);
    return;
  }

  console.log(`[IndexProcessor] Generated ${chunks.length} chunks for ${doc.url}`);

  // 3. Batch generate embeddings
  const provider = getEmbeddingProvider();
  console.log(`[IndexProcessor] Generating embeddings using provider: ${provider.name} (${provider.dimension} dim)`);

  const startTime = Date.now();
  // Include document title with chunk content to provide contextual grounding for embeddings
  const textsToEmbed = chunks.map((c) => `${doc.title}\n\n${c.content}`);
  const embeddings = await provider.embedBatch(textsToEmbed);
  const elapsed = Date.now() - startTime;

  console.log(`[IndexProcessor] Generated ${embeddings.length} embeddings in ${elapsed}ms`);

  // 4. Atomically persist chunks with vector and tsvector
  await prisma.$transaction(async (tx) => {
    if (isUpdate) {
      await tx.$executeRaw`
        DELETE FROM "document_chunks" WHERE "document_id" = ${doc.id}::uuid
      `;
      console.log(`[IndexProcessor] Cleared stale chunks for document ${doc.id}`);
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = embeddings[i];
      const vectorString = `[${embedding.join(',')}]`;

      await tx.$executeRaw`
        INSERT INTO "document_chunks" (
          "id",
          "document_id",
          "chunk_index",
          "content",
          "token_count",
          "embedding",
          "search_vector",
          "created_at"
        ) VALUES (
          gen_random_uuid(),
          ${doc.id}::uuid,
          ${chunk.chunkIndex},
          ${chunk.content},
          ${chunk.tokenCount},
          ${vectorString}::vector,
          setweight(to_tsvector('english', ${doc.title}), 'A') || setweight(to_tsvector('english', ${chunk.content}), 'B'),
          NOW()
        )
        ON CONFLICT ("document_id", "chunk_index") DO UPDATE SET
          "content" = EXCLUDED."content",
          "token_count" = EXCLUDED."token_count",
          "embedding" = EXCLUDED."embedding",
          "search_vector" = EXCLUDED."search_vector"
      `;
    }
  });

  console.log(
    `[IndexProcessor] Successfully indexed ${chunks.length} chunks for document: ${doc.url}`
  );
}
