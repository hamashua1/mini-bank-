import { Response } from 'express';
import { WalletRepo, TransactionRepo } from '../repositories/registry';
import { AuthRequest } from '../middleware/auth';
import { TransactionType } from '../repositories/interfaces/wallet.repo.interface';

const VALID_FILTERS = ['deposit', 'withdraw', 'transfer'] as const;
type FilterType = typeof VALID_FILTERS[number];

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

// GET /api/transactions?filter=deposit|withdraw|transfer&page=1&limit=20
export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { filter, page, limit } = req.query;

    if (filter && (typeof filter !== 'string' || !VALID_FILTERS.includes(filter as FilterType))) {
      res.status(400).json({ message: 'Invalid filter. Use: deposit, withdraw, or transfer' });
      return;
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(limit as string) || DEFAULT_PAGE_LIMIT));
    const skip = (pageNum - 1) * limitNum;

    const wallet = await WalletRepo.findByUserId(req.userId!);
    if (!wallet) {
      res.status(404).json({ message: 'Wallet not found' });
      return;
    }

    let typeFilter: TransactionType[] | undefined;
    if (filter === 'deposit') typeFilter = ['deposit'];
    else if (filter === 'withdraw') typeFilter = ['withdraw'];
    else if (filter === 'transfer') typeFilter = ['transfer_in', 'transfer_out'];

    const { transactions, total } = await TransactionRepo.findByWalletId({
      walletId: wallet.id,
      typeFilter,
      skip,
      limit: limitNum,
    });

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
      transactions,
    });
  } catch {
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
};

// GET /api/transactions/:id
export const getTransactionById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const wallet = await WalletRepo.findByUserId(req.userId!);
    if (!wallet) {
      res.status(404).json({ message: 'Wallet not found' });
      return;
    }

    const transaction = await TransactionRepo.findByIdAndWalletId(id, wallet.id);
    if (!transaction) {
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }

    res.status(200).json({ transaction });
  } catch {
    res.status(500).json({ message: 'Failed to fetch transaction' });
  }
};
