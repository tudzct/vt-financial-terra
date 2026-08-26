import { AxiosError } from 'axios'
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import chevronRightIcon from '../../assets/balances/chevron-right.svg'
import mastercardLogo from '../../assets/balances/mastercard.png'
import visaLogo from '../../assets/balances/visa.png'
import { accountService } from '../../api/account.service'
import { Account as AccountModel } from '../../api/types'
import Loading from '../../components/Loading/Loading'

/** Displays frame 105's balances grid using the authenticated user's accounts. */
const Account: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountModel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    const loadAccounts = async () => {
      try {
        const response = await accountService.getAccounts()
        if (isCurrent) setAccounts(response.data ?? [])
      } catch (requestError) {
        if (!isCurrent) return
        const apiError = requestError as AxiosError<{ message?: string | string[] }>
        const message = apiError.response?.data?.message
        setError(Array.isArray(message) ? message[0] : message || 'Unable to load your accounts. Please try again.')
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }
    void loadAccounts()
    return () => { isCurrent = false }
  }, [])

  return (
    <section className="mx-auto max-w-[1104px]">
      <h1 className="text-[22px] font-normal leading-8 text-[#878787]">Balances</h1>
      {error && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      {isLoading ? <div className="py-20"><Loading message="Loading balances..." /></div> : <div className="mt-4 grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">{accounts.map((account) => <AccountCard key={account.account_id} account={account} />)}<AddAccountCard /></div>}
    </section>
  )
}

/** Renders the 352 by 288 account card from the Balances Figma frame. */
const AccountCard: React.FC<{ account: AccountModel }> = ({ account }) => {
  const brand = account.account_type === 'Credit Card' ? 'Master Card' : account.bank_name
  const logo = account.account_type === 'Credit Card' ? mastercardLogo : account.account_type === 'Checking' ? visaLogo : null

  return (
    <article className="flex h-[288px] min-w-0 flex-col rounded-lg bg-white p-6 shadow-[0_20px_12.5px_rgba(76,103,100,0.10)]">
      <div className="flex h-11 items-center justify-between border-b border-[#d2d2d2]/25 pb-3"><h2 className="text-base font-bold capitalize leading-6 text-[#878787]">{account.account_type}</h2><div className="flex items-center gap-1"><span className="max-w-[180px] truncate py-2 text-right text-xs font-medium leading-4 text-[#666]">{brand}</span>{logo && <span className="flex h-8 w-12 items-center justify-center overflow-hidden"><img alt="" className={account.account_type === 'Credit Card' ? 'h-6 w-[43px] object-cover' : 'h-[14px] w-[46px] object-cover'} src={logo} /></span>}</div></div>
      <div className="mt-4 flex flex-1 flex-col"><div className="space-y-4"><AccountValue value={formatAccountNumber(account)} label="Account Number" /><AccountValue value={formatBalance(account.balance)} label="Total amount" /></div><footer className="mt-auto flex items-center justify-between"><button type="button" className="w-[116px] text-left text-base font-normal leading-6 text-[#299d91]">Remove</button><button type="button" className="flex items-center gap-2 rounded bg-[#299d91] px-5 py-2 text-sm font-medium leading-5 text-white">Details<img alt="" className="size-4" src={chevronRightIcon} /></button></footer></div>
    </article>
  )
}

/** Displays the two-line account value block shared by every card. */
const AccountValue: React.FC<{ value: string; label: string }> = ({ value, label }) => <div className="flex flex-col gap-1"><p className="min-h-7 truncate text-xl font-semibold capitalize leading-7 text-[#191919]">{value}</p><p className="text-sm font-normal leading-5 text-[#9f9f9f]">{label}</p></div>

/** Keeps the Figma grouped-number treatment while masking the final three digits. */
const formatAccountNumber = (account: AccountModel): string => {
  const accountNumber = account.account_number_full || account.account_number_last_4 || ''
  if (!accountNumber) return '***'
  const visiblePart = accountNumber.slice(0, Math.max(0, accountNumber.length - 3)).replace(/(.{4})/g, '$1 ').trim()
  return `${visiblePart}${visiblePart ? ' ' : ''}***`
}

/** Formats the persisted balance using the currency presentation shown in frame 105. */
const formatBalance = (balance: number): string => `$${Number(balance).toLocaleString('en-US', { maximumFractionDigits: 2 }).replace(/,/g, '')}`

/** Renders the final empty-grid action card in the frame-105 shown state. */
const AddAccountCard: React.FC = () => <article className="flex h-[288px] items-center rounded-lg bg-white px-6 pb-[88px] pt-[100px] shadow-[0_20px_12.5px_rgba(76,103,100,0.10)]"><div className="flex flex-col gap-1"><Link to="/accounts/add" className="w-[208px] rounded bg-[#299d91] px-8 py-3 text-center text-base font-bold capitalize leading-6 text-white">Add Accounts</Link><span className="w-[208px] px-6 py-3 text-center text-base font-medium leading-6 text-[#9f9f9f]">Edit Accounts</span></div></article>

export default Account
