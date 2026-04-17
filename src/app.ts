import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { getDbType, isSqlDb } from './types/db';
import { initRepositories } from './repositories/registry';
import authRoutes from './routes/auth.routes';
import walletRoutes from './routes/wallet.routes';
import transactionRoutes from './routes/transaction.routes';

const dbType = getDbType();

function applySqlDatabaseUrlFromDbType(): void {
  if (dbType === 'postgres') {
    const pgUrl = process.env.DATABASE_URL_POSTGRES;
    if (!pgUrl) {
      console.error('Missing required environment variable: DATABASE_URL_POSTGRES');
      process.exit(1);
    }
    process.env.DATABASE_URL = pgUrl;
    return;
  }

  if (dbType === 'mysql') {
    const mysqlUrl = process.env.DATABASE_URL_MYSQL;
    if (!mysqlUrl) {
      console.error('Missing required environment variable: DATABASE_URL_MYSQL');
      process.exit(1);
    }
    process.env.DATABASE_URL = mysqlUrl;
  }
}

if (isSqlDb()) {
  applySqlDatabaseUrlFromDbType();
}

const ALWAYS_REQUIRED = ['JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'MONGO_URI'];

const DB_REQUIRED = isSqlDb() ? ['DATABASE_URL'] : [];

const PAPERMAP_REQUIRED =
  dbType === 'postgres'
    ? ['PAPERMAP_API_KEY_ID_POSTGRES', 'PAPERMAP_SECRET_KEY_POSTGRES', 'PAPERMAP_WORKSPACE_ID_POSTGRES']
    : dbType === 'mysql'
    ? ['PAPERMAP_API_KEY_ID_SQL', 'PAPERMAP_SECRET_KEY_SQL', 'PAPERMAP_WORKSPACE_ID_SQL']
    : ['PAPERMAP_API_KEY_ID', 'PAPERMAP_SECRET_KEY', 'PAPERMAP_WORKSPACE_ID'];

for (const v of [...ALWAYS_REQUIRED, ...DB_REQUIRED, ...PAPERMAP_REQUIRED]) {
  if (!process.env[v]) {
    console.error(`Missing required environment variable: ${v}`);
    process.exit(1);
  }
}

initRepositories();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3001',
  methods: ['GET', 'POST'],
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/transactions', transactionRoutes);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong' });
});

async function startServer() {
  // MongoDB always connects — it is the permanent auth DB regardless of DB_TYPE
  const connectDB = (await import('./db/connect')).default;
  await connectDB();

  if (isSqlDb()) {
    const { connectSql } = await import('./db/prisma');
    await connectSql();
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [DB: ${getDbType()}]`);
  });
}

startServer().catch((err: Error) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

export default app;
