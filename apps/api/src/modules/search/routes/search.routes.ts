import { Router } from 'express';
import {
  search,
  getSuggestions,
  getSearchById,
  recordFeedback,
} from '../controllers/search.controller.js';

const router: Router = Router();

// GET /api/v1/search - Main search endpoint
router.get('/', search);

// GET /api/v1/search/suggestions - Autocomplete prefix suggestions
router.get('/suggestions', getSuggestions);

// GET /api/v1/search/:id - Specific search result details
router.get('/:id', getSearchById);

// POST /api/v1/search/feedback - Click and interaction feedback
router.post('/feedback', recordFeedback);

export const searchRouter: Router = router;
