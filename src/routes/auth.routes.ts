import { Router } from 'express';
import { signup, login, refresh, logout } from '../controllers/auth.controller';
import { authRateLimiter } from '../middleware/rateLimiter';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/signup', authRateLimiter, signup);
router.post('/login', authRateLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);

export default router;
