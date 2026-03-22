import { Response } from 'express';
import mongoose from 'mongoose';
import { TransactionModel, TransactionType } from '../models/transaction.model';
import { WalletModel } from '../models/wallet.model';
import { AuthRequest } from '../middleware/auth';

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

    const wallet = await WalletModel.findOne({ userId: req.userId });
    if (!wallet) {
      res.status(404).json({ message: 'Wallet not found' });
      return;
    }

    let typeFilter: TransactionType[] | undefined;
    if (filter === 'deposit') typeFilter = ['deposit'];
    else if (filter === 'withdraw') typeFilter = ['withdraw'];
    else if (filter === 'transfer') typeFilter = ['transfer_in', 'transfer_out'];

    const query: { walletId: mongoose.Types.ObjectId; type?: { $in: TransactionType[] } } = { walletId: wallet._id };
    if (typeFilter) query.type = { $in: typeFilter };

    const [transactions, total] = await Promise.all([
      TransactionModel.find(query)
        .select('type amount balanceBefore balanceAfter description createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      TransactionModel.countDocuments(query),
    ]);

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

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid transaction ID' });
      return;
    }

    const wallet = await WalletModel.findOne({ userId: req.userId });
    if (!wallet) {
      res.status(404).json({ message: 'Wallet not found' });
      return;
    }

    const transaction = await TransactionModel.findOne({
      _id: id,
      walletId: wallet._id,
    }).select('type amount balanceBefore balanceAfter description createdAt');

    if (!transaction) {
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }

    res.status(200).json({ transaction });
  } catch {
    res.status(500).json({ message: 'Failed to fetch transaction' });
  }
};
