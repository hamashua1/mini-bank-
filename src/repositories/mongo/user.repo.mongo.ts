import { UserModel } from '../../models/user.model';
import { IUserRepo, UserDTO, PasskeyDTO } from '../interfaces/user.repo.interface';

function toDTO(doc: any): UserDTO {
  return {
    id: doc._id.toString(),
    email: doc.email,
    passwordHash: doc.passwordHash,
    refreshToken: doc.refreshToken ?? null,
    currentChallenge: doc.currentChallenge ?? null,
    currentChallengeExpiresAt: doc.currentChallengeExpiresAt ?? null,
    passkeys: (doc.passkeys ?? []).map((pk: any): PasskeyDTO => ({
      credentialID: pk.credentialID,
      credentialPublicKey: Buffer.isBuffer(pk.credentialPublicKey)
        ? pk.credentialPublicKey
        : Buffer.from(pk.credentialPublicKey.buffer ?? pk.credentialPublicKey),
      counter: pk.counter,
      transports: pk.transports ?? [],
    })),
    createdAt: doc.createdAt,
  };
}

export const MongoUserRepo: IUserRepo = {
  async findById(id) {
    const doc = await UserModel.findById(id);
    return doc ? toDTO(doc) : null;
  },

  async findByEmail(email) {
    const doc = await UserModel.findOne({ email });
    return doc ? toDTO(doc) : null;
  },

  async findByCredentialID(credentialID) {
    const doc = await UserModel.findOne({ 'passkeys.credentialID': credentialID });
    return doc ? toDTO(doc) : null;
  },

  async create(data) {
    const doc = await UserModel.create(data);
    return toDTO(doc);
  },

  async updateRefreshToken(id, hashedToken) {
    await UserModel.findByIdAndUpdate(id, { refreshToken: hashedToken });
  },

  async updateChallenge(id, challenge, expiresAt) {
    await UserModel.findByIdAndUpdate(id, {
      currentChallenge: challenge,
      currentChallengeExpiresAt: expiresAt,
    });
  },

  async addPasskey(id, passkey) {
    await UserModel.findByIdAndUpdate(id, { $push: { passkeys: passkey } });
  },

  async updatePasskeyCounter(userId, credentialID, newCounter) {
    await UserModel.updateOne(
      { _id: userId, 'passkeys.credentialID': credentialID },
      { $set: { 'passkeys.$.counter': newCounter } }
    );
  },
};
