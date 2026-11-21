import { prisma } from '@seekr/shared';
import { SearchMode, Prisma } from '@prisma/client';
import { DetailedSourceDTO } from './types.js';
import { VerifiedCitation } from './citation-post-processor.js';

export interface CreateResearchSessionInput {
  id?: string;
  userId?: string | null;
  query: string;
  answer: string;
  searchMode: SearchMode;
  citations: VerifiedCitation[];
  sources: any[];
  latencyMs: number;
}

export class ResearchRepository {
  /**
   * Persists a completed research session to PostgreSQL.
   */
  async createSession(input: CreateResearchSessionInput) {
    return prisma.researchSession.create({
      data: {
        id: input.id,
        userId: input.userId || null,
        query: input.query,
        answer: input.answer,
        searchMode: input.searchMode,
        citations: input.citations as unknown as Prisma.InputJsonValue,
        sources: input.sources as unknown as Prisma.InputJsonValue,
        latencyMs: input.latencyMs,
      },
    });
  }

  /**
   * Retrieves a research session by UUID.
   */
  async getSessionById(id: string) {
    return prisma.researchSession.findUnique({
      where: { id },
    });
  }

  /**
   * Retrieves sources and associated citations for a research session.
   */
  async getSourcesBySessionId(id: string): Promise<DetailedSourceDTO[] | null> {
    const session = await prisma.researchSession.findUnique({
      where: { id },
      select: {
        sources: true,
        citations: true,
      },
    });

    if (!session) return null;

    const sources = (session.sources as unknown as any[]) || [];
    const citations = (session.citations as unknown as VerifiedCitation[]) || [];

    return sources.map((src) => {
      const associatedCitations = citations.filter(
        (c) => c.citationIndex === src.citationIndex || c.chunkId === src.chunkId
      );

      return {
        citationId: src.citationId,
        citationIndex: src.citationIndex,
        chunkId: src.chunkId,
        documentId: src.documentId,
        title: src.title,
        url: src.url,
        sourceType: src.sourceType,
        score: src.score,
        rank: src.rank,
        content: src.content,
        tokenCount: src.tokenCount,
        truncated: src.truncated,
        suspicious: src.suspicious,
        citationReferences: associatedCitations,
      };
    });
  }
}
