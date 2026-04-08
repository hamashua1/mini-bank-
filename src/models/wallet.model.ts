import mongoose, { Document, Schema } from 'mongoose';

export interface IWallet extends Document {
  userId: mongoose.Types.ObjectId;
  balance: number;
  currency: string;
  createdAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    balance: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, uppercase: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

walletSchema.index({ userId: 1 }, { unique: true });

export const WalletModel = mongoose.model<IWallet>('Wallet', walletSchema);
