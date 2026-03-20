import { Response } from 'express';
import mongoose from 'mongoose';
import { TransactionModel, TransactionType } from '../models/transaction.model';
import { WalletModel } from '../models/wallet.model';
import { AuthRequest } from '../middleware/auth';

const VALID_FILTERS = ['deposit', 'withdraw', 'transfer'] as const;
type FilterType = typeof VALID_FILTERS[number];

// GET /api/transactions?filter=deposit|withdraw|transfer
export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { filter } = req.query;

    if (filter && (typeof filter !== 'string' || !VALID_FILTERS.includes(filter as FilterType))) {
      res.status(400).json({ message: 'Invalid filter. Use: deposit, withdraw, or transfer' });
      return;
    }

    const wallet = await WalletModel.findOne({ userId: req.userId });
    if (!wallet) {
      res.status(404).json({ message: 'Wallet not found' });
      return;
    }

    // map filter to matching transaction types
    let typeFilter: TransactionType[] | undefined;
    if (filter === 'deposit') typeFilter = ['deposit'];
    else if (filter === 'withdraw') typeFilter = ['withdraw'];
    else if (filter === 'transfer') typeFilter = ['transfer_in', 'transfer_out'];

    const query: Record<string, any> = { walletId: wallet._id };
    if (typeFilter) query.type = { $in: typeFilter };

    const transactions = await TransactionModel.find(query)
      .select('type amount balanceBefore balanceAfter description createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({ total: transactions.length, transactions });
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
