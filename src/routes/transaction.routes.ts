import { Router } from 'express';
import { getTransactions, getTransactionById } from '../controllers/transaction.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, getTransactions);
router.get('/:id', authenticate, getTransactionById);

export default router;
