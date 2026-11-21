import { Router } from 'express';
import { getLiveness, getReadiness } from '../modules/health/health.controller.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { sourcesRouter } from '../modules/sources/sources.routes.js';
import { crawlerRouter } from '../modules/crawler/crawler.routes.js';
import { searchRouter } from '../modules/search/routes/search.routes.js';
import { researchRouter } from '../modules/research/research.routes.js';
import { NotFoundError } from '@seekr/shared';

const router: Router = Router();

// System Health Checks
router.get('/health', getLiveness);
router.get('/ready', getReadiness);

// API v1 Routes
router.use('/api/v1/auth', authRouter);
router.use('/api/v1/sources', sourcesRouter);
router.use('/api/v1/crawl-jobs', crawlerRouter);
router.use('/api/v1/search', searchRouter);
router.use('/api/v1/research', researchRouter);

// 404 Catch-all handler
router.use('*', (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

export const appRouter: Router = router;
