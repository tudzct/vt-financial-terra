import React, { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import billsIcon from '../../assets/balances/bills.svg'
import chevronsRightIcon from '../../assets/balances/chevrons-right.svg'
import expensesIcon from '../../assets/balances/expenses.svg'
import goalsIcon from '../../assets/balances/goals.svg'
import logoutIcon from '../../assets/balances/logout.svg'
import notificationIcon from '../../assets/balances/notification.svg'
import overviewIcon from '../../assets/balances/overview.svg'
import profileMenuIcon from '../../assets/balances/profile-menu.svg'
import profileImage from '../../assets/balances/profile.png'
import searchIcon from '../../assets/balances/search.svg'
import settingsIcon from '../../assets/balances/settings.svg'
import transactionsIcon from '../../assets/balances/transactions.svg'
import walletIcon from '../../assets/balances/wallet.svg'

interface BalancesLayoutProps {
  children: ReactNode
}

/** Renders the frame-105 dashboard shell around the balances content. */
const BalancesLayout: React.FC<BalancesLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const navigationItems = [
    { path: '/dashboard', label: 'Overview', icon: overviewIcon },
    { path: '/accounts', label: 'Balances', icon: walletIcon },
    { path: '/transactions', label: 'Transactions', icon: transactionsIcon },
    { path: '/bills', label: 'Bills', icon: billsIcon },
    { path: '/expenses', label: 'Expenses', icon: expensesIcon },
    { path: '/goals', label: 'Goals', icon: goalsIcon },
    { path: '/settings', label: 'Settings', icon: settingsIcon },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#f4f5f7] font-sans text-[#191919]">
      <div className="flex min-h-screen">
        <aside className="flex w-[280px] shrink-0 flex-col gap-[228px] bg-[#191919] px-7 py-12">
          <div>
            <Link to="/dashboard" className="block w-[224px] text-center font-['Poppins'] text-2xl leading-8 tracking-[1.92px] text-white"><span className="font-extrabold">FINE</span><span className="font-medium">bank.</span><span className="font-extrabold">IO</span></Link>
            <nav className="mt-10 flex flex-col gap-4" aria-label="Primary navigation">
              {navigationItems.map((item) => {
                const isActive = item.path === '/accounts'
                return <Link key={item.path} to={item.path} className={`flex items-center gap-3 rounded px-4 py-3 text-base leading-6 transition-colors ${isActive ? 'bg-[#299d91] font-semibold text-white' : 'font-normal text-white/70 hover:bg-white/10 hover:text-white'}`}><span className="flex size-6 shrink-0 items-center justify-center overflow-hidden"><img alt="" className="size-full" src={item.icon} /></span><span className="w-[156px]">{item.label}</span></Link>
              })}
            </nav>
          </div>
          <div className="flex flex-col gap-11">
            <button type="button" onClick={handleLogout} className="flex items-center gap-3 rounded bg-white/[0.08] px-4 py-3 text-left text-base font-semibold leading-6 text-white"><span className="flex size-6 items-center justify-center"><img alt="" className="size-5" src={logoutIcon} /></span><span className="w-[156px]">Logout</span></button>
            <div className="border-t border-white/[0.08] py-8"><button type="button" className="flex w-full items-center gap-8 text-left"><span className="flex items-center gap-4"><img alt="" className="size-8 shrink-0" src={profileImage} /><span><span className="block w-[140px] truncate text-base font-semibold leading-6 text-white">{user?.full_name || user?.username || 'Tanzir Rahman'}</span><span className="block text-xs leading-4 text-white/70">View profile</span></span></span><img alt="" className="h-5 w-1" src={profileMenuIcon} /></button></div>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="flex h-[88px] items-center justify-between border-b border-[#e8e8e8] px-8 pl-6"><div className="flex items-center gap-1"><img alt="" className="size-6" src={chevronsRightIcon} /><span className="text-sm leading-5 text-[#9f9f9f]">May 19, 2023</span></div><div className="flex items-center gap-10"><img alt="" className="size-6" src={notificationIcon} /><label className="flex h-12 w-[352px] items-center gap-[170px] rounded-xl bg-white py-3 pl-8 pr-6 shadow-[0_26px_13px_rgba(106,22,58,0.04)]"><span className="sr-only">Search</span><input className="w-[102px] bg-transparent text-base leading-6 text-[#9f9f9f] outline-none placeholder:text-[#9f9f9f]" placeholder="Search here" /><img alt="" className="size-6 shrink-0" src={searchIcon} /></label></div></header>
          <main className="px-6 pt-4">{children}</main>
        </div>
      </div>
    </div>
  )
}

export default BalancesLayout
