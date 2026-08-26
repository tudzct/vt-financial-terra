import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AxiosError } from 'axios'
import { transactionService } from '../../api/transaction.service'
import { Transaction } from '../../api/types'
import Loading from '../../components/Loading/Loading'
import AddTransactionForm from '../../components/AddTransactionForm/AddTransactionForm'

type FilterType = 'All' | 'Revenue' | 'Expense'

const PAGE_SIZE = 10
const DEFAULT_ERROR_MESSAGE = 'Unable to load transactions. Please try again.'

const filters: Array<{ label: string; value: FilterType }> = [
  { label: 'All', value: 'All' },
  { label: 'Revenue', value: 'Revenue' },
  { label: 'Expenses', value: 'Expense' },
]

/** Displays the authenticated user's filterable transaction history. */
const Transactions: React.FC = () => {
  const [filterType, setFilterType] = useState<FilterType>('All')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAddingTransaction, setIsAddingTransaction] = useState(false)
  const requestIdRef = useRef(0)

  /** Requests one validated transaction page and preserves stable list state. */
  const fetchTransactions = useCallback(
    async (nextOffset: number, shouldReplace: boolean, type: FilterType = filterType) => {
      const requestId = ++requestIdRef.current
      setIsLoading(true)
      setError('')

      try {
        const response = await transactionService.listTransactions({
          type,
          limit: PAGE_SIZE,
          offset: nextOffset,
        })

        if (requestId !== requestIdRef.current) return

        setTransactions((currentTransactions) => (
          shouldReplace ? response.data : [...currentTransactions, ...response.data]
        ))
        setOffset(nextOffset + response.data.length)
        setHasMore(response.hasMore)
      } catch (requestError) {
        if (requestId !== requestIdRef.current) return

        const apiError = requestError as AxiosError<{ message?: string | string[] }>
        const message = apiError.response?.data?.message
        setError(Array.isArray(message) ? message[0] : message || DEFAULT_ERROR_MESSAGE)
      } finally {
        if (requestId === requestIdRef.current) setIsLoading(false)
      }
    },
    [filterType],
  )

  /** Resets pagination whenever the selected transaction filter changes. */
  useEffect(() => {
    setTransactions([])
    setOffset(0)
    setHasMore(false)
    void fetchTransactions(0, true, filterType)
  }, [fetchTransactions, filterType])

  /** Changes the visible filter without navigating away from the page. */
  const handleFilterChange = (nextFilter: FilterType) => {
    if (!isLoading && nextFilter !== filterType) setFilterType(nextFilter)
  }

  /** Loads the next page only when another page is available. */
  const handleLoadMore = () => {
    if (!isLoading && hasMore) void fetchTransactions(offset, false)
  }

  if (isAddingTransaction) {
    return <AddTransactionForm onCancel={() => setIsAddingTransaction(false)} />
  }

  return (
    <section className="relative">
      {error && (
        <div
          className="fixed right-6 top-6 z-50 max-w-sm rounded-lg border border-red-200 bg-white px-4 py-3 text-sm font-medium text-red-700 shadow-lg"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-normal text-[#8b8b8b]">Recent Transaction</h1>
        <button
          type="button"
          onClick={() => setIsAddingTransaction(true)}
          className="flex h-[46px] items-center gap-2 rounded bg-[#2fa096] px-5 text-sm font-semibold text-white transition hover:bg-[#278d84]"
        >
          <span className="text-lg leading-none" aria-hidden="true">+</span>
          Add Transaction
        </button>
      </div>
      <div className="mt-4 flex h-9 items-start gap-8" role="tablist" aria-label="Transaction type">
        {filters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={filter.value === filterType}
            disabled={isLoading}
            onClick={() => handleFilterChange(filter.value)}
            className={`h-9 border-b-2 px-1 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
              filter.value === filterType
                ? 'border-[#2aa49a] text-[#2aa49a]'
                : 'border-transparent text-[#55565a] hover:text-[#2aa49a]'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-xl bg-white px-5 pb-10 pt-2 shadow-[0_15px_20px_rgba(34,45,61,0.10)]">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full table-fixed text-left text-sm">
            <thead className="border-b border-[#f0f0f0]">
              <tr className="h-14 font-semibold text-[#272727]">
                <th className="w-[28%] px-2">Items</th>
                <th className="w-[22%] px-2">Shop Name</th>
                <th className="w-[21%] px-2">Date</th>
                <th className="w-[19%] px-2">Payment Method</th>
                <th className="w-[10%] px-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f0f0] text-[#66676a]">
              {isLoading && transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-16">
                    <Loading message="Loading transactions..." />
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-2 py-16 text-center text-sm text-[#77787b]">
                    No transactions match this filter yet.
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => {
                  const isRevenue = transaction.type === 'Revenue'
                  const formattedDate = new Intl.DateTimeFormat('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(`${transaction.transaction_date}T00:00:00Z`)).replace(/ (\d{4})$/, ', $1')
                  const formattedAmount = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(Math.abs(Number(transaction.amount)))

                  return (
                    <tr key={transaction.transaction_id} className="h-[72px] transition-colors hover:bg-[#fafafa]">
                      <td className="px-2">
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center text-base text-[#55565a]" aria-hidden="true">
                            {isRevenue ? '↙' : '⌂'}
                          </span>
                          <p className="truncate font-semibold text-[#303034]">{transaction.item_description}</p>
                        </div>
                      </td>
                      <td className="truncate px-2">{transaction.shop_name || '—'}</td>
                      <td className="whitespace-nowrap px-2">{formattedDate}</td>
                      <td className="truncate px-2">{transaction.payment_method || '—'}</td>
                      <td className="whitespace-nowrap px-2 text-right font-semibold text-[#2d2d30]">{formattedAmount}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-10 text-center">
          <button
            type="button"
            disabled={isLoading || !hasMore}
            onClick={handleLoadMore}
            className="h-12 min-w-[172px] rounded bg-[#2aa49a] px-6 text-sm font-semibold text-white transition hover:bg-[#248f86] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      </div>
    </section>
  )
}

export default Transactions
