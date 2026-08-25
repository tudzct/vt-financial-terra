import { AccountType } from '../account.entity';

/** Defines the safe, list-specific representation of a persisted account. */
export interface AccountListItemDto {
  id: number;
  bank_name: string;
  account_type: AccountType;
  branch_name: string | null;
  account_number_last_4: string;
  balance: number;
}

/** Defines the data payload returned by the account-list endpoint. */
export interface AccountListDataDto {
  user_id: number;
  accounts: AccountListItemDto[];
}
