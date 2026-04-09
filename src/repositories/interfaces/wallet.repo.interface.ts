export type TransactionType = 'deposit' | 'withdraw' | 'transfer_in' | 'transfer_out';

export interface WalletDTO {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  createdAt: Date;
}

export interface TransactionDTO {
  id: string;
  walletId: string;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: Date;
}

export interface IWalletRepo {
  findByUserId(userId: string): Promise<WalletDTO | null>;
  findById(id: string): Promise<WalletDTO | null>;
  create(data: { userId: string; balance: number; currency: string }): Promise<WalletDTO>;
  deposit(params: { userId: string; amount: number; description: string }): Promise<{ wallet: WalletDTO; transaction: TransactionDTO }>;
  withdraw(params: { userId: string; amount: number; description: string }): Promise<{ wallet: WalletDTO; transaction: TransactionDTO }>;
  transfer(params: { senderUserId: string; toWalletId: string; amount: number; description: string }): Promise<{ balance: number }>;
}
