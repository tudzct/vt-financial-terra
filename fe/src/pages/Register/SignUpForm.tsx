import React, { useState } from 'react'
import { AxiosError } from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../../api/auth.service'
import { User } from '../../api/types'
import { useAuth } from '../../context/AuthContext'

type FormValues = {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

type FieldName = keyof FormValues
type FieldErrors = Partial<Record<FieldName, string>>

const initialValues: FormValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

const passwordAllowedPattern = /^[A-Za-z0-9!@#$%^&*(){}_=+\[\],./<>?\\|:;\-]+$/
const passwordSpecialPattern = /[!@#$%^&*(){}\-_+=\[\],./<>?\\|:;]/
const namePattern = /^[\p{L}]+(?: [\p{L}]+)*$/u

const SignUpForm: React.FC = () => {
  const navigate = useNavigate()
  const { updateUser } = useAuth()
  const [values, setValues] = useState<FormValues>(initialValues)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [apiError, setApiError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}
    const normalizedName = values.fullName.normalize('NFC').trim()
    const normalizedEmail = values.email.trim().toLowerCase()
    const nameLength = Array.from(normalizedName).length

    if (nameLength < 4 || nameLength > 25) {
      errors.fullName = 'Name must be between 4 and 25 characters.'
    } else if (!namePattern.test(normalizedName)) {
      errors.fullName = 'Name may contain only letters separated by single spaces.'
    }

    if (
      normalizedEmail.length === 0 ||
      normalizedEmail.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      errors.email = 'Enter a valid email address.'
    }

    if (values.password.length < 8 || values.password.length > 64) {
      errors.password = 'Password must be between 8 and 64 characters.'
    } else if (/\s/.test(values.password)) {
      errors.password = 'Password must not contain whitespace.'
    } else if (!passwordAllowedPattern.test(values.password)) {
      errors.password = 'Password contains unsupported characters.'
    } else if (
      !/[a-z]/.test(values.password) ||
      !/[A-Z]/.test(values.password) ||
      !/[0-9]/.test(values.password) ||
      !passwordSpecialPattern.test(values.password)
    ) {
      errors.password = 'Use uppercase, lowercase, a number, and a special character.'
    }

    if (values.confirmPassword.length === 0) {
      errors.confirmPassword = 'Please confirm your password.'
    } else if (values.confirmPassword !== values.password) {
      errors.confirmPassword = 'Passwords do not match.'
    }

    return errors
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as FieldName
    setValues((currentValues) => ({ ...currentValues, [field]: event.target.value }))
    setFieldErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }))
    setApiError('')
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLoading) return

    const errors = validate()
    setFieldErrors(errors)
    setApiError('')
    if (Object.keys(errors).length > 0) return

    setIsLoading(true)
    try {
      const response = await authService.register({
        fullName: values.fullName.normalize('NFC').trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        confirmPassword: values.confirmPassword,
      })

      if (!response.success || !response.data) {
        setApiError(response.message || 'Registration failed. Please try again.')
        return
      }

      const mappedUser: User = {
        user_id: response.data.user.id,
        full_name: response.data.user.fullName,
        email: response.data.user.email,
        username: '',
        total_balance: 0,
      }
      localStorage.setItem('token', response.data.accessToken)
      localStorage.setItem('user', JSON.stringify(mappedUser))
      updateUser(mappedUser)
      navigate('/')
    } catch (error) {
      const response = (error as AxiosError<{ message?: string | string[]; error?: string }>)
        .response
      const message = Array.isArray(response?.data?.message)
        ? response.data.message[0]
        : response?.data?.message
      const field = response?.data?.error as FieldName | undefined

      setApiError(message || 'Registration failed. Please try again.')
      if (field && ['fullName', 'email', 'password', 'confirmPassword'].includes(field)) {
        setFieldErrors({ [field]: message || 'Please review this field.' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const renderPasswordToggle = (
    visible: boolean,
    setVisible: React.Dispatch<React.SetStateAction<boolean>>,
    label: string,
  ) => (
    <button
      type="button"
      onClick={() => setVisible((currentValue) => !currentValue)}
      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] transition hover:text-[#637083] focus:outline-none focus:ring-2 focus:ring-[#2ca398] focus:ring-offset-2"
      aria-label={`${visible ? 'Hide' : 'Show'} ${label}`}
    >
      <span className="block h-3.5 w-5 rounded-[100%] border-2 border-current relative">
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
      </span>
    </button>
  )

  return (
    <section className="flex min-h-screen items-start justify-center bg-[#f4f5f7] px-5 pb-16 pt-[108px] sm:pt-[108px]">
      <div className="w-full max-w-[400px]">
        <div className="text-center text-[39px] font-bold leading-none tracking-[-1.5px] text-[#2ca398]">
          FINE<span className="font-medium">bank.io</span>
        </div>
        <h1 className="mb-9 mt-8 text-center text-[25px] font-bold leading-tight tracking-[-0.6px] text-[#1c2028]">
          Create an account
        </h1>

        {apiError && (
          <p role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {apiError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <FormField label="Name" error={fieldErrors.fullName}>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              value={values.fullName}
              onChange={handleChange}
              placeholder="Tanzir Rahman"
              aria-invalid={Boolean(fieldErrors.fullName)}
              className={inputClassName(fieldErrors.fullName)}
            />
          </FormField>

          <FormField label="Email Address" error={fieldErrors.email}>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={handleChange}
              placeholder="hello@example.com"
              aria-invalid={Boolean(fieldErrors.email)}
              className={inputClassName(fieldErrors.email)}
            />
          </FormField>

          <FormField label="Password" error={fieldErrors.password}>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                value={values.password}
                onChange={handleChange}
                placeholder="••••••••••••"
                aria-invalid={Boolean(fieldErrors.password)}
                className={`${inputClassName(fieldErrors.password)} pr-12`}
              />
              {renderPasswordToggle(isPasswordVisible, setIsPasswordVisible, 'password')}
            </div>
          </FormField>

          <FormField label="Confirm Password" error={fieldErrors.confirmPassword}>
            <div className="relative">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={isConfirmPasswordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                value={values.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••••••"
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                className={`${inputClassName(fieldErrors.confirmPassword)} pr-12`}
              />
              {renderPasswordToggle(
                isConfirmPasswordVisible,
                setIsConfirmPasswordVisible,
                'password confirmation',
              )}
            </div>
          </FormField>

          <p className="pt-1 text-[14px] leading-5 text-[#637083]">
            By continuing, you agree to our{' '}
            <a href="#terms" className="font-medium text-[#20a398] hover:underline">
              terms of service.
            </a>
          </p>

          <button
            type="submit"
            disabled={isLoading}
            className="flex h-12 w-full items-center justify-center rounded bg-[#2ca398] text-[16px] font-semibold text-white transition hover:bg-[#258e85] focus:outline-none focus:ring-2 focus:ring-[#2ca398] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Signing up...
              </>
            ) : (
              'Sign up'
            )}
          </button>
        </form>

        <div className="my-9 flex items-center gap-4 text-[14px] text-[#9aa1ad]">
          <span className="h-px flex-1 bg-[#d9dde3]" />
          <span>or sign up with</span>
          <span className="h-px flex-1 bg-[#d9dde3]" />
        </div>

        <button
          type="button"
          className="flex h-12 w-full items-center justify-center gap-4 rounded bg-[#e4e7eb] text-[16px] font-medium text-[#526075] transition hover:bg-[#dce0e5]"
        >
          <span aria-hidden="true" className="font-bold text-[#4285f4]">G</span>
          Continue with Google
        </button>

        <p className="mt-10 text-center text-[16px] text-[#9aa1ad]">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#20a398] hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </section>
  )
}

const FormField: React.FC<{
  label: string
  error?: string
  children: React.ReactNode
}> = ({ label, error, children }) => (
  <div>
    <label htmlFor={label === 'Name' ? 'fullName' : label === 'Email Address' ? 'email' : label === 'Password' ? 'password' : 'confirmPassword'} className="mb-2 block text-[16px] font-medium text-[#1c2028]">
      {label}
    </label>
    {children}
    {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
  </div>
)

const inputClassName = (error?: string) =>
  `h-12 w-full rounded border bg-transparent px-4 text-[16px] text-[#526075] outline-none placeholder:text-[#9aa1ad] focus:border-[#526075] focus:ring-1 focus:ring-[#526075] ${
    error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-[#cfd5dd]'
  }`

export default SignUpForm
