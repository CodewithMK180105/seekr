import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchFeedbackService } from '../services/search-feedback.service.js';
import { NotFoundError, BadRequestError } from '@seekr/shared';

describe('SearchFeedbackService Unit Tests', () => {
  let mockPrisma: any;
  let service: SearchFeedbackService;

  const validSearchId = '123e4567-e89b-12d3-a456-426614174000';
  const validChunkId = '987fcdeb-51a2-43f7-9876-ba0987654321';

  beforeEach(() => {
    mockPrisma = {
      searchQuery: {
        findUnique: vi.fn(),
      },
      searchResult: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    service = new SearchFeedbackService(mockPrisma);
  });

  it('1. records click successfully when query and result chunk exist', async () => {
    mockPrisma.searchQuery.findUnique.mockResolvedValue({ id: validSearchId });
    mockPrisma.searchResult.findUnique.mockResolvedValue({
      id: 'res-1',
      clicked: false,
      clickedAt: null,
    });
    mockPrisma.searchResult.update.mockResolvedValue({});

    const result = await service.recordClick({
      searchQueryId: validSearchId,
      chunkId: validChunkId,
      action: 'click',
    });

    expect(result).toEqual({
      recorded: true,
      searchId: validSearchId,
      searchQueryId: validSearchId,
      chunkId: validChunkId,
    });
    expect(mockPrisma.searchResult.update).toHaveBeenCalledTimes(1);
    const updateArg = mockPrisma.searchResult.update.mock.calls[0][0];
    expect(updateArg.where.id).toBe('res-1');
    expect(updateArg.data.clicked).toBe(true);
    expect(updateArg.data.clickedAt).toBeInstanceOf(Date);
  });

  it('2. is idempotent and preserves first clickedAt timestamp on repeated clicks', async () => {
    const originalDate = new Date('2026-11-20T10:00:00Z');
    mockPrisma.searchQuery.findUnique.mockResolvedValue({ id: validSearchId });
    mockPrisma.searchResult.findUnique.mockResolvedValue({
      id: 'res-1',
      clicked: true,
      clickedAt: originalDate,
    });

    const result = await service.recordClick({
      searchId: validSearchId,
      chunkId: validChunkId,
    });

    expect(result.recorded).toBe(true);
    expect(mockPrisma.searchResult.update).not.toHaveBeenCalled();
  });

  it('3. throws NotFoundError (404) when searchQueryId does not exist', async () => {
    mockPrisma.searchQuery.findUnique.mockResolvedValue(null);

    await expect(
      service.recordClick({
        searchQueryId: validSearchId,
        chunkId: validChunkId,
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('4. throws BadRequestError (400) when chunkId was not part of the search results', async () => {
    mockPrisma.searchQuery.findUnique.mockResolvedValue({ id: validSearchId });
    mockPrisma.searchResult.findUnique.mockResolvedValue(null);

    await expect(
      service.recordClick({
        searchQueryId: validSearchId,
        chunkId: 'chunk-not-in-results',
      })
    ).rejects.toThrow(BadRequestError);
  });
});
