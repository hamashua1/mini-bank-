import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepo } from '../repositories/registry';
import { AuthRequest } from '../middleware/auth';
import { getOrCreateTenantDashboard, generatePapermapToken } from '../services/papermap.service';

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

    const existing = await UserRepo.findByEmail(email);
    if (existing) {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await UserRepo.create({ email, passwordHash });

    try {
      await getOrCreateTenantDashboard(user.id, user.email);
    } catch {
      // Non-fatal: account is created, dashboard provisioned on first login if this fails
    }

    res.status(201).json({ message: 'Account created successfully', userId: user.id });
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

    const user = await UserRepo.findByEmail(email);
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
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as any }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d') as any }
    );

    const hashedRefresh = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    await UserRepo.updateRefreshToken(user.id, hashedRefresh);

    let papermapToken: string | null = null;
    try {
      const dashboardId = await getOrCreateTenantDashboard(user.id, user.email);
      papermapToken = generatePapermapToken(dashboardId, user.id);
    } catch {
      // Non-fatal
    }

    res.status(200).json({ message: 'Login successful', accessToken, refreshToken, papermapToken });
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

    const user = await UserRepo.findById(decoded.userId);
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
      { userId: user.id },
      process.env.JWT_SECRET as string,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as any }
    );

    const newRefreshToken = jwt.sign(
      { userId: user.id },
      process.env.REFRESH_TOKEN_SECRET as string,
      { expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN || '7d') as any }
    );

    const hashedRefresh = await bcrypt.hash(newRefreshToken, SALT_ROUNDS);
    await UserRepo.updateRefreshToken(user.id, hashedRefresh);

    let papermapToken: string | null = null;
    try {
      const dashboardId = await getOrCreateTenantDashboard(user.id, user.email);
      papermapToken = generatePapermapToken(dashboardId, user.id);
    } catch {
      // Non-fatal
    }

    res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken, papermapToken });
  } catch {
    res.status(500).json({ message: 'Token refresh failed' });
  }
};

export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await UserRepo.updateRefreshToken(req.userId!, null);
    res.status(200).json({ message: 'Logged out successfully' });
  } catch {
    res.status(500).json({ message: 'Logout failed' });
  }
};

export const getPapermapToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await UserRepo.findById(req.userId!);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    let dashboardId: string;
    try {
      dashboardId = await getOrCreateTenantDashboard(user.id, user.email);
    } catch {
      res.status(503).json({ message: 'Could not provision Papermap dashboard' });
      return;
    }

    const papermapToken = generatePapermapToken(dashboardId, user.id);
    res.status(200).json({ papermapToken });
  } catch {
    res.status(500).json({ message: 'Failed to generate Papermap token' });
  }
};
