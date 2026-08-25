import { AxiosError } from 'axios'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { accountService } from '../../api/account.service'
import { AccountListItem } from '../../api/types'

/** Displays the authenticated user's account balances and list actions. */
const AccountListPage: React.FC = () => {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<AccountListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const isRequestingRef = useRef(false)

  /** Loads the safe account list once and keeps API failures in the page state. */
  const loadAccounts = async () => {
    if (isRequestingRef.current) {
      return
    }

    isRequestingRef.current = true
    setIsLoading(true)
    setErrorMessage('')

    try {
      const response = await accountService.getAccountList()

      if (!response.success || !response.data) {
        throw new Error(response.message || 'Unable to load accounts. Please try again later.')
      }

      setAccounts(response.data.accounts)
    } catch (error) {
      const apiError = error as AxiosError<{ message?: string }>

      if (apiError.response?.status !== 401) {
        setErrorMessage(
          apiError.response?.data?.message
            || apiError.message
            || 'Unable to load accounts. Please try again later.',
        )
      }
    } finally {
      isRequestingRef.current = false
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAccounts()
    // The endpoint has no inputs; it is intentionally requested once per page mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatBalance = (balance: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balance)

  return (
    <section className="space-y-4">
      <h1 className="text-[22px] font-normal leading-8 text-[#878787]">Balances</h1>

      {errorMessage ? (
        <div className="rounded-lg bg-white p-6 text-sm text-red-600 shadow-[0_20px_12.5px_rgba(76,103,100,0.1)]" role="alert">
          {errorMessage}
        </div>
      ) : isLoading ? (
        <div className="rounded-lg bg-white p-6 text-sm text-[#666] shadow-[0_20px_12.5px_rgba(76,103,100,0.1)]">
          Loading accounts....
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow-[0_20px_12.5px_rgba(76,103,100,0.1)]">
          <p className="text-lg font-semibold text-[#191919]">No accounts yet</p>
          <p className="mt-2 text-sm text-[#878787]">Add an account to start tracking your balances.</p>
          <button
            type="button"
            onClick={() => navigate('/accounts/add')}
            className="mt-6 rounded bg-[#299d91] px-5 py-2 text-sm font-medium text-white"
          >
            Add Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {accounts.map((account) => (
            <article
              key={account.id}
              className="flex min-h-[278px] flex-col gap-6 rounded-lg bg-white p-6 shadow-[0_20px_12.5px_rgba(76,103,100,0.1)]"
            >
              <div className="flex h-11 items-center justify-between border-b border-[rgba(210,210,210,0.25)] pb-3">
                <h2 className="text-base font-bold capitalize text-[#878787]">{account.account_type}</h2>
                <span className="text-right text-xs font-medium text-[#666]">{account.bank_name}</span>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xl font-semibold leading-7 text-[#191919]">**** {account.account_number_last_4}</p>
                  <p className="mt-1 text-sm leading-5 text-[#9f9f9f]">Account Number</p>
                </div>
                <div>
                  <p className="text-xl font-semibold leading-7 text-[#191919]">{formatBalance(account.balance)}</p>
                  <p className="mt-1 text-sm leading-5 text-[#9f9f9f]">Total amount</p>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between">
                <button type="button" className="text-base leading-6 text-[#299d91]">Remove</button>
                <button
                  type="button"
                  onClick={() => navigate(`/accounts/${account.id}`)}
                  className="flex items-center gap-2 rounded bg-[#299d91] px-5 py-2 text-sm font-medium text-white"
                >
                  Details <span aria-hidden="true">›</span>
                </button>
              </div>
            </article>
          ))}

          <article className="flex min-h-[278px] flex-col justify-center rounded-lg border-2 border-dashed border-[#299d91]/40 bg-white p-6 text-center shadow-[0_20px_12.5px_rgba(76,103,100,0.1)]">
            <p className="text-lg font-semibold text-[#191919]">Add Account</p>
            <p className="mt-2 text-sm text-[#878787]">Connect another account to see its balance here.</p>
            <button
              type="button"
              onClick={() => navigate('/accounts/add')}
              className="mt-6 rounded bg-[#299d91] px-5 py-2 text-sm font-medium text-white"
            >
              Add Account
            </button>
            <button
              type="button"
              onClick={() => navigate('/accounts')}
              className="mt-3 text-sm font-medium text-[#299d91]"
            >
              Edit Accounts
            </button>
          </article>
        </div>
      )}
    </section>
  )
}

export default AccountListPage

