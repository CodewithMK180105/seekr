import { Request, Response, NextFunction } from 'express';
import {
  searchQuerySchema,
  suggestionsQuerySchema,
  searchFeedbackSchema,
  searchAnalyticsQuerySchema,
} from '../search.schema.js';
import {
  ApiResponse,
  SearchResponse,
  SuggestionsResponse,
  SearchAnalyticsResponse,
  SearchMode,
} from '../search.types.js';
import {
  SearchService,
  SearchSuggestionsService,
  SearchFeedbackService,
  SearchAnalyticsService,
} from '../services/index.js';

const searchService = new SearchService();
const suggestionsService = new SearchSuggestionsService();
const feedbackService = new SearchFeedbackService();
const analyticsService = new SearchAnalyticsService();

export async function search(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = searchQuerySchema.parse(req.query);
    const userId = (req as any).user?.id;
    const sessionId = (req.headers['x-session-id'] as string) || undefined;

    const searchResponse = await searchService.search({
      query: input.q,
      mode: input.mode as SearchMode,
      page: input.page,
      limit: input.limit,
      sourceId: input.sourceId,
      userId,
      sessionId,
    });

    const response: ApiResponse<SearchResponse> = {
      success: true,
      data: searchResponse,
      meta: {
        page: searchResponse.pagination.page,
        limit: searchResponse.pagination.limit,
        total: searchResponse.pagination.total,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function getSuggestions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = suggestionsQuerySchema.parse(req.query);
    const suggestions = await suggestionsService.getSuggestions(input.q, input.limit);

    const suggestionsResponse: SuggestionsResponse = {
      query: input.q,
      suggestions,
    };

    const response: ApiResponse<SuggestionsResponse> = {
      success: true,
      data: suggestionsResponse,
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function getAnalytics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filter = searchAnalyticsQuerySchema.parse(req.query);
    const from = filter.from ? new Date(filter.from) : undefined;
    const to = filter.to ? new Date(filter.to) : undefined;

    const analytics = await analyticsService.getAnalytics({ from, to });

    const response: ApiResponse<SearchAnalyticsResponse> = {
      success: true,
      data: analytics,
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function getSearchById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const response: ApiResponse<{ id: string }> = {
      success: true,
      data: { id },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function recordFeedback(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = searchFeedbackSchema.parse(req.body);
    const result = await feedbackService.recordClick({
      searchQueryId: input.searchQueryId,
      searchId: input.searchId,
      chunkId: input.chunkId,
      action: input.action,
      event: input.event,
    });

    const response: ApiResponse<{
      recorded: boolean;
      searchId: string;
      searchQueryId: string;
      chunkId: string;
    }> = {
      success: true,
      data: result,
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
