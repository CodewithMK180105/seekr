import { Router } from 'express';
import { CacheController } from './cache.controller.js';

export function createCacheRouter(controller: CacheController = new CacheController()): Router {
  const router = Router();

  router.get('/stats', controller.getStats);
  router.post('/clear', controller.clear);
  router.post('/cleanup', controller.cleanup);

  return router;
}

export const cacheRouter = createCacheRouter();
