import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma, NotFoundError, BadRequestError } from '@seekr/shared';

export interface RecordFeedbackInput {
  searchQueryId?: string;
  searchId?: string;
  chunkId: string;
  action?: 'click';
  event?: 'click';
}

export interface RecordFeedbackResult {
  recorded: boolean;
  searchId: string;
  searchQueryId: string;
  chunkId: string;
}

export class SearchFeedbackService {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  async recordClick(input: RecordFeedbackInput): Promise<RecordFeedbackResult> {
    const id = input.searchQueryId || input.searchId;
    if (!id) {
      throw new BadRequestError('Either searchQueryId or searchId must be provided');
    }

    // 1. Verify that search query exists
    const searchQuery = await this.prisma.searchQuery.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!searchQuery) {
      throw new NotFoundError(`Search query with ID '${id}' not found`);
    }

    // 2. Verify that chunk was part of this search's logged result set
    const searchResult = await this.prisma.searchResult.findUnique({
      where: {
        searchQueryId_chunkId: {
          searchQueryId: id,
          chunkId: input.chunkId,
        },
      },
      select: {
        id: true,
        clicked: true,
        clickedAt: true,
      },
    });

    if (!searchResult) {
      throw new BadRequestError(
        `Chunk with ID '${input.chunkId}' was not part of search result set '${id}'`
      );
    }

    // 3. Mark clicked idempotently (preserve first clickedAt timestamp)
    if (!searchResult.clicked) {
      await this.prisma.searchResult.update({
        where: { id: searchResult.id },
        data: {
          clicked: true,
          clickedAt: new Date(),
        },
      });
    }

    return {
      recorded: true,
      searchId: id,
      searchQueryId: id,
      chunkId: input.chunkId,
    };
  }
}
