import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { register, login, refresh, logout, getMe } from './auth.controller.js';

const router: Router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);

export const authRouter: Router = router;
