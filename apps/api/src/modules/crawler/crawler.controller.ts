import { Request, Response, NextFunction } from 'express';
import { createCrawlJobSchema } from '@seekr/shared';
import { ApiResponse, CrawlJobDto } from '@seekr/types';
import { crawlerService } from './crawler.service.js';

export async function createCrawlJob(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = createCrawlJobSchema.parse(req.body);
    const job = await crawlerService.createCrawlJob(req.user!.userId, input);

    const response: ApiResponse<{ job: CrawlJobDto }> = {
      success: true,
      data: { job },
    };

    // Return 202 Accepted for asynchronous background jobs
    res.status(202).json(response);
  } catch (err) {
    next(err);
  }
}

export async function listCrawlJobs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const result = await crawlerService.listCrawlJobs(page, limit);

    const response: ApiResponse<{ jobs: CrawlJobDto[] }> = {
      success: true,
      data: { jobs: result.jobs },
      meta: {
        page,
        limit,
        total: result.total,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function getCrawlJobById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const job = await crawlerService.getCrawlJobById(req.params.id);

    const response: ApiResponse<{ job: CrawlJobDto }> = {
      success: true,
      data: { job },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}

export async function retryCrawlJob(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const job = await crawlerService.retryCrawlJob(req.params.id);

    const response: ApiResponse<{ job: CrawlJobDto }> = {
      success: true,
      data: { job },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
}
