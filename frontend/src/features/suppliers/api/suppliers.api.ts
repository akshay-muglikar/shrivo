import apiClient from "@/lib/api-client"
import type { PaginatedResponse } from "@/types/pagination"

export interface Supplier {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  balance: string
  is_active: boolean
}

export const getSuppliers = (params?: Record<string, unknown>) =>
  apiClient.get<PaginatedResponse<Supplier>>("/suppliers", { params })

export const getSupplier = (id: string) =>
  apiClient.get<Supplier>(`/suppliers/${id}`)

export const createSupplier = (data: {
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
}) => apiClient.post<Supplier>("/suppliers", data)

export const updateSupplier = (id: string, data: {
  name?: string
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  is_active?: boolean
}) => apiClient.put<Supplier>(`/suppliers/${id}`, data)

export const deleteSupplier = (id: string) =>
  apiClient.delete(`/suppliers/${id}`)
