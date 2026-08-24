import React, { useState } from 'react'
import { AxiosError } from 'axios'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../../api/auth.service'
import { User } from '../../api/types'
import Button from '../../components/Button/Button'
import Error from '../../components/Error/Error'
import { useAuth } from '../../context/AuthContext'
import eyeOutline from '../../assets/login/eye-outline.svg'
import eyePupil from '../../assets/login/eye-pupil.svg'
import googleBlue from '../../assets/login/google-blue.svg'
import googleRed from '../../assets/login/google-red.svg'
import googleYellow from '../../assets/login/google-yellow.svg'
import googleGreen from '../../assets/login/google-green.svg'

type FormValues = {
  email: string
  password: string
}

type FieldErrors = Partial<Record<keyof FormValues, string>>

const initialValues: FormValues = { email: '', password: '' }
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const Login: React.FC = () => {
  const navigate = useNavigate()
  const { updateUser } = useAuth()
  const [formData, setFormData] = useState<FormValues>(initialValues)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [apiError, setApiError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [keepSignedIn, setKeepSignedIn] = useState(true)

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}
    const email = formData.email.trim().toLowerCase()

    // BR-LOG-01 and BR-LOG-02: client validation prevents an invalid request.
    if (email.length === 0) {
      errors.email = 'Email address is required.'
    } else if (!emailPattern.test(email)) {
      errors.email = 'Enter a valid email address.'
    }
    if (formData.password.length === 0) {
      errors.password = 'Password is required.'
    }

    return errors
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof FormValues
    setFormData((current) => ({ ...current, [field]: event.target.value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
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
      const response = await authService.login({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      })

      if (!response.success || !response.data) {
        setApiError(response.message || 'Login failed. Please try again.')
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
      setFormData(initialValues)
      setFieldErrors({})
      setApiError('')
      navigate('/')
    } catch (error) {
      const response = (error as AxiosError<{ message?: string | string[]; error?: string }>)
        .response
      const message = Array.isArray(response?.data?.message)
        ? response.data.message[0]
        : response?.data?.message
      const field = response?.data?.error as keyof FormValues | undefined
      const displayMessage =
        response?.status === 401
          ? 'Email or password is incorrect.'
          : message || 'Login failed. Please try again.'

      setApiError(displayMessage)
      if (field === 'email' || field === 'password') {
        setFieldErrors({ [field]: displayMessage })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen justify-center bg-[#f4f5f7] px-5 pb-16 pt-16 sm:pt-[160px]">
      <section className="w-full max-w-[400px]">
        <div className="text-center font-['Poppins',sans-serif] text-[40px] leading-8 tracking-[3.2px] text-[#299d91]">
          <span className="font-extrabold">FINE</span>
          <span className="font-medium">bank.</span>
          <span className="font-extrabold">IO</span>
        </div>

        <div className="mt-16 space-y-6">
          {apiError && <Error message={apiError} />}

          <form onSubmit={handleSubmit} noValidate className="space-y-8">
            <div className="space-y-6">
              <FormField label="Email Address" error={fieldErrors.email}>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  aria-invalid={Boolean(fieldErrors.email)}
                  className={inputClassName(fieldErrors.email)}
                />
              </FormField>

              <FormField
                label="Password"
                error={fieldErrors.password}
                action={<Link to="/forgot-password" className="text-[12px] font-medium leading-4 text-[#299d91] hover:underline">Forgot Password?</Link>}
              >
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={isPasswordVisible ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    aria-invalid={Boolean(fieldErrors.password)}
                    className={`${inputClassName(fieldErrors.password)} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-[#4b5768] focus:outline-none focus:ring-2 focus:ring-[#299d91]"
                    aria-label={`${isPasswordVisible ? 'Hide' : 'Show'} password`}
                  >
                    <span className="relative block h-6 w-6" aria-hidden="true">
                      <img src={eyeOutline} alt="" className="absolute inset-0 h-full w-full" />
                      <img src={eyePupil} alt="" className="absolute inset-0 h-full w-full" />
                    </span>
                  </button>
                </div>
              </FormField>
            </div>

            <div className="space-y-4">
              <label className="flex cursor-pointer items-center gap-4 text-[16px] font-light leading-6 text-[#191d23]">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={(event) => setKeepSignedIn(event.target.checked)}
                  className="h-5 w-5 rounded-[2px] border-[#d0d5dd] accent-[#299d91]"
                />
                Keep me signed in
              </label>
              <Button
                type="submit"
                isLoading={isLoading}
                loadingText="Logging in..."
                className="h-12 w-full rounded-[4px] bg-[#299d91] px-3 py-4 text-[16px] font-semibold leading-6 hover:bg-[#258e85] focus:ring-[#299d91]"
              >
                Login
              </Button>
            </div>
          </form>

          <div className="relative flex items-center justify-center py-2">
            <span className="absolute inset-x-[29px] top-1/2 h-px bg-[#d0d5dd]" />
            <span className="relative bg-[#f4f5f7] px-2 text-[14px] leading-5 text-[#999da3]">
              or sign in with
            </span>
          </div>

          <button
            type="button"
            aria-disabled="true"
            className="flex h-12 w-full cursor-default items-center justify-center gap-4 rounded-[4px] bg-[#e4e7eb] px-[69px] py-3 text-[16px] leading-6 text-[#4b5768]"
          >
            <span className="relative h-6 w-6" aria-hidden="true">
              <img src={googleBlue} alt="" className="absolute inset-0 h-full w-full" />
              <img src={googleRed} alt="" className="absolute inset-0 h-full w-full" />
              <img src={googleYellow} alt="" className="absolute inset-0 h-full w-full" />
              <img src={googleGreen} alt="" className="absolute inset-0 h-full w-full" />
            </span>
            Continue with Google
          </button>
        </div>

        <Link to="/register" className="mt-10 block text-center text-[16px] font-semibold leading-6 text-[#299d91] hover:underline">
          Create an account
        </Link>
      </section>
    </main>
  )
}

const FormField: React.FC<{
  label: string
  error?: string
  action?: React.ReactNode
  children: React.ReactNode
}> = ({ label, error, action, children }) => (
  <div>
    <div className="mb-2 flex items-center justify-between">
      <label htmlFor={label === 'Email Address' ? 'email' : 'password'} className="text-[16px] font-medium leading-6 text-[#191d23]">
        {label}
      </label>
      {action}
    </div>
    {children}
    {error && <p className="mt-1.5 text-sm text-[#e73d1c]">{error}</p>}
  </div>
)

const inputClassName = (error?: string) =>
  `h-12 w-full rounded-[8px] border bg-transparent px-4 text-[16px] leading-6 text-[#4b5768] outline-none focus:ring-1 ${
    error
      ? 'border-[#e73d1c] focus:border-[#e73d1c] focus:ring-[#e73d1c]'
      : 'border-[#d0d5dd] focus:border-[#4b5768] focus:ring-[#4b5768]'
  }`

export default Login
