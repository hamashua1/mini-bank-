import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { AuthRequest } from '../middleware/auth';

const SALT_ROUNDS = 10;

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      res.status(400).json({ message: 'Valid email is required' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters' });
      return;
    }

    const existing = await UserModel.findOne({ email });
    if (existing) {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await UserModel.create({ email, passwordHash });

    res.status(201).json({ message: 'Account created successfully', userId: user._id });
  } catch {
    res.status(500).json({ message: 'Signup failed' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      res.status(400).json({ message: 'Valid email is required' });
      return;
    }
    if (!password || typeof password !== 'string') {
      res.status(400).json({ message: 'Password is required' });
      return;
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

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
    res.status(500).json({ message: 'Login failed' });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== 'string') {
      res.status(400).json({ message: 'Refresh token is required' });
      return;
    }

    let decoded: { userId: string };
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string) as { userId: string };
    } catch {
      res.status(401).json({ message: 'Invalid or expired refresh token' });
      return;
    }

    const user = await UserModel.findById(decoded.userId);
    if (!user || !user.refreshToken) {
      res.status(401).json({ message: 'Invalid or expired refresh token' });
      return;
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid or expired refresh token' });
      return;
    }

    const newAccessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET as string,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as any }
    );

    const newRefreshToken = jwt.sign(
      { userId: user._id },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d') as any }
    );

    user.refreshToken = await bcrypt.hash(newRefreshToken, SALT_ROUNDS);
    await user.save();

    res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch {
    res.status(500).json({ message: 'Token refresh failed' });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await UserModel.findByIdAndUpdate(req.userId, { refreshToken: null });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch {
    res.status(500).json({ message: 'Logout failed' });
  }
};
