import { getPrismaClient } from '../../db/prisma';
import { ITransactionRepo, PaginatedTransactions } from '../interfaces/transaction.repo.interface';
import { TransactionDTO, TransactionType } from '../interfaces/wallet.repo.interface';

function toDTO(t: any): TransactionDTO {
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

export const SqlTransactionRepo: ITransactionRepo = {
  async findByWalletId({ walletId, typeFilter, skip, limit }) {
    const prisma = getPrismaClient();
    const where: any = { walletId };
    if (typeFilter) where.type = { in: typeFilter };

    const [docs, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        select: { id: true, walletId: true, type: true, amount: true, balanceBefore: true, balanceAfter: true, description: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions: docs.map(toDTO), total };
  },

  async findByIdAndWalletId(id, walletId) {
    const prisma = getPrismaClient();
    const doc = await prisma.transaction.findFirst({
      where: { id, walletId },
      select: { id: true, walletId: true, type: true, amount: true, balanceBefore: true, balanceAfter: true, description: true, createdAt: true },
    });
    return doc ? toDTO(doc) : null;
  },
};
