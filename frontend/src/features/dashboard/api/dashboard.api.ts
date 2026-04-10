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

export interface RecentPO {
  id: string
  po_number: string
  supplier_name: string
  status: "draft" | "ordered" | "received" | "cancelled"
  total_amount: number
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
  period_purchases: number
  net_profit: number
  total_supplier_payable: number
  pending_po_count: number
  stock_value: number
  low_stock_count: number
  sales_trend: SalesTrendPoint[]
  recent_invoices: RecentInvoice[]
  recent_pos: RecentPO[]
  low_stock_products: LowStockProduct[]
}

export const getDashboardSummary = (params: { date_from?: string; date_to?: string }) =>
  apiClient.get<DashboardSummary>("/dashboard/summary", { params })
