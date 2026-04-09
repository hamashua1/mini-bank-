import { getDbType } from '../types/db';

let prismaInstance: any;

export function getPrismaClient(): any {
  if (!prismaInstance) {
    const dbType = getDbType();
    if (dbType === 'postgres') {
      const { PrismaClient } = require('../../node_modules/.prisma/client-postgres');
      prismaInstance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
      });
    } else if (dbType === 'mysql') {
      const { PrismaClient } = require('../../node_modules/.prisma/client-mysql');
      prismaInstance = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
      });
    }
  }
  return prismaInstance;
}

export async function connectSql(): Promise<void> {
  const client = getPrismaClient();
  await client.$connect();
  console.log(`${getDbType().toUpperCase()} connected via Prisma`);
}
