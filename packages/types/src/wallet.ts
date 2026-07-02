import type { ID } from "./user";

export type CoinTransactionType =
  | "purchase"
  | "tip"
  | "unlock"
  | "boost"
  | "refund"
  | "reversal"
  | "admin_adjustment"
  | "fraud_hold";

export type WalletTransaction = {
  id: ID;
  type: CoinTransactionType | "adjustment";
  amount: number;
  label: string;
  relatedUserId?: ID;
  relatedVideoId?: ID;
  createdAt: string;
};

export type Wallet = {
  id: ID;
  userId: ID;
  coinBalance: number;
  lockedBalance: number;
  updatedAt: string;
};
