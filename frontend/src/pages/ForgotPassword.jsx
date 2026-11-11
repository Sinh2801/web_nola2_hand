import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  clearError,
  forgotPassword,
  resendVerificationCodeResetPassword,
  verifyOTPAndResetPassword
} from '../store/slices/authSlice'
import PasswordInput from '../components/PasswordInput'

export default function ForgotPassword() {
  const [step, setStep] = useState(1)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [formError, setFormError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    newPassword: '',
    confirmPassword: '',
    code: ''
  })
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading, error } = useSelector(state => state.auth)

  useEffect(() => {
    dispatch(clearError())
  }, [dispatch])

  useEffect(() => {
    if (resendCooldown === 0) return undefined
    const timer = setTimeout(() => setResendCooldown(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendCooldown])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData(current => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')

    if (step === 1) {
      const result = await dispatch(forgotPassword({ email: formData.email }))
      if (forgotPassword.fulfilled.match(result)) {
        setStep(2)
        setResendCooldown(60)
      }
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setFormError('Mật khẩu xác nhận không khớp')
      return
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(formData.newPassword)) {
      setFormError('Mật khẩu phải có ít nhất 6 ký tự, gồm chữ hoa, chữ thường và số')
      return
    }

    const result = await dispatch(verifyOTPAndResetPassword({
      email: formData.email,
      code: formData.code,
      newPassword: formData.newPassword
    }))

    if (verifyOTPAndResetPassword.fulfilled.match(result)) {
      alert('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với mật khẩu mới.')
      navigate('/login')
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    const result = await dispatch(resendVerificationCodeResetPassword({ email: formData.email }))
    if (resendVerificationCodeResetPassword.fulfilled.match(result)) {
      setResendCooldown(60)
    }
  }

  const passwordMismatch = step === 2 &&
    formData.confirmPassword.length > 0 &&
    formData.newPassword !== formData.confirmPassword

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
            {step === 1 ? 'Quên mật khẩu' : 'Đặt lại mật khẩu'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            {step === 1
              ? 'Nhập email để nhận mã OTP đặt lại mật khẩu.'
              : 'Nhập mã OTP được gửi đến email và tạo mật khẩu mới.'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {(error || formError) && (
            <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-400 px-4 py-3 rounded">
              {formError || error}
            </div>
          )}

          {step === 1 ? (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                placeholder="user@nola2hand.edu.vn"
                className="mt-1 block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mật khẩu mới
                </label>
                <PasswordInput
                  id="newPassword"
                  name="newPassword"
                  required
                  minLength={6}
                  leftIcon={<span className="text-gray-400">🔒</span>}
                  className="mt-1 block w-full pl-12 pr-10 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  value={formData.newPassword}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Xác nhận mật khẩu mới
                </label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  required
                  minLength={6}
                  leftIcon={<span className="text-gray-400">🔒</span>}
                  className="mt-1 block w-full pl-12 pr-10 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                {passwordMismatch && (
                  <p className="mt-1 text-sm text-red-600">Mật khẩu xác nhận không khớp</p>
                )}
              </div>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mã OTP
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  pattern="\d{6}"
                  required
                  placeholder="Nhập mã OTP"
                  className="mt-1 block w-full px-3 py-3 text-center text-lg tracking-widest border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  value={formData.code}
                  onChange={(event) => {
                    if (/^\d*$/.test(event.target.value)) handleChange(event)
                  }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || passwordMismatch}
            className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {loading ? (step === 1 ? 'Đang gửi mã...' : 'Đang đổi mật khẩu...') : (step === 1 ? 'Tiếp tục' : 'Đổi mật khẩu')}
          </button>

          {step === 2 && (
            <button
              type="button"
              onClick={handleResend}
              disabled={loading || resendCooldown > 0}
              className="w-full text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-500 disabled:opacity-50"
            >
              {resendCooldown > 0 ? `Gửi lại mã (${resendCooldown}s)` : 'Gửi lại mã'}
            </button>
          )}

          <div className="text-center">
            <Link to="/login" className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-500">
              Quay lại đăng nhập
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
