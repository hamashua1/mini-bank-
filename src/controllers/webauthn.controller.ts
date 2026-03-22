import { Request, Response } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UserModel } from '../models/user.model';
import { AuthRequest } from '../middleware/auth';

const RP_NAME = 'Mini Bank';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3001';
const SALT_ROUNDS = 10;

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const pendingChallenges = new Map<string, { expiresAt: number }>();

// POST /api/auth/webauthn/register/options  (authenticated)
export const registerOptions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email,
      userDisplayName: user.email,
      attestationType: 'none',
      excludeCredentials: user.passkeys.map(pk => ({
        id: pk.credentialID,
        transports: pk.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    user.currentChallenge = options.challenge;
    user.currentChallengeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    res.status(200).json(options);
  } catch {
    res.status(500).json({ message: 'Failed to generate registration options' });
  }
};

// POST /api/auth/webauthn/register/verify  (authenticated)
export const registerVerify = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    if (!user.currentChallenge) {
      res.status(400).json({ message: 'No challenge found. Request registration options first.' });
      return;
    }

    if (!user.currentChallengeExpiresAt || user.currentChallengeExpiresAt < new Date()) {
      user.currentChallenge = null;
      user.currentChallengeExpiresAt = null;
      await user.save();
      res.status(400).json({ message: 'Challenge expired. Request registration options again.' });
      return;
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: req.body,
        expectedChallenge: user.currentChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
      });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
      return;
    }

    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ message: 'Fingerprint registration failed' });
      return;
    }

    const { credential } = verification.registrationInfo;

    user.passkeys.push({
      credentialID: credential.id,
      credentialPublicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: (req.body.response?.transports as string[]) ?? [],
    });

    user.currentChallenge = null;
    user.currentChallengeExpiresAt = null;
    await user.save();

    res.status(200).json({ message: 'Fingerprint registered successfully' });
  } catch {
    res.status(500).json({ message: 'Failed to verify fingerprint registration' });
  }
};

// POST /api/auth/webauthn/login/options  (public)
export const loginOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: [],
      userVerification: 'preferred',
    });

    pendingChallenges.set(options.challenge, { expiresAt: Date.now() + CHALLENGE_TTL_MS });

    res.status(200).json(options);
  } catch {
    res.status(500).json({ message: 'Failed to generate login options' });
  }
};

// POST /api/auth/webauthn/login/verify  (public)
export const loginVerify = async (req: Request, res: Response): Promise<void> => {
  try {
    const credential = req.body;

    if (!credential.id || typeof credential.id !== 'string') {
      res.status(400).json({ message: 'Invalid credential' });
      return;
    }

    const user = await UserModel.findOne({ 'passkeys.credentialID': credential.id });
    if (!user) {
      res.status(400).json({ message: 'Fingerprint not recognised' });
      return;
    }

    const passkey = user.passkeys.find(pk => pk.credentialID === credential.id)!;

    const clientDataJSON = JSON.parse(
      Buffer.from(credential.response.clientDataJSON, 'base64').toString()
    );
    const challenge = clientDataJSON.challenge as string;

    const pending = pendingChallenges.get(challenge);
    if (!pending) {
      res.status(400).json({ message: 'No challenge found. Request login options first.' });
      return;
    }

    pendingChallenges.delete(challenge);

    if (pending.expiresAt < Date.now()) {
      res.status(400).json({ message: 'Challenge expired. Request login options again.' });
      return;
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge: challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        credential: {
          id: passkey.credentialID,
          publicKey: new Uint8Array(passkey.credentialPublicKey),
          counter: passkey.counter,
          transports: passkey.transports as AuthenticatorTransportFuture[],
        },
      });
    } catch (err) {
      res.status(400).json({ message: (err as Error).message });
      return;
    }

    if (!verification.verified) {
      res.status(401).json({ message: 'Fingerprint authentication failed' });
      return;
    }

    passkey.counter = verification.authenticationInfo.newCounter;

    const accessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET as string,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as any }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d') as any }
    );

    user.refreshToken = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    await user.save();

    res.status(200).json({ message: 'Login successful', accessToken, refreshToken });
  } catch {
    res.status(500).json({ message: 'Fingerprint login failed' });
  }
};
