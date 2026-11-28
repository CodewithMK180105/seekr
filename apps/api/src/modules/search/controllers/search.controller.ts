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
      skipCache: input.skipCache || req.headers['cache-control'] === 'no-cache',
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

export async function searchStream(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = searchQuerySchema.parse(req.query);
    const userId = (req as any).user?.id;
    const sessionId = (req.headers['x-session-id'] as string) || undefined;

    // Set Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendEvent = (event: string, payload: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    await searchService.search(
      {
        query: input.q,
        mode: input.mode as SearchMode,
        page: input.page,
        limit: input.limit,
        sourceId: input.sourceId,
        userId,
        sessionId,
        skipCache: input.skipCache || req.headers['cache-control'] === 'no-cache',
      },
      (evt) => {
        sendEvent('search_event', evt);
      }
    );

    res.write('event: end\ndata: {}\n\n');
    res.end();
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: (err as any)?.message || 'Stream error' })}\n\n`);
      res.end();
    }
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
    const item = await searchService.getSearchById(id);

    if (!item) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Search query with ID ${id} not found` },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: item,
    });
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
    const payload = searchFeedbackSchema.parse(req.body);
    await feedbackService.recordClick(payload);

    res.status(200).json({
      success: true,
      message: 'Feedback recorded successfully',
    });
  } catch (err) {
    next(err);
  }
}
