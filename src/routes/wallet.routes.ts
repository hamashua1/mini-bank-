import { Router } from 'express';
import { deposit, withdraw, transfer } from '../controllers/wallet.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/deposit', authenticate, deposit);
router.post('/withdraw', authenticate, withdraw);
router.post('/transfer', authenticate, transfer);

export default router;
