import axiosInstance from './axiosInstance'
import { ApiResponse, Account, AccountListData } from './types'

export const accountService = {
  // Lấy danh sách tài khoản an toàn theo người dùng trong JWT
  getAccountList: async (): Promise<ApiResponse<AccountListData>> => {
    const response = await axiosInstance.get('/v1/accounts')
    return response.data
  },

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
  createAccount: async (data: Omit<Account, 'account_id'>): Promise<ApiResponse<Account>> => {
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

