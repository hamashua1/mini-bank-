import mongoose, { Document, Schema } from 'mongoose';

export interface IPasskey {
  credentialID: string;
  credentialPublicKey: Buffer;
  counter: number;
  transports: string[];
}

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  refreshToken: string | null;
  currentChallenge: string | null;
  currentChallengeExpiresAt: Date | null;
  passkeys: IPasskey[];
  createdAt: Date;
}

const passkeySchema = new Schema<IPasskey>(
  {
    credentialID: { type: String, required: true },
    credentialPublicKey: { type: Buffer, required: true },
    counter: { type: Number, required: true, default: 0 },
    transports: { type: [String], default: [] },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    refreshToken: { type: String, default: null },
    currentChallenge: { type: String, default: null },
    currentChallengeExpiresAt: { type: Date, default: null },
    passkeys: { type: [passkeySchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const UserModel = mongoose.model<IUser>('User', userSchema);
