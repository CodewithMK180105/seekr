import { Request, Response, NextFunction } from 'express';
import {
  searchQuerySchema,
  suggestionsQuerySchema,
  searchFeedbackSchema,
} from '../search.schema.js';
import {
  ApiResponse,
  SearchResponse,
  SuggestionsResponse,
  SearchMode,
} from '../search.types.js';
import { SearchService } from '../services/search.service.js';

const searchService = new SearchService();

export async function search(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = searchQuerySchema.parse(req.query);

    const searchResponse = await searchService.search({
      query: input.q,
      mode: input.mode as SearchMode,
      page: input.page,
      limit: input.limit,
      sourceId: input.sourceId,
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

    // Skeleton response for Milestone 4.1 Foundation
    const suggestionsResponse: SuggestionsResponse = {
      query: input.q,
      suggestions: [],
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

    const response: ApiResponse<{ recorded: boolean; searchId: string; chunkId: string }> = {
      success: true,
      data: {
        recorded: true,
        searchId: input.searchId,
        chunkId: input.chunkId,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
