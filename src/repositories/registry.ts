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

  if (dbType === 'postgres' || dbType === 'mysql') {
    UserRepo = require('./sql/user.repo.sql').SqlUserRepo;
    WalletRepo = require('./sql/wallet.repo.sql').SqlWalletRepo;
    TransactionRepo = require('./sql/transaction.repo.sql').SqlTransactionRepo;
    TenantDashboardRepo = require('./sql/tenantDashboard.repo.sql').SqlTenantDashboardRepo;
  } else {
    UserRepo = require('./mongo/user.repo.mongo').MongoUserRepo;
    WalletRepo = require('./mongo/wallet.repo.mongo').MongoWalletRepo;
    TransactionRepo = require('./mongo/transaction.repo.mongo').MongoTransactionRepo;
    TenantDashboardRepo = require('./mongo/tenantDashboard.repo.mongo').MongoTenantDashboardRepo;
  }

  console.log(`Repositories initialised [DB: ${dbType}]`);
}
