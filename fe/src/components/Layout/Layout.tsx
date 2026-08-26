import React, { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import NavigationBar from '../NavigationBar/NavigationBar'
import BalancesLayout from '../BalancesLayout/BalancesLayout'

interface LayoutProps {
  children: ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, isAuthenticated, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (location.pathname === '/login' || location.pathname === '/register') {
    return <>{children}</>
  }

  if (location.pathname === '/accounts') {
    return <BalancesLayout>{children}</BalancesLayout>
  }

  if (location.pathname === '/transactions') {
    const sidebarItems = [
      { path: '/dashboard', label: 'Overview', icon: '⊞' },
      { path: '/account', label: 'Balances', icon: '▣' },
      { path: '/transactions', label: 'Transactions', icon: '↔' },
      { path: '/bills', label: 'Bills', icon: '▧' },
      { path: '/expenses', label: 'Expenses', icon: '▧' },
      { path: '/goals', label: 'Goals', icon: '⊕' },
      { path: '/settings', label: 'Settings', icon: '⚙' },
    ]

    return (
      <div className="min-h-screen bg-[#f4f5f7] font-sans text-[#262626]">
        <div className="flex min-h-screen">
          <aside className="flex w-70 shrink-0 flex-col bg-[#191919] px-7 py-10 text-white">
            <Link to="/dashboard" className="text-2xl font-extrabold tracking-wide">
              FINE<span className="font-medium">bank</span><span className="text-[#d8d8d8]">.IO</span>
            </Link>
            <nav className="mt-12 space-y-2" aria-label="Primary navigation">
              {sidebarItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex h-12 items-center gap-4 rounded px-5 text-sm font-medium transition-colors ${
                    item.path === '/transactions'
                      ? 'bg-[#2aa49a] text-white'
                      : 'text-[#b6b6b6] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="w-5 text-center text-xl leading-none" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto">
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-12 w-full items-center gap-4 rounded bg-[#252525] px-5 text-sm font-medium text-[#d3d3d3] transition-colors hover:bg-[#303030] hover:text-white"
              >
                <span className="text-xl leading-none" aria-hidden="true">↪</span>
                Logout
              </button>
              <div className="mt-11 border-t border-white/10 pt-8">
                <button type="button" className="flex w-full items-center gap-3 text-left">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3b3b3b] text-xs font-bold text-white">
                    {(user?.full_name || user?.username || 'U').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{user?.full_name || user?.username || 'Tanzir Rahman'}</span>
                    <span className="block text-xs text-[#a9a9a9]">View profile</span>
                  </span>
                  <span className="text-2xl leading-none text-[#d3d3d3]" aria-hidden="true">⋮</span>
                </button>
              </div>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="flex h-24 items-center justify-between border-b border-[#e7e8eb] bg-[#f8f9fa] px-6">
              <p className="text-sm text-[#a1a1a1]"><span className="mr-4 text-xl text-[#b9b9b9]" aria-hidden="true">»</span>May 19, 2023</p>
              <div className="flex items-center gap-8">
                <span className="relative text-xl text-[#6e6e6e]" aria-label="Notifications">♟<span className="absolute -right-0.5 top-0 h-1.5 w-1.5 rounded-full bg-[#2aa49a]" /></span>
                <label className="flex h-12 w-80 items-center rounded-xl bg-white px-5 shadow-[0_12px_28px_rgba(27,31,35,0.04)]">
                  <span className="sr-only">Search</span>
                  <input className="min-w-0 flex-1 bg-transparent text-sm text-[#515151] outline-none placeholder:text-[#b5b5b5]" placeholder="Search here" />
                  <span className="text-2xl leading-none text-[#333333]" aria-hidden="true">⌕</span>
                </label>
              </div>
            </header>
            <main className="px-6 py-5">{children}</main>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-blue-600 dark:text-blue-400">
                Financial App
              </Link>
            </div>

            <nav className="flex items-center space-x-4">
              {isAuthenticated && (
                <Link
                  to="/dashboard"
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  Dashboard
                </Link>
              )}
              <NavigationBar />
              {isAuthenticated ? (
                <>
                  <span className="text-gray-700 dark:text-gray-300">
                    {user?.full_name || user?.username}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700"
                  >
                    Đăng xuất
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Đăng ký
                  </Link>
                </>
              )}

              <button
                onClick={toggleTheme}
                className="p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm">
            © 2024 Financial Management App. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default Layout
