import React, { useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

export default function PasswordInput({ className = '', ...inputProps }) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative">
      <input
        {...inputProps}
        type={isVisible ? 'text' : 'password'}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setIsVisible((visible) => !visible)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500 rounded-r-xl"
        aria-label={isVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        title={isVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
      >
        {isVisible ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
      </button>
    </div>
  )
}