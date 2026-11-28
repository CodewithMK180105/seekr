import { Router } from 'express';
import {
  search,
  searchStream,
  getSuggestions,
  getAnalytics,
  getSearchById,
  recordFeedback,
} from '../controllers/search.controller.js';
import {
  searchRateLimiter,
  suggestionsRateLimiter,
  globalApiRateLimiter,
} from '../../../middleware/rateLimiter.js';

const router: Router = Router();

// GET /api/v1/search - Main search endpoint
router.get('/', searchRateLimiter, search);

// GET /api/v1/search/stream - Progressive search endpoint via SSE
router.get('/stream', searchRateLimiter, searchStream);

// GET /api/v1/search/suggestions - Autocomplete prefix suggestions
router.get('/suggestions', suggestionsRateLimiter, getSuggestions);

// GET /api/v1/search/analytics - Search metrics, latency and click tracking analytics
router.get('/analytics', globalApiRateLimiter, getAnalytics);

// GET /api/v1/search/:id - Specific search result details
router.get('/:id', globalApiRateLimiter, getSearchById);

// POST /api/v1/search/feedback - Click and interaction feedback
router.post('/feedback', globalApiRateLimiter, recordFeedback);

export const searchRouter: Router = router;
