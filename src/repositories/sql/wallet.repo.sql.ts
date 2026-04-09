import { getPrismaClient } from '../../db/prisma';
import { IWalletRepo, WalletDTO, TransactionDTO } from '../interfaces/wallet.repo.interface';

function walletToDTO(w: any): WalletDTO {
  return {
    id: w.id,
    userId: w.userId,
    balance: Number(w.balance),
    currency: w.currency,
    createdAt: w.createdAt,
  };
}

function txToDTO(t: any): TransactionDTO {
  return {
    id: t.id,
    walletId: t.walletId,
    type: t.type,
    amount: Number(t.amount),
    balanceBefore: Number(t.balanceBefore),
    balanceAfter: Number(t.balanceAfter),
    description: t.description,
    createdAt: t.createdAt,
  };
}

export const SqlWalletRepo: IWalletRepo = {
  async findByUserId(userId) {
    const prisma = getPrismaClient();
    const w = await prisma.wallet.findUnique({ where: { userId } });
    return w ? walletToDTO(w) : null;
  },

  async findById(id) {
    const prisma = getPrismaClient();
    const w = await prisma.wallet.findUnique({ where: { id } });
    return w ? walletToDTO(w) : null;
  },

  async create(data) {
    const prisma = getPrismaClient();
    const w = await prisma.wallet.create({ data });
    return walletToDTO(w);
  },

  async deposit({ userId, amount, description }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx: any) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error('WALLET_NOT_FOUND');

      const balanceBefore = Number(wallet.balance);
      const balanceAfter = balanceBefore + amount;

      const [updatedWallet, transaction] = await Promise.all([
        tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } }),
        tx.transaction.create({
          data: { walletId: wallet.id, type: 'deposit', amount, balanceBefore, balanceAfter, description },
        }),
      ]);

      return { wallet: walletToDTO(updatedWallet), transaction: txToDTO(transaction) };
    });
  },

  async withdraw({ userId, amount, description }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx: any) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error('WALLET_NOT_FOUND');

      const balanceBefore = Number(wallet.balance);
      if (balanceBefore < amount) throw new Error('INSUFFICIENT_BALANCE');
      const balanceAfter = balanceBefore - amount;

      const [updatedWallet, transaction] = await Promise.all([
        tx.wallet.update({ where: { id: wallet.id }, data: { balance: balanceAfter } }),
        tx.transaction.create({
          data: { walletId: wallet.id, type: 'withdraw', amount, balanceBefore, balanceAfter, description },
        }),
      ]);

      return { wallet: walletToDTO(updatedWallet), transaction: txToDTO(transaction) };
    });
  },

  async transfer({ senderUserId, toWalletId, amount, description }) {
    const prisma = getPrismaClient();
    return prisma.$transaction(async (tx: any) => {
      const senderWallet = await tx.wallet.findUnique({ where: { userId: senderUserId } });
      if (!senderWallet) throw new Error('WALLET_NOT_FOUND');
      if (senderWallet.id === toWalletId) throw new Error('SELF_TRANSFER');

      const receiverWallet = await tx.wallet.findUnique({ where: { id: toWalletId } });
      if (!receiverWallet) throw new Error('RECIPIENT_NOT_FOUND');
      if (senderWallet.currency !== receiverWallet.currency) throw new Error('CURRENCY_MISMATCH');

      const senderBalanceBefore = Number(senderWallet.balance);
      if (senderBalanceBefore < amount) throw new Error('INSUFFICIENT_BALANCE');
      const senderBalanceAfter = senderBalanceBefore - amount;

      const receiverBalanceBefore = Number(receiverWallet.balance);
      const receiverBalanceAfter = receiverBalanceBefore + amount;

      await Promise.all([
        tx.wallet.update({ where: { id: senderWallet.id }, data: { balance: senderBalanceAfter } }),
        tx.wallet.update({ where: { id: receiverWallet.id }, data: { balance: receiverBalanceAfter } }),
        tx.transaction.create({
          data: { walletId: senderWallet.id, type: 'transfer_out', amount, balanceBefore: senderBalanceBefore, balanceAfter: senderBalanceAfter, description },
        }),
        tx.transaction.create({
          data: { walletId: receiverWallet.id, type: 'transfer_in', amount, balanceBefore: receiverBalanceBefore, balanceAfter: receiverBalanceAfter, description },
        }),
      ]);

      return { balance: senderBalanceAfter };
    });
  },
};
