import { AxiosError } from 'axios'
import React, { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { accountService } from '../../api/account.service'
import { categoryService } from '../../api/category.service'
import { transactionService } from '../../api/transaction.service'
import { Account, Category, CreateTransactionPayload } from '../../api/types'

interface AddTransactionFormProps {
  onCancel: () => void
}

interface FormValues {
  accountId: string
  transactionDate: string
  type: 'Revenue' | 'Expense'
  itemDescription: string
  categoryId: string
  shopName: string
  amount: string
  paymentMethod: string
}

type FieldErrors = Partial<Record<keyof FormValues, string>>

const DEFAULT_API_ERROR = 'Unable to create the transaction. Please try again.'

/** Returns a timezone-safe date string for an HTML date input. */
const getToday = () => {
  const now = new Date()
  const timezoneOffset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

/** Displays the Figma-aligned UC-04 form and submits one protected transaction request. */
const AddTransactionForm: React.FC<AddTransactionFormProps> = ({ onCancel }) => {
  const navigate = useNavigate()
  const navigationTimerRef = useRef<number>()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [categoryWarning, setCategoryWarning] = useState('')
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [values, setValues] = useState<FormValues>({
    accountId: '',
    transactionDate: getToday(),
    type: 'Expense',
    itemDescription: '',
    categoryId: '',
    shopName: '',
    amount: '',
    paymentMethod: '',
  })

  useEffect(() => {
    let isCurrent = true

    const loadOptions = async () => {
      const [accountResult, categoryResult] = await Promise.allSettled([
        accountService.getAccounts(),
        categoryService.getCategories(),
      ])

      if (!isCurrent) return

      if (accountResult.status === 'fulfilled') {
        setAccounts(accountResult.value.data ?? [])
      } else {
        setFormError('Unable to load your accounts. Please try again.')
      }

      if (categoryResult.status === 'fulfilled') {
        setCategories(categoryResult.value.data ?? [])
      } else {
        setCategoryWarning('Categories could not be loaded. You can still save without a category.')
      }

      setIsLoadingOptions(false)
    }

    void loadOptions()
    return () => {
      isCurrent = false
      if (navigationTimerRef.current) window.clearTimeout(navigationTimerRef.current)
    }
  }, [])

  /** Updates a field and removes only that field's previous client-side error. */
  const updateValue = (field: keyof FormValues, value: string) => {
    setValues((currentValues) => ({ ...currentValues, [field]: value }))
    setFieldErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
    setFormError('')
  }

  /** Performs all client-applicable BR-TXN-08 and BR-TXN-09 checks. */
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}
    const normalizedText = (value: string) => value.normalize('NFC').trim()
    const amount = Number(values.amount)

    if (!/^\d+$/.test(values.accountId) || Number(values.accountId) <= 0) {
      errors.accountId = 'Select an account.'
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.transactionDate) || Number.isNaN(Date.parse(`${values.transactionDate}T00:00:00Z`))) {
      errors.transactionDate = 'Enter a valid transaction date.'
    }
    if (!normalizedText(values.itemDescription)) errors.itemDescription = 'Enter an item description.'
    if (!normalizedText(values.shopName)) errors.shopName = 'Enter a shop or recipient name.'
    if (!normalizedText(values.paymentMethod)) errors.paymentMethod = 'Enter a payment method.'
    if (!Number.isFinite(amount) || amount < 0.01 || !/^\d+(?:\.\d{1,2})?$/.test(values.amount)) {
      errors.amount = 'Enter an amount of at least 0.01 with up to two decimals.'
    }
    if (values.categoryId && (!/^\d+$/.test(values.categoryId) || Number(values.categoryId) <= 0)) {
      errors.categoryId = 'Select a valid category.'
    }

    return errors
  }

  /** Submits a normalized API-TRANSACTION-CREATE request exactly once. */
  const handleCreateTransaction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    const payload: CreateTransactionPayload = {
      accountId: Number(values.accountId),
      transactionDate: values.transactionDate,
      type: values.type,
      itemDescription: values.itemDescription.normalize('NFC').trim(),
      category_id: values.categoryId ? Number(values.categoryId) : null,
      shopName: values.shopName.normalize('NFC').trim(),
      amount: Number(values.amount),
      paymentMethod: values.paymentMethod.normalize('NFC').trim(),
      status: 'Complete',
    }

    setIsSubmitting(true)
    setFormError('')

    try {
      await transactionService.createTransactionForCurrentUser(payload)
      setSuccessMessage('Transaction created successfully')
      setFieldErrors({})
      setValues({
        accountId: '',
        transactionDate: getToday(),
        type: 'Expense',
        itemDescription: '',
        categoryId: '',
        shopName: '',
        amount: '',
        paymentMethod: '',
      })
      navigationTimerRef.current = window.setTimeout(() => navigate('/transactions'), 1500)
    } catch (requestError) {
      const apiError = requestError as AxiosError<{ message?: string | string[] }>
      const message = apiError.response?.data?.message
      setFormError(Array.isArray(message) ? message[0] : message || DEFAULT_API_ERROR)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClassName = (hasError?: string) => `h-12 w-full rounded-md border bg-white px-4 text-sm text-[#383838] outline-none transition focus:border-[#2fa096] focus:ring-2 focus:ring-[#2fa096]/20 ${
    hasError ? 'border-red-500' : 'border-[#d6d9db]'
  }`

  return (
    <section className="mx-auto max-w-[1104px] pt-[92px]">
      {successMessage && (
        <div className="fixed right-6 top-6 z-50 rounded-lg bg-[#2fa096] px-4 py-3 text-sm font-semibold text-white shadow-lg" role="status">
          {successMessage}
        </div>
      )}

      <form onSubmit={handleCreateTransaction} className="rounded-2xl bg-white px-8 py-7 shadow-[0_12px_30px_rgba(31,36,41,0.10)]">
        <h1 className="text-2xl font-semibold text-[#1f1f1f]">Add Transaction</h1>
        <p className="mt-5 text-sm leading-[17px] text-[#6b6b6b]">Enter the transaction details below. Fields marked * are required.</p>

        {formError && <p className="mt-5 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{formError}</p>}
        {categoryWarning && <p className="mt-5 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">{categoryWarning}</p>}

        <div className="mt-5 grid gap-x-6 gap-y-5 md:grid-cols-2">
          <Field label="Transaction Type *" error={fieldErrors.type}>
            <select value={values.type} onChange={(event) => updateValue('type', event.target.value)} className={inputClassName(fieldErrors.type)} disabled={isSubmitting}>
              <option value="Expense">Expense</option>
              <option value="Revenue">Revenue</option>
            </select>
          </Field>
          <Field label="Account *" error={fieldErrors.accountId}>
            <select value={values.accountId} onChange={(event) => updateValue('accountId', event.target.value)} className={inputClassName(fieldErrors.accountId)} disabled={isSubmitting || isLoadingOptions}>
              <option value="">{isLoadingOptions ? 'Loading accounts...' : 'Select account'}</option>
              {accounts.map((account) => <option key={account.account_id} value={account.account_id}>{account.bank_name} •••• {account.account_number_last_4}</option>)}
            </select>
          </Field>
          <Field label="Amount *" error={fieldErrors.amount}>
            <input value={values.amount} onChange={(event) => updateValue('amount', event.target.value)} className={inputClassName(fieldErrors.amount)} type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" disabled={isSubmitting} />
          </Field>
          <Field label="Transaction Date *" error={fieldErrors.transactionDate}>
            <input value={values.transactionDate} onChange={(event) => updateValue('transactionDate', event.target.value)} className={inputClassName(fieldErrors.transactionDate)} type="date" disabled={isSubmitting} />
          </Field>
          <Field label="Item Description *" error={fieldErrors.itemDescription}>
            <input value={values.itemDescription} onChange={(event) => updateValue('itemDescription', event.target.value)} className={inputClassName(fieldErrors.itemDescription)} placeholder="Enter transaction description" maxLength={500} disabled={isSubmitting} />
          </Field>
          <Field label="Shop Name *" error={fieldErrors.shopName}>
            <input value={values.shopName} onChange={(event) => updateValue('shopName', event.target.value)} className={inputClassName(fieldErrors.shopName)} placeholder="Enter shop or recipient name" maxLength={255} disabled={isSubmitting} />
          </Field>
          <Field label="Payment Method *" error={fieldErrors.paymentMethod}>
            <input value={values.paymentMethod} onChange={(event) => updateValue('paymentMethod', event.target.value)} className={inputClassName(fieldErrors.paymentMethod)} placeholder="Enter payment method" maxLength={100} disabled={isSubmitting} />
          </Field>
          <Field label="Category (Optional)" error={fieldErrors.categoryId}>
            <select value={values.categoryId} onChange={(event) => updateValue('categoryId', event.target.value)} className={inputClassName(fieldErrors.categoryId)} disabled={isSubmitting || isLoadingOptions || Boolean(categoryWarning)}>
              <option value="">Select category</option>
              {categories.map((category) => <option key={category.category_id} value={category.category_id}>{category.category_name}</option>)}
            </select>
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="h-12 rounded border border-[#2fa096] px-6 text-sm font-semibold text-[#2fa096] transition hover:bg-[#edf8f7] disabled:cursor-not-allowed" disabled={isSubmitting}>Cancel</button>
          <button type="submit" className="h-12 rounded bg-[#2fa096] px-6 text-sm font-semibold text-white transition hover:bg-[#278d84] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting || isLoadingOptions}>
            {isSubmitting ? 'Saving...' : 'Save Transaction'}
          </button>
        </div>
      </form>
    </section>
  )
}

interface FieldProps {
  label: string
  error?: string
  children: React.ReactNode
}

/** Renders a Figma-sized input field with its inline validation feedback. */
const Field: React.FC<FieldProps> = ({ label, error, children }) => (
  <label className="block text-sm font-medium text-[#303034]">
    {label}
    <span className="mt-2 block">{children}</span>
    {error && <span className="mt-1 block text-xs font-normal text-red-600">{error}</span>}
  </label>
)

export default AddTransactionForm
