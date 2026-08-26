import { AxiosError } from 'axios'
import React, { FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { accountService } from '../../api/account.service'
import { Account, CreateAccountPayload } from '../../api/types'

interface FormValues { bankName: string; accountType: Account['account_type']; branchName: string; accountNumberFull: string; balance: string }
type FieldErrors = Partial<Record<keyof FormValues, string>>
const DEFAULT_API_ERROR = 'Unable to add the account at this time. Please try again later.'

/** Renders the UC-06 form and submits one protected account-creation request. */
const AddAccountForm: React.FC = () => {
  const navigate = useNavigate()
  const navigationTimerRef = useRef<number>()
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [values, setValues] = useState<FormValues>({ bankName: '', accountType: 'Checking', branchName: '', accountNumberFull: '', balance: '' })

  useEffect(() => () => { if (navigationTimerRef.current) window.clearTimeout(navigationTimerRef.current) }, [])
  /** Updates an input and clears only the error caused by that input. */
  const updateValue = (field: keyof FormValues, value: string) => { setValues((currentValues) => ({ ...currentValues, [field]: value })); setFieldErrors((currentErrors) => ({ ...currentErrors, [field]: undefined })); setFormError('') }
  /** Applies all client-side portions of BR-ACC-07 through BR-ACC-14. */
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}
    const bankName = values.bankName.normalize('NFC').trim()
    const branchName = values.branchName.normalize('NFC').trim()
    const amount = Number(values.balance)
    if (!bankName) errors.bankName = 'Enter a bank name.'
    else if (bankName.length > 255) errors.bankName = 'Bank name must not exceed 255 characters.'
    if (!['Checking', 'Credit Card', 'Savings', 'Investment', 'Loan'].includes(values.accountType)) errors.accountType = 'Select a valid account type.'
    if (branchName.length > 255) errors.branchName = 'Branch name must not exceed 255 characters.'
    if (!/^\d{8,34}$/.test(values.accountNumberFull.trim())) errors.accountNumberFull = 'Enter an account number with 8 to 34 digits.'
    if (!/^\d+(?:\.\d{1,2})?$/.test(values.balance) || !Number.isFinite(amount) || amount < 0) errors.balance = 'Enter a non-negative balance with up to two decimals.'
    return errors
  }
  /** Sends a normalized API-ACCOUNT-CREATE request once per form submission. */
  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    const errors = validate()
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return }
    const branchName = values.branchName.normalize('NFC').trim()
    const payload: CreateAccountPayload = { bank_name: values.bankName.normalize('NFC').trim(), account_type: values.accountType, account_number_full: values.accountNumberFull.trim(), balance: Number(values.balance), ...(branchName ? { branch_name: branchName } : {}) }
    setIsSubmitting(true); setFormError('')
    try {
      await accountService.createAccount(payload)
      setSuccessMessage('Account created successfully'); setFieldErrors({}); setValues({ bankName: '', accountType: 'Checking', branchName: '', accountNumberFull: '', balance: '' })
      navigationTimerRef.current = window.setTimeout(() => navigate('/accounts'), 1500)
    } catch (requestError) {
      const apiError = requestError as AxiosError<{ message?: string | string[] }>
      const message = apiError.response?.data?.message
      const normalizedMessage = Array.isArray(message) ? message[0] : message || DEFAULT_API_ERROR
      setFormError(normalizedMessage); setFieldErrors(mapApiErrorToField(normalizedMessage))
    } finally { setIsSubmitting(false) }
  }
  const inputClassName = (hasError?: string) => `h-12 w-full rounded border bg-white px-4 text-sm text-[#383838] outline-none transition focus:border-[#299d91] focus:ring-2 focus:ring-[#299d91]/20 ${hasError ? 'border-red-500' : 'border-[#d6d9db]'}`
  return <section className="mx-auto max-w-[1104px] pt-[92px]">
    {successMessage && <div className="fixed right-6 top-6 z-50 rounded-lg bg-[#299d91] px-4 py-3 text-sm font-semibold text-white shadow-lg" role="status">{successMessage}</div>}
    <form onSubmit={handleCreateAccount} className="rounded-lg bg-white px-8 py-7 shadow-[0_20px_25px_rgba(76,103,100,0.10)]">
      <h1 className="text-2xl font-semibold text-[#191919]">Add Account</h1><p className="mt-5 text-sm leading-[17px] text-[#6b6b6b]">Enter the account details below. Fields marked * are required.</p>
      {formError && <p className="mt-5 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{formError}</p>}
      <div className="mt-5 grid gap-x-6 gap-y-5 md:grid-cols-2">
        <Field label="Bank Name *" error={fieldErrors.bankName}><input value={values.bankName} onChange={(event) => updateValue('bankName', event.target.value)} className={inputClassName(fieldErrors.bankName)} placeholder="Enter bank name" maxLength={255} disabled={isSubmitting} /></Field>
        <Field label="Account Type *" error={fieldErrors.accountType}><select value={values.accountType} onChange={(event) => updateValue('accountType', event.target.value)} className={inputClassName(fieldErrors.accountType)} disabled={isSubmitting}><option value="Checking">Checking</option><option value="Credit Card">Credit Card</option><option value="Savings">Savings</option><option value="Investment">Investment</option><option value="Loan">Loan</option></select></Field>
        <Field label="Branch Name (Optional)" error={fieldErrors.branchName}><input value={values.branchName} onChange={(event) => updateValue('branchName', event.target.value)} className={inputClassName(fieldErrors.branchName)} placeholder="Enter branch name" maxLength={255} disabled={isSubmitting} /></Field>
        <Field label="Account Number *" error={fieldErrors.accountNumberFull}><input value={values.accountNumberFull} onChange={(event) => updateValue('accountNumberFull', event.target.value.replace(/\D/g, ''))} className={inputClassName(fieldErrors.accountNumberFull)} inputMode="numeric" placeholder="Enter account number" maxLength={34} disabled={isSubmitting} /></Field>
        <Field label="Balance *" error={fieldErrors.balance}><input value={values.balance} onChange={(event) => updateValue('balance', event.target.value)} className={inputClassName(fieldErrors.balance)} type="text" inputMode="decimal" placeholder="0.00" disabled={isSubmitting} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={() => navigate('/accounts')} className="h-12 rounded border border-[#299d91] px-6 text-sm font-semibold text-[#299d91] transition hover:bg-[#edf8f7] disabled:cursor-not-allowed" disabled={isSubmitting}>Cancel</button><button type="submit" className="h-12 rounded bg-[#299d91] px-6 text-sm font-semibold text-white transition hover:bg-[#278d84] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting}>{isSubmitting ? 'Adding account...' : 'Add Account'}</button></div>
    </form>
  </section>
}

/** Maps contract validation messages to their corresponding form field when possible. */
function mapApiErrorToField(message: string): FieldErrors { const normalizedMessage = message.toLowerCase(); if (normalizedMessage.includes('bank name')) return { bankName: message }; if (normalizedMessage.includes('account type')) return { accountType: message }; if (normalizedMessage.includes('branch name')) return { branchName: message }; if (normalizedMessage.includes('account number') || normalizedMessage.includes('account already exists')) return { accountNumberFull: message }; if (normalizedMessage.includes('balance')) return { balance: message }; return {} }
interface FieldProps { label: string; error?: string; children: React.ReactNode }
/** Displays one Figma-sized form field and any inline validation feedback. */
const Field: React.FC<FieldProps> = ({ label, error, children }) => <label className="block text-sm font-medium text-[#303034]">{label}<span className="mt-2 block">{children}</span>{error && <span className="mt-1 block text-xs font-normal text-red-600">{error}</span>}</label>
export default AddAccountForm
