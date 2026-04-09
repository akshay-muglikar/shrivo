import apiClient from "@/lib/api-client"
import type { InvoiceListItem } from "@/features/invoices/api/invoices.api"
import type { PaginatedResponse } from "@/types/pagination"

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  created_at: string
}

export interface CustomerCreate {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
}

export interface CustomerUpdate {
  name?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
}

export const getCustomers = (params?: Record<string, unknown>) =>
  apiClient.get<PaginatedResponse<Customer>>("/customers", { params })

export const createCustomer = (data: CustomerCreate) =>
  apiClient.post<Customer>("/customers", data)

export const updateCustomer = (id: string, data: CustomerUpdate) =>
  apiClient.put<Customer>(`/customers/${id}`, data)

export const getCustomerInvoices = (id: string) =>
  apiClient.get<InvoiceListItem[]>(`/customers/${id}/invoices`)