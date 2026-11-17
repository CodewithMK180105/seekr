import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  createCrawlJob,
  listCrawlJobs,
  getCrawlJobById,
  retryCrawlJob,
} from './crawler.controller.js';

const router: Router = Router();

router.use(requireAuth);

router.post('/', createCrawlJob);
router.get('/', listCrawlJobs);
router.get('/:id', getCrawlJobById);
router.post('/:id/retry', retryCrawlJob);

export const crawlerRouter: Router = router;
