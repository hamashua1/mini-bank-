import mongoose, { Document, Schema } from 'mongoose';

export type TransactionType = 'deposit' | 'withdraw' | 'transfer_in' | 'transfer_out';

export interface ITransaction extends Document {
  walletId: mongoose.Types.ObjectId;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
    type: {
      type: String,
      enum: ['deposit', 'withdraw', 'transfer_in', 'transfer_out'],
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const TransactionModel = mongoose.model<ITransaction>('Transaction', transactionSchema);
