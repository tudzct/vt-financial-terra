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

/** Defines the safe account fields returned by the account-list endpoint. */
export interface AccountListItem {
  id: number
  bank_name: string
  account_type: Account['account_type']
  branch_name: string | null
  account_number_last_4: string
  balance: number
}

/** Defines the account-list response data returned for the authenticated user. */
export interface AccountListData {
  user_id: number
  accounts: AccountListItem[]
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

