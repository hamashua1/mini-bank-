import mongoose from 'mongoose';
import { WalletModel } from '../models/wallet.model';

const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI;

  if (!uri) throw new Error('MONGO_URI is not defined in .env');

  await mongoose.connect(uri);

  // Backfill walletId for any documents missing it
  const walletDocs = await WalletModel.find(
    { $or: [{ walletId: { $exists: false } }, { walletId: null }, { walletId: '' }] },
    { _id: 1 }
  ).lean();
  for (const doc of walletDocs) {
    await WalletModel.updateOne({ _id: doc._id }, { $set: { walletId: doc._id.toString() } });
  }

  // Backfill userId: convert any ObjectId-typed userId values to strings so that
  // Papermap tenant-scoping (string comparison) correctly matches wallet documents.
  const db = mongoose.connection.db;
  if (db) {
    const walletsCollection = db.collection('wallets');
    const objectIdUserIdDocs = await walletsCollection
      .find({ userId: { $type: 'objectId' } }, { projection: { _id: 1, userId: 1 } })
      .toArray();
    for (const doc of objectIdUserIdDocs) {
      await walletsCollection.updateOne(
        { _id: doc._id },
        { $set: { userId: doc.userId.toString() } }
      );
    }
  }

  console.log('MongoDB connected');
};

export default connectDB;
