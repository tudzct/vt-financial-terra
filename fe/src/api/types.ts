// Định nghĩa các type cho API response

export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
}

export interface User {
  user_id: number
  full_name: string
  email: string
  username: string
  phone_number?: string
  profile_picture_url?: string
  total_balance: number
}

export interface Account {
  account_id: number
  user_id: number
  bank_name: string
  account_type: 'Checking' | 'Credit Card' | 'Savings' | 'Investment' | 'Loan'
  branch_name?: string
  account_number_full?: string
  account_number_last_4?: string
  balance: number
}

/** Payload accepted by the protected API-ACCOUNT-CREATE endpoint. */
export interface CreateAccountPayload {
  bank_name: string
  account_type: Account['account_type']
  branch_name?: string
  account_number_full: string
  balance: number
}

/** Safe account fields returned after a successful account creation. */
export interface CreatedAccount {
  id: number
  user_id: number
  bank_name: string
  account_type: Account['account_type']
  branch_name: string | null
  account_number_last_4: string
  balance: number
}

export interface Category {
  category_id: number
  category_name: string
}

export interface Transaction {
  transaction_id: number
  account_id: number
  transaction_date: string
  type: 'Revenue' | 'Expense'
  item_description: string
  shop_name?: string
  amount: number
  payment_method?: string
  status: 'Complete' | 'Pending' | 'Failed'
  receipt_id?: string
  category_id?: number
}

/** Request payload accepted by API-TRANSACTION-CREATE. */
export interface CreateTransactionPayload {
  accountId: number
  transactionDate: string
  type: 'Revenue' | 'Expense'
  itemDescription: string
  category_id: number | null
  shopName: string
  amount: number
  paymentMethod: string
  status: 'Complete' | 'Pending' | 'Failed'
}

/** Response data returned after a transaction and balance are committed. */
export interface CreatedTransaction {
  transactionId: number
  accountId: number
  transactionDate: string
  type: 'Revenue' | 'Expense'
  itemDescription: string
  shopName: string
  amount: number
  paymentMethod: string
  status: 'Complete' | 'Pending' | 'Failed'
  receiptId: null
  createdAt: string
  category_id: number | null
}

export interface TransactionListResponse {
  data: Transaction[]
  total: number
  hasMore: boolean
}

export interface Bill {
  bill_id: number
  user_id: number
  due_date: string
  logo_url?: string
  item_description: string
  last_charge_date?: string
  amount: number
}

export interface Goal {
  goal_id: number
  user_id: number
  goal_type: 'Saving' | 'Expense_Limit'
  category_id: number
  start_date: string
  end_date: string
  target_amount: number
  target_achieved: boolean
  last_updated: string
}

