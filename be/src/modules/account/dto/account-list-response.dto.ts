/** Account shape returned to the transaction form. */
export interface AccountListItemDto {
  account_id: number;
  user_id: number;
  bank_name: string;
  account_type: string;
  branch_name?: string;
  account_number_full?: string;
  account_number_last_4: string;
  balance: number;
}

/** Standard API envelope for an account-list response. */
export interface AccountListResponseDto {
  success: true;
  message: string;
  data: AccountListItemDto[];
}
