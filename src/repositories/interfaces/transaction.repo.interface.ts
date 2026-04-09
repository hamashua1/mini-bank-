import { TransactionDTO, TransactionType } from './wallet.repo.interface';

export interface PaginatedTransactions {
  transactions: TransactionDTO[];
  total: number;
}

export interface ITransactionRepo {
  findByWalletId(params: {
    walletId: string;
    typeFilter?: TransactionType[];
    skip: number;
    limit: number;
  }): Promise<PaginatedTransactions>;
  findByIdAndWalletId(id: string, walletId: string): Promise<TransactionDTO | null>;
}
