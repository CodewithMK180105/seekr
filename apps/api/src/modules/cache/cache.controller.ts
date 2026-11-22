import { Request, Response, NextFunction } from 'express';
import { SemanticCacheService } from './semantic-cache.service.js';
import { CacheType } from '@seekr/types';

export class CacheController {
  private semanticCache: SemanticCacheService;

  constructor(semanticCache: SemanticCacheService = new SemanticCacheService()) {
    this.semanticCache = semanticCache;
  }

  /**
   * GET /api/v1/cache/stats
   * Returns cache metrics including exact & semantic hit counts, miss counts, and hit ratios.
   */
  public getStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.semanticCache.getStats();
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/cache/clear
   * Clears exact and semantic cache entries.
   */
  public clear = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cacheType = req.body?.cacheType as CacheType | undefined;
      const result = await this.semanticCache.invalidate(cacheType);
      res.status(200).json({
        success: true,
        data: {
          cleared: true,
          exactDeleted: result.exactDeleted,
          semanticDeleted: result.semanticDeleted,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/cache/cleanup
   * Removes expired semantic cache entries.
   */
  public cleanup = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deletedCount = await this.semanticCache.cleanupExpired();
      res.status(200).json({
        success: true,
        data: {
          cleaned: true,
          deletedCount,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
