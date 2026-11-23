import { Router } from 'express';
import { ResearchController } from './research.controller.js';
import {
  researchRateLimiter,
  globalApiRateLimiter,
} from '../../middleware/rateLimiter.js';

const router: Router = Router();
const controller = new ResearchController();

// 1. Streaming Research Endpoint (SSE)
router.post('/stream', researchRateLimiter, controller.handleResearchStream);

// 2. Synchronous Research Endpoint
router.post('/', researchRateLimiter, controller.handleResearch);

// 3. Research Session Sources Endpoint
router.get('/:id/sources', globalApiRateLimiter, controller.handleGetSessionSources);

// 4. Research Session Retrieval Endpoint
router.get('/:id', globalApiRateLimiter, controller.handleGetSession);

export const researchRouter: Router = router;
