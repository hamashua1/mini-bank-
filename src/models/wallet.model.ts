import mongoose, { Document, Schema } from 'mongoose';

export interface IWallet extends Document {
  userId: string;
  walletId: string;
  balance: number;
  currency: string;
  createdAt: Date;
}

const walletSchema = new Schema<IWallet>(
  {
    userId: { type: String, ref: 'User', required: true },
    walletId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: function defaultWalletId(this: { _id: mongoose.Types.ObjectId }) {
        return this._id.toString();
      },
    },
    balance: { type: Number, required: true, default: 0 },
    currency: { type: String, required: true, uppercase: true, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

walletSchema.index({ userId: 1 }, { unique: true });

export const WalletModel = mongoose.model<IWallet>('Wallet', walletSchema);
