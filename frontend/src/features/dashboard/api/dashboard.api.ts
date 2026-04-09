import apiClient from "@/lib/api-client"

export interface SalesTrendPoint {
  date: string
  revenue: number
}

export interface RecentInvoice {
  id: string
  invoice_number: string
  customer_name: string
  total: number
  payment_method: string
  created_at: string
}

export interface LowStockProduct {
  id: string
  name: string
  sku: string
  current_stock: number
  low_stock_threshold: number
}

export interface DashboardSummary {
  date_from: string
  date_to: string
  period_revenue: number
  period_invoice_count: number
  period_expenses: number
  net_profit: number
  low_stock_count: number
  sales_trend: SalesTrendPoint[]
  recent_invoices: RecentInvoice[]
  low_stock_products: LowStockProduct[]
}

export const getDashboardSummary = (params: { date_from?: string; date_to?: string }) =>
  apiClient.get<DashboardSummary>("/dashboard/summary", { params })
