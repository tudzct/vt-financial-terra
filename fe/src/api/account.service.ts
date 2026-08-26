import axiosInstance from './axiosInstance'
import { ApiResponse, Account, CreateAccountPayload, CreatedAccount } from './types'

export const accountService = {
  // Lấy danh sách tài khoản của user
  getAccounts: async (): Promise<ApiResponse<Account[]>> => {
    const response = await axiosInstance.get('/accounts')
    return response.data
  },

  // Lấy chi tiết một tài khoản
  getAccount: async (accountId: number): Promise<ApiResponse<Account>> => {
    const response = await axiosInstance.get(`/accounts/${accountId}`)
    return response.data
  },

  // Tạo tài khoản mới
  /** Creates one owned account using API-ACCOUNT-CREATE. */
  createAccount: async (data: CreateAccountPayload): Promise<ApiResponse<{ account: CreatedAccount }>> => {
    const response = await axiosInstance.post('/accounts', data)
    return response.data
  },

  // Cập nhật tài khoản
  updateAccount: async (accountId: number, data: Partial<Account>): Promise<ApiResponse<Account>> => {
    const response = await axiosInstance.put(`/accounts/${accountId}`, data)
    return response.data
  },

  // Xóa tài khoản
  deleteAccount: async (accountId: number): Promise<ApiResponse<void>> => {
    const response = await axiosInstance.delete(`/accounts/${accountId}`)
    return response.data
  },
}

