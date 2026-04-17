import { IUserRepo } from './interfaces/user.repo.interface';
import { IWalletRepo } from './interfaces/wallet.repo.interface';
import { ITransactionRepo } from './interfaces/transaction.repo.interface';
import { ITenantDashboardRepo } from './interfaces/tenantDashboard.repo.interface';
import { getDbType } from '../types/db';

export let UserRepo: IUserRepo;
export let WalletRepo: IWalletRepo;
export let TransactionRepo: ITransactionRepo;
export let TenantDashboardRepo: ITenantDashboardRepo;

export function initRepositories(): void {
  const dbType = getDbType();

  // UserRepo and TenantDashboardRepo are always MongoDB — MongoDB is the permanent auth DB.
  // Switching DB_TYPE never affects who can log in.
  UserRepo = require('./mongo/user.repo.mongo').MongoUserRepo;
  TenantDashboardRepo = require('./mongo/tenantDashboard.repo.mongo').MongoTenantDashboardRepo;

  if (dbType === 'postgres' || dbType === 'mysql') {
    WalletRepo = require('./sql/wallet.repo.sql').SqlWalletRepo;
    TransactionRepo = require('./sql/transaction.repo.sql').SqlTransactionRepo;
  } else {
    WalletRepo = require('./mongo/wallet.repo.mongo').MongoWalletRepo;
    TransactionRepo = require('./mongo/transaction.repo.mongo').MongoTransactionRepo;
  }

  console.log(`Repositories initialised [DB: ${dbType}]`);
}
