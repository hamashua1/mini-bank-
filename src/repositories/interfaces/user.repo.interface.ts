export interface PasskeyDTO {
  credentialID: string;
  credentialPublicKey: Buffer;
  counter: number;
  transports: string[];
}

export interface UserDTO {
  id: string;
  email: string;
  passwordHash: string;
  refreshToken: string | null;
  currentChallenge: string | null;
  currentChallengeExpiresAt: Date | null;
  passkeys: PasskeyDTO[];
  createdAt: Date;
}

export interface IUserRepo {
  findById(id: string): Promise<UserDTO | null>;
  findByEmail(email: string): Promise<UserDTO | null>;
  findByCredentialID(credentialID: string): Promise<UserDTO | null>;
  create(data: { email: string; passwordHash: string }): Promise<UserDTO>;
  updateRefreshToken(id: string, hashedToken: string | null): Promise<void>;
  updateChallenge(id: string, challenge: string | null, expiresAt: Date | null): Promise<void>;
  addPasskey(id: string, passkey: PasskeyDTO): Promise<void>;
  updatePasskeyCounter(userId: string, credentialID: string, newCounter: number): Promise<void>;
}
