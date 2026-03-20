import mongoose, { Document, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  balance: number;
  currency: string;
  walletId: string;
  createdAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    balance: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, uppercase: true, trim: true },
    walletId: { type: String, required: true, unique: true, default: () => uuidv4() },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const WalletModel = mongoose.model<IWallet>('Wallet', walletSchema);
