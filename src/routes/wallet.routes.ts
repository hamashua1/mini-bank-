import { Router } from 'express';
import { createWallet, getWallet, deposit, withdraw, transfer } from '../controllers/wallet.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, createWallet);
router.get('/', authenticate, getWallet);
router.post('/deposit', authenticate, deposit);
router.post('/withdraw', authenticate, withdraw);
router.post('/transfer', authenticate, transfer);

export default router;
