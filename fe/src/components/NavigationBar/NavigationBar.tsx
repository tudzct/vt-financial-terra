import React from 'react'
import { NavLink } from 'react-router-dom'

const NavigationBar: React.FC = () => {
  const navItems = [
    { path: '/bills', label: 'Hóa đơn', icon: '📄' },
    { path: '/transactions', label: 'Giao dịch', icon: '💳' },
    { path: '/accounts', label: 'Tài khoản', icon: '🏦' },
    { path: '/goals', label: 'Mục tiêu', icon: '🎯' },
    { path: '/expenses', label: 'Chi tiêu', icon: '💰' },
  ]

  return (
    <div className="flex items-center space-x-1 overflow-x-auto">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-blue-600 text-white dark:bg-blue-500'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`
          }
        >
          <span className="mr-1">{item.icon}</span>
          {item.label}
        </NavLink>
      ))}
    </div>
  )
}

export default NavigationBar

