import { Router } from 'express';
import { ResearchController } from './research.controller.js';

const router: Router = Router();
const controller = new ResearchController();

// 1. Streaming Research Endpoint (SSE)
router.post('/stream', controller.handleResearchStream);

// 2. Synchronous Research Endpoint
router.post('/', controller.handleResearch);

// 3. Research Session Sources Endpoint
router.get('/:id/sources', controller.handleGetSessionSources);

// 4. Research Session Retrieval Endpoint
router.get('/:id', controller.handleGetSession);

export const researchRouter: Router = router;
