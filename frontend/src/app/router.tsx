import { useEffect } from "react"
import { createBrowserRouter, Navigate } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { LoginForm } from "@/features/auth/components/LoginForm"
import { CustomersPage } from "@/features/customers/pages/CustomersPage"
import { ExpensesPage } from "@/features/expenses/pages/ExpensesPage"
import { ProductsPage } from "@/features/products/pages/ProductsPage"
import { ExpiryReportPage } from "@/features/products/pages/ExpiryReportPage"
import { InvoicesPage } from "@/features/invoices/pages/InvoicesPage"
import { SuppliersPage } from "@/features/suppliers/pages/SuppliersPage"
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage"
import { SettingsPage } from "@/features/settings/pages/SettingsPage"
import { HelpPage } from "@/features/help/pages/HelpPage"
import { LandingPage } from "@/features/landing/pages/LandingPage"
import { ContactPage } from "@/features/contact/pages/ContactPage"
import { getMeApi } from "@/features/auth/api/auth.api"
import { useAuthStore } from "@/features/auth/store/auth.store"

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token")
  const { user, setAuth } = useAuthStore()

  useEffect(() => {
    if (token && !user) {
      getMeApi()
        .then(({ data }) => setAuth(token, data))
        .catch(() => {
          localStorage.removeItem("token")
          window.location.href = "/login"
        })
    }
  }, [token, user, setAuth])

  if (token && !user) {
    return null
  }

  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()

  if (!user?.is_owner) {
    return <Navigate to="/app/invoices" replace />
  }

  return <>{children}</>
}

function HomeRoute() {
  const { user } = useAuthStore()

  return user?.is_owner ? <DashboardPage /> : <Navigate to="/app/invoices" replace />
}

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/contact", element: <ContactPage /> },
  { path: "/login", element: <LoginForm /> },
  {
    path: "/app",
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { path: "", element: <HomeRoute /> },
      { path: "products", element: <ProductsPage /> },
      { path: "expiry", element: <ExpiryReportPage /> },
      { path: "invoices", element: <InvoicesPage /> },
      {
        path: "customers",
        element: <OwnerOnly><CustomersPage /></OwnerOnly>,
      },
      { path: "expenses", element: <ExpensesPage /> },
      {
        path: "suppliers",
        element: <OwnerOnly><SuppliersPage /></OwnerOnly>,
      },
      { path: "settings", element: <SettingsPage /> },
      { path: "help", element: <HelpPage /> },
    ],
  },
])
