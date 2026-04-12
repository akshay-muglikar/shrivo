import apiClient from "@/lib/api-client"
import type { PaginatedResponse } from "@/types/pagination"

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  gstin: string | null
  state: string | null
  created_at: string
}

export interface InvoiceItem {
  id: string
  product_id: string | null
  product_name: string
  hsn_code: string | null
  gst_rate: string
  price_includes_gst: boolean
  quantity: number
  unit_price: string
  line_total: string
}

export interface Invoice {
  id: string
  invoice_number: string
  customer: Customer | null
  walk_in_customer_name: string | null
  walk_in_customer_phone: string | null
  status: string
  payment_method: string
  subtotal: string
  discount_type: string | null
  discount_value: string
  discount_amount: string
  tax_rate: string
  tax_amount: string
  total: string
  notes: string | null
  created_at: string
  items: InvoiceItem[]
}

export interface InvoiceListItem {
  id: string
  invoice_number: string
  customer: Customer | null
  walk_in_customer_name: string | null
  walk_in_customer_phone: string | null
  status: string
  payment_method: string
  total: string
  created_at: string
}

export interface InvoiceItemCreate {
  product_id: string
  quantity: number
  unit_price: number
}

export interface InvoiceCreate {
  customer_id?: string | null
  walk_in_customer_name?: string | null
  walk_in_customer_phone?: string | null
  discount_type?: "percent" | "flat" | null
  discount_value?: number
  tax_rate?: number
  payment_method?: string
  notes?: string | null
  items: InvoiceItemCreate[]
}

export interface InvoiceUpdate {
  payment_method?: string
  notes?: string | null
  status?: string
}

export const updateInvoice = (id: string, data: InvoiceUpdate) =>
  apiClient.patch<Invoice>(`/invoices/${id}`, data)

export const getInvoices = (params?: Record<string, unknown>) =>
  apiClient.get<PaginatedResponse<InvoiceListItem>>("/invoices", { params })

export const getInvoice = (id: string) =>
  apiClient.get<Invoice>(`/invoices/${id}`)

export const createInvoice = (data: InvoiceCreate) =>
  apiClient.post<Invoice>("/invoices", data)

export const getCustomers = (params?: Record<string, unknown>) =>
  apiClient.get<PaginatedResponse<Customer>>("/customers", { params })

export const createCustomer = (data: { name: string; phone?: string; email?: string }) =>
  apiClient.post<Customer>("/customers", data)
