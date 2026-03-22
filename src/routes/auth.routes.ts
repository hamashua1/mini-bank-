import { Router } from 'express';
import { signup, login, refresh, logout } from '../controllers/auth.controller';
import { registerOptions, registerVerify, loginOptions, loginVerify } from '../controllers/webauthn.controller';
import { authRateLimiter } from '../middleware/rateLimiter';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/signup', authRateLimiter, signup);
router.post('/login', authRateLimiter, login);
router.post('/refresh', authRateLimiter, refresh);
router.post('/logout', authenticate, logout);

// WebAuthn (fingerprint)
router.post('/webauthn/register/options', authenticate, registerOptions);
router.post('/webauthn/register/verify', authenticate, registerVerify);
router.post('/webauthn/login/options', authRateLimiter, loginOptions);
router.post('/webauthn/login/verify', authRateLimiter, loginVerify);

export default router;
