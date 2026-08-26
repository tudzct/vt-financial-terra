import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import { useAuth } from '../context/AuthContext'
import Loading from '../components/Loading/Loading'

// Lazy load pages
const Home = React.lazy(() => import('../pages/Home/Home'))
const Login = React.lazy(() => import('../pages/Login/Login'))
const Register = React.lazy(() => import('../pages/Register/Register'))
const Dashboard = React.lazy(() => import('../pages/Dashboard/Dashboard'))
const Bills = React.lazy(() => import('../pages/Bills/Bills'))
const Transactions = React.lazy(() => import('../pages/Transactions/Transactions'))
const Account = React.lazy(() => import('../pages/Account/Account'))
const AddAccountPage = React.lazy(() => import('../pages/AddAccount/AddAccountPage'))
const Goals = React.lazy(() => import('../pages/Goals/Goals'))
const Expenses = React.lazy(() => import('../pages/Expenses/Expenses'))

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <Loading fullScreen message="Đang tải..." />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Layout>
        <React.Suspense fallback={<Loading fullScreen message="Đang tải trang..." />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bills"
              element={
                <ProtectedRoute>
                  <Bills />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transactions"
              element={
                <ProtectedRoute>
                  <Transactions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accounts"
              element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              }
            />
            <Route path="/accounts/add" element={<ProtectedRoute><AddAccountPage /></ProtectedRoute>} />
            <Route path="/account" element={<Navigate to="/accounts" replace />} />
            <Route
              path="/goals"
              element={
                <ProtectedRoute>
                  <Goals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute>
                  <Expenses />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </Layout>
    </BrowserRouter>
  )
}

export default AppRouter

