import { TransactionModel } from '../../models/transaction.model';
import { ITransactionRepo, PaginatedTransactions } from '../interfaces/transaction.repo.interface';
import { TransactionDTO, TransactionType } from '../interfaces/wallet.repo.interface';
import mongoose from 'mongoose';

function toDTO(doc: any): TransactionDTO {
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

export const MongoTransactionRepo: ITransactionRepo = {
  async findByWalletId({ walletId, typeFilter, skip, limit }) {
    const query: any = { walletId };
    if (typeFilter) query.type = { $in: typeFilter };

    const [docs, total] = await Promise.all([
      TransactionModel.find(query)
        .select('type amount balanceBefore balanceAfter description createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      TransactionModel.countDocuments(query),
    ]);

    return { transactions: docs.map(toDTO), total };
  },

  async findByIdAndWalletId(id, walletId) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await TransactionModel.findOne({ _id: id, walletId })
      .select('type amount balanceBefore balanceAfter description createdAt');
    return doc ? toDTO(doc) : null;
  },
};
