import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  createSource,
  listSources,
  getSourceById,
  updateSourceStatus,
  deleteSource,
} from './sources.controller.js';

const router: Router = Router();

router.use(requireAuth);

router.post('/', createSource);
router.get('/', listSources);
router.get('/:id', getSourceById);
router.patch('/:id', updateSourceStatus);
router.delete('/:id', deleteSource);

export const sourcesRouter: Router = router;
