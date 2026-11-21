import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchSuggestionsService } from '../services/search-suggestions.service.js';

describe('SearchSuggestionsService Unit Tests', () => {
  let mockPrisma: any;
  let service: SearchSuggestionsService;

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: vi.fn(),
      document: {
        findMany: vi.fn(),
      },
    };
    service = new SearchSuggestionsService(mockPrisma);
  });

  it('1. returns empty array immediately when prefix length is less than 2', async () => {
    expect(await service.getSuggestions('')).toEqual([]);
    expect(await service.getSuggestions(' ')).toEqual([]);
    expect(await service.getSuggestions('a')).toEqual([]);
    expect(await service.getSuggestions(' a ')).toEqual([]);

    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    expect(mockPrisma.document.findMany).not.toHaveBeenCalled();
  });

  it('2. queries historical searches and document titles with clamped limit', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { query: 'redis persistence', count: 12 },
      { query: 'redis sentinel', count: 5 },
    ]);
    mockPrisma.document.findMany.mockResolvedValue([
      { title: 'Redis Configuration Guide' },
      { title: 'Redis Persistence' },
    ]);

    const result = await service.getSuggestions('redis', 5);

    expect(result).toHaveLength(3);
    expect(result).toContain('redis persistence');
    expect(result).toContain('redis sentinel');
    expect(result).toContain('Redis Configuration Guide');
    // 'Redis Persistence' is deduplicated against 'redis persistence'
  });

  it('3. deduplicates suggestions case-insensitively', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { query: 'distributed systems', count: 20 },
    ]);
    mockPrisma.document.findMany.mockResolvedValue([
      { title: 'Distributed Systems' },
      { title: 'Distributed Databases' },
    ]);

    const result = await service.getSuggestions('dist', 5);

    expect(result).toEqual(['distributed systems', 'Distributed Databases']);
  });

  it('4. clamps limit between 1 and 10 with default 5', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.document.findMany.mockResolvedValue([
      { title: 'Doc 1' },
      { title: 'Doc 2' },
      { title: 'Doc 3' },
      { title: 'Doc 4' },
      { title: 'Doc 5' },
      { title: 'Doc 6' },
      { title: 'Doc 7' },
      { title: 'Doc 8' },
      { title: 'Doc 9' },
      { title: 'Doc 10' },
      { title: 'Doc 11' },
    ]);

    const result = await service.getSuggestions('doc', 100); // Exceeds max 10
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it('5. gracefully returns empty array when database queries fail', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('DB failure'));
    mockPrisma.document.findMany.mockRejectedValue(new Error('DB failure'));

    const result = await service.getSuggestions('fail-query', 5);
    expect(result).toEqual([]);
  });
});
