import { getPrismaClient } from '../../db/prisma';
import { IUserRepo, UserDTO, PasskeyDTO } from '../interfaces/user.repo.interface';

function passkeyToDTO(pk: any): PasskeyDTO {
  return {
    credentialID: pk.credentialID,
    credentialPublicKey: Buffer.isBuffer(pk.credentialPublicKey)
      ? pk.credentialPublicKey
      : Buffer.from(pk.credentialPublicKey),
    counter: pk.counter,
    // MySQL stores transports as Json, Postgres as String[]
    transports: Array.isArray(pk.transports)
      ? pk.transports
      : JSON.parse(pk.transports as string ?? '[]'),
  };
}

function toDTO(user: any): UserDTO {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    refreshToken: user.refreshToken ?? null,
    currentChallenge: user.currentChallenge ?? null,
    currentChallengeExpiresAt: user.currentChallengeExpiresAt ?? null,
    passkeys: (user.passkeys ?? []).map(passkeyToDTO),
    createdAt: user.createdAt,
  };
}

export const SqlUserRepo: IUserRepo = {
  async findById(id) {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { id }, include: { passkeys: true } });
    return user ? toDTO(user) : null;
  },

  async findByEmail(email) {
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { email }, include: { passkeys: true } });
    return user ? toDTO(user) : null;
  },

  async findByCredentialID(credentialID) {
    const prisma = getPrismaClient();
    const passkey = await prisma.passkey.findUnique({
      where: { credentialID },
      include: { user: { include: { passkeys: true } } },
    });
    return passkey ? toDTO(passkey.user) : null;
  },

  async create(data) {
    const prisma = getPrismaClient();
    const user = await prisma.user.create({ data, include: { passkeys: true } });
    return toDTO(user);
  },

  async updateRefreshToken(id, hashedToken) {
    const prisma = getPrismaClient();
    await prisma.user.update({ where: { id }, data: { refreshToken: hashedToken } });
  },

  async updateChallenge(id, challenge, expiresAt) {
    const prisma = getPrismaClient();
    await prisma.user.update({
      where: { id },
      data: { currentChallenge: challenge, currentChallengeExpiresAt: expiresAt },
    });
  },

  async addPasskey(id, passkey) {
    const prisma = getPrismaClient();
    await prisma.passkey.create({
      data: {
        userId: id,
        credentialID: passkey.credentialID,
        credentialPublicKey: passkey.credentialPublicKey,
        counter: passkey.counter,
        transports: passkey.transports,
      },
    });
  },

  async updatePasskeyCounter(userId, credentialID, newCounter) {
    const prisma = getPrismaClient();
    await prisma.passkey.update({
      where: { credentialID },
      data: { counter: newCounter },
    });
  },
};
