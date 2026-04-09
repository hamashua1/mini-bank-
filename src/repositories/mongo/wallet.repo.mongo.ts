import mongoose from 'mongoose';
import { WalletModel } from '../../models/wallet.model';
import { TransactionModel } from '../../models/transaction.model';
import { IWalletRepo, WalletDTO, TransactionDTO } from '../interfaces/wallet.repo.interface';

function walletToDTO(doc: any): WalletDTO {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    balance: doc.balance,
    currency: doc.currency,
    createdAt: doc.createdAt,
  };
}

function txToDTO(doc: any): TransactionDTO {
  return {
    id: doc._id.toString(),
    walletId: doc.walletId.toString(),
    type: doc.type,
    amount: doc.amount,
    balanceBefore: doc.balanceBefore,
    balanceAfter: doc.balanceAfter,
    description: doc.description,
    createdAt: doc.createdAt,
  };
}

export const MongoWalletRepo: IWalletRepo = {
  async findByUserId(userId) {
    const doc = await WalletModel.findOne({ userId });
    return doc ? walletToDTO(doc) : null;
  },

  async findById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await WalletModel.findById(id);
    return doc ? walletToDTO(doc) : null;
  },

  async create(data) {
    const doc = await WalletModel.create(data);
    return walletToDTO(doc);
  },

  async deposit({ userId, amount, description }) {
    const session = await mongoose.startSession();
    try {
      let result!: { wallet: WalletDTO; transaction: TransactionDTO };
      await session.withTransaction(async () => {
        const wallet = await WalletModel.findOne({ userId }).session(session);
        if (!wallet) throw new Error('WALLET_NOT_FOUND');

        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore + amount;
        wallet.balance = balanceAfter;
        await wallet.save({ session });

        const [tx] = await TransactionModel.create(
          [{ walletId: wallet._id, type: 'deposit', amount, balanceBefore, balanceAfter, description }],
          { session, ordered: true }
        );
        result = { wallet: walletToDTO(wallet), transaction: txToDTO(tx) };
      });
      return result;
    } finally {
      session.endSession();
    }
  },

  async withdraw({ userId, amount, description }) {
    const session = await mongoose.startSession();
    try {
      let result!: { wallet: WalletDTO; transaction: TransactionDTO };
      await session.withTransaction(async () => {
        const wallet = await WalletModel.findOne({ userId }).session(session);
        if (!wallet) throw new Error('WALLET_NOT_FOUND');
        if (wallet.balance < amount) throw new Error('INSUFFICIENT_BALANCE');

        const balanceBefore = wallet.balance;
        const balanceAfter = balanceBefore - amount;
        wallet.balance = balanceAfter;
        await wallet.save({ session });

        const [tx] = await TransactionModel.create(
          [{ walletId: wallet._id, type: 'withdraw', amount, balanceBefore, balanceAfter, description }],
          { session, ordered: true }
        );
        result = { wallet: walletToDTO(wallet), transaction: txToDTO(tx) };
      });
      return result;
    } finally {
      session.endSession();
    }
  },

  async transfer({ senderUserId, toWalletId, amount, description }) {
    const session = await mongoose.startSession();
    try {
      let senderBalance!: number;
      await session.withTransaction(async () => {
        const senderWallet = await WalletModel.findOne({ userId: senderUserId }).session(session);
        if (!senderWallet) throw new Error('WALLET_NOT_FOUND');
        if (senderWallet._id.toString() === toWalletId) throw new Error('SELF_TRANSFER');

        if (!mongoose.Types.ObjectId.isValid(toWalletId)) throw new Error('RECIPIENT_NOT_FOUND');
        const receiverWallet = await WalletModel.findById(toWalletId).session(session);
        if (!receiverWallet) throw new Error('RECIPIENT_NOT_FOUND');
        if (senderWallet.currency !== receiverWallet.currency) throw new Error('CURRENCY_MISMATCH');
        if (senderWallet.balance < amount) throw new Error('INSUFFICIENT_BALANCE');

        const senderBalanceBefore = senderWallet.balance;
        senderBalance = senderBalanceBefore - amount;
        const receiverBalanceBefore = receiverWallet.balance;
        const receiverBalanceAfter = receiverBalanceBefore + amount;

        senderWallet.balance = senderBalance;
        receiverWallet.balance = receiverBalanceAfter;

        await senderWallet.save({ session });
        await receiverWallet.save({ session });

        await TransactionModel.create(
          [
            { walletId: senderWallet._id, type: 'transfer_out', amount, balanceBefore: senderBalanceBefore, balanceAfter: senderBalance, description },
            { walletId: receiverWallet._id, type: 'transfer_in', amount, balanceBefore: receiverBalanceBefore, balanceAfter: receiverBalanceAfter, description },
          ],
          { session, ordered: true }
        );
      });
      return { balance: senderBalance };
    } finally {
      session.endSession();
    }
  },
};
