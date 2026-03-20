import { Response } from 'express';
import mongoose from 'mongoose';
import { WalletModel } from '../models/wallet.model';
import { TransactionModel } from '../models/transaction.model';
import { AuthRequest } from '../middleware/auth';

// POST /api/wallet/deposit
export const deposit = async (req: AuthRequest, res: Response): Promise<void> => {
  const { amount, description } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({ message: 'Amount must be a positive number' });
    return;
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ message: 'Description is required' });
    return;
  }

  const session = await mongoose.startSession();

  try {
    let balanceAfter: number;
    let transaction: any;

    await session.withTransaction(async () => {
      const wallet = await WalletModel.findOne({ userId: req.userId }).session(session);
      if (!wallet) throw new Error('WALLET_NOT_FOUND');

      const balanceBefore = wallet.balance;
      balanceAfter = balanceBefore + amount;

      wallet.balance = balanceAfter;
      await wallet.save({ session });

      [transaction] = await TransactionModel.create(
        [{ walletId: wallet._id, type: 'deposit', amount, balanceBefore, balanceAfter, description: description.trim() }],
        { session }
      );
    });

    res.status(200).json({ message: 'Deposit successful', balance: balanceAfter!, transaction });
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'WALLET_NOT_FOUND') {
      res.status(404).json({ message: 'Wallet not found' });
    } else {
      res.status(500).json({ message: 'Deposit failed' });
    }
  } finally {
    session.endSession();
  }
};

// POST /api/wallet/withdraw
export const withdraw = async (req: AuthRequest, res: Response): Promise<void> => {
  const { amount, description } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({ message: 'Amount must be a positive number' });
    return;
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ message: 'Description is required' });
    return;
  }

  const session = await mongoose.startSession();

  try {
    let balanceAfter: number;
    let transaction: any;

    await session.withTransaction(async () => {
      const wallet = await WalletModel.findOne({ userId: req.userId }).session(session);
      if (!wallet) throw new Error('WALLET_NOT_FOUND');
      if (wallet.balance < amount) throw new Error('INSUFFICIENT_BALANCE');

      const balanceBefore = wallet.balance;
      balanceAfter = balanceBefore - amount;

      wallet.balance = balanceAfter;
      await wallet.save({ session });

      [transaction] = await TransactionModel.create(
        [{ walletId: wallet._id, type: 'withdraw', amount, balanceBefore, balanceAfter, description: description.trim() }],
        { session }
      );
    });

    res.status(200).json({ message: 'Withdrawal successful', balance: balanceAfter!, transaction });
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'WALLET_NOT_FOUND') {
      res.status(404).json({ message: 'Wallet not found' });
    } else if (message === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({ message: 'Insufficient balance' });
    } else {
      res.status(500).json({ message: 'Withdrawal failed' });
    }
  } finally {
    session.endSession();
  }
};

// POST /api/wallet/transfer
export const transfer = async (req: AuthRequest, res: Response): Promise<void> => {
  const { toWalletId, amount, description } = req.body;

  if (!toWalletId || typeof toWalletId !== 'string') {
    res.status(400).json({ message: 'Recipient wallet ID is required' });
    return;
  }
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({ message: 'Amount must be a positive number' });
    return;
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ message: 'Description is required' });
    return;
  }

  const session = await mongoose.startSession();

  try {
    let senderBalanceAfter: number;

    await session.withTransaction(async () => {
      const senderWallet = await WalletModel.findOne({ userId: req.userId }).session(session);
      if (!senderWallet) throw new Error('WALLET_NOT_FOUND');

      const receiverWallet = await WalletModel.findOne({ walletId: toWalletId }).session(session);
      if (!receiverWallet) throw new Error('RECIPIENT_NOT_FOUND');

      if (senderWallet.walletId === toWalletId) throw new Error('SELF_TRANSFER');
      if (senderWallet.currency !== receiverWallet.currency) throw new Error('CURRENCY_MISMATCH');
      if (senderWallet.balance < amount) throw new Error('INSUFFICIENT_BALANCE');

      const senderBalanceBefore = senderWallet.balance;
      senderBalanceAfter = senderBalanceBefore - amount;
      const receiverBalanceBefore = receiverWallet.balance;
      const receiverBalanceAfter = receiverBalanceBefore + amount;

      senderWallet.balance = senderBalanceAfter;
      receiverWallet.balance = receiverBalanceAfter;

      await senderWallet.save({ session });
      await receiverWallet.save({ session });

      await TransactionModel.create(
        [
          {
            walletId: senderWallet._id,
            type: 'transfer_out',
            amount,
            balanceBefore: senderBalanceBefore,
            balanceAfter: senderBalanceAfter,
            description: description.trim(),
          },
          {
            walletId: receiverWallet._id,
            type: 'transfer_in',
            amount,
            balanceBefore: receiverBalanceBefore,
            balanceAfter: receiverBalanceAfter,
            description: description.trim(),
          },
        ],
        { session }
      );
    });

    res.status(200).json({ message: 'Transfer successful', balance: senderBalanceAfter! });
  } catch (err) {
    const message = (err as Error).message;

    if (message === 'WALLET_NOT_FOUND') {
      res.status(404).json({ message: 'Wallet not found' });
    } else if (message === 'RECIPIENT_NOT_FOUND') {
      res.status(404).json({ message: 'Recipient wallet not found' });
    } else if (message === 'SELF_TRANSFER') {
      res.status(400).json({ message: 'Cannot transfer to your own wallet' });
    } else if (message === 'CURRENCY_MISMATCH') {
      res.status(400).json({ message: 'Wallet currencies do not match' });
    } else if (message === 'INSUFFICIENT_BALANCE') {
      res.status(400).json({ message: 'Insufficient balance' });
    } else {
      res.status(500).json({ message: 'Transfer failed' });
    }
  } finally {
    session.endSession();
  }
};
