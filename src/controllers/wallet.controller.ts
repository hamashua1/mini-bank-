import { Response } from 'express';
import { WalletRepo } from '../repositories/registry';
import { AuthRequest } from '../middleware/auth';

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'NGN'] as const;
const MAX_DESCRIPTION_LENGTH = 200;

// POST /api/wallet
export const createWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  const { currency } = req.body;

  if (!currency || typeof currency !== 'string' || !SUPPORTED_CURRENCIES.includes(currency.toUpperCase() as any)) {
    res.status(400).json({ message: `Currency is required. Supported: ${SUPPORTED_CURRENCIES.join(', ')}` });
    return;
  }

  try {
    const existing = await WalletRepo.findByUserId(req.userId!);
    if (existing) {
      res.status(409).json({ message: 'Wallet already exists', wallet: { walletId: existing.id, balance: existing.balance, currency: existing.currency } });
      return;
    }

    const wallet = await WalletRepo.create({ userId: req.userId!, balance: 0, currency: currency.toUpperCase() });
    res.status(201).json({ message: 'Wallet created', wallet: { walletId: wallet.id, balance: wallet.balance, currency: wallet.currency } });
  } catch (err: any) {
    // Unique constraint violation (duplicate wallet)
    if (err?.code === 11000 || err?.code === 'P2002') {
      res.status(409).json({ message: 'Wallet already exists' });
    } else {
      res.status(500).json({ message: 'Failed to create wallet' });
    }
  }
};

// GET /api/wallet
export const getWallet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const wallet = await WalletRepo.findByUserId(req.userId!);
    if (!wallet) {
      res.status(404).json({ message: 'Wallet not found. Create one at POST /api/wallet' });
      return;
    }
    res.status(200).json({ walletId: wallet.id, balance: wallet.balance, currency: wallet.currency, createdAt: wallet.createdAt });
  } catch {
    res.status(500).json({ message: 'Failed to fetch wallet' });
  }
};

// POST /api/wallet/deposit
export const deposit = async (req: AuthRequest, res: Response): Promise<void> => {
  const { amount, description } = req.body;

  if (!amount || typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    res.status(400).json({ message: 'Amount must be a positive number' });
    return;
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ message: 'Description is required' });
    return;
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    res.status(400).json({ message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` });
    return;
  }

  try {
    const { wallet, transaction } = await WalletRepo.deposit({
      userId: req.userId!,
      amount,
      description: description.trim(),
    });
    res.status(200).json({ message: 'Deposit successful', balance: wallet.balance, transaction });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'WALLET_NOT_FOUND') res.status(404).json({ message: 'Wallet not found' });
    else res.status(500).json({ message: 'Deposit failed' });
  }
};

// POST /api/wallet/withdraw
export const withdraw = async (req: AuthRequest, res: Response): Promise<void> => {
  const { amount, description } = req.body;

  if (!amount || typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    res.status(400).json({ message: 'Amount must be a positive number' });
    return;
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ message: 'Description is required' });
    return;
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    res.status(400).json({ message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` });
    return;
  }

  try {
    const { wallet, transaction } = await WalletRepo.withdraw({
      userId: req.userId!,
      amount,
      description: description.trim(),
    });
    res.status(200).json({ message: 'Withdrawal successful', balance: wallet.balance, transaction });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'WALLET_NOT_FOUND') res.status(404).json({ message: 'Wallet not found' });
    else if (msg === 'INSUFFICIENT_BALANCE') res.status(400).json({ message: 'Insufficient balance' });
    else res.status(500).json({ message: 'Withdrawal failed' });
  }
};

// POST /api/wallet/transfer
export const transfer = async (req: AuthRequest, res: Response): Promise<void> => {
  const { toWalletId, amount, description } = req.body;

  if (!toWalletId || typeof toWalletId !== 'string') {
    res.status(400).json({ message: 'Recipient wallet ID is required' });
    return;
  }
  if (!amount || typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
    res.status(400).json({ message: 'Amount must be a positive number' });
    return;
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    res.status(400).json({ message: 'Description is required' });
    return;
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    res.status(400).json({ message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` });
    return;
  }

  try {
    const { balance } = await WalletRepo.transfer({
      senderUserId: req.userId!,
      toWalletId,
      amount,
      description: description.trim(),
    });
    res.status(200).json({ message: 'Transfer successful', balance });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'WALLET_NOT_FOUND') res.status(404).json({ message: 'Wallet not found' });
    else if (msg === 'RECIPIENT_NOT_FOUND') res.status(404).json({ message: 'Recipient wallet not found' });
    else if (msg === 'SELF_TRANSFER') res.status(400).json({ message: 'Cannot transfer to your own wallet' });
    else if (msg === 'CURRENCY_MISMATCH') res.status(400).json({ message: 'Wallet currencies do not match' });
    else if (msg === 'INSUFFICIENT_BALANCE') res.status(400).json({ message: 'Insufficient balance' });
    else res.status(500).json({ message: 'Transfer failed' });
  }
};
