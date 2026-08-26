import { Allow } from 'class-validator';

/** Retains the transaction-create contract for service-level normalization and validation. */
export class CreateTransactionDto {
  @Allow()
  accountId: unknown;

  @Allow()
  transactionDate: unknown;

  @Allow()
  type: unknown;

  @Allow()
  itemDescription: unknown;

  @Allow()
  category_id?: unknown;

  @Allow()
  shopName: unknown;

  @Allow()
  amount: unknown;

  @Allow()
  paymentMethod: unknown;

  @Allow()
  status?: unknown;
}

/** Defines the API-TRANSACTION-CREATE response payload. */
export interface CreateTransactionResponseDto {
  success: true;
  message: 'Transaction created successfully';
  data: {
    transactionId: number;
    accountId: number;
    transactionDate: string;
    type: TransactionCreateType;
    itemDescription: string;
    shopName: string;
    amount: number;
    paymentMethod: string;
    status: TransactionCreateStatus;
    receiptId: null;
    createdAt: string;
    category_id: number | null;
  };
}

export type TransactionCreateType = 'Revenue' | 'Expense';
export type TransactionCreateStatus = 'Complete' | 'Pending' | 'Failed';
