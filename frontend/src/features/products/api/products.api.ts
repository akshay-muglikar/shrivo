import apiClient from "@/lib/api-client"
import type { PaginatedResponse } from "@/types/pagination"

export interface Category {
  id: string
  name: string
}

export interface Supplier {
  id: string
  name: string
}

export const getCategories = () =>
  apiClient.get<Category[]>("/categories")

export const getSuppliers = (params?: Record<string, unknown>) =>
  apiClient.get<PaginatedResponse<Supplier>>("/suppliers", { params })

export interface Product {
  id: string
  name: string
  sku: string
  description: string | null
  unit_of_measure: string
  cost_price: string
  selling_price: string
  current_stock: number
  low_stock_threshold: number
  is_active: boolean
  category: { id: string; name: string } | null
  supplier: { id: string; name: string } | null
}

export const getProducts = (params?: Record<string, unknown>) =>
  apiClient.get<PaginatedResponse<Product>>("/products", { params })

export const createProduct = (data: unknown) =>
  apiClient.post<Product>("/products", data)

export const updateProduct = (id: string, data: unknown) =>
  apiClient.put<Product>(`/products/${id}`, data)

export const deleteProduct = (id: string) =>
  apiClient.delete(`/products/${id}`)

export const stockIn = (id: string, quantity: number, notes?: string) =>
  apiClient.post<Product>(`/products/${id}/stock-in`, { quantity, notes })

export const adjustStock = (id: string, delta: number, reason: string) =>
  apiClient.post<Product>(`/products/${id}/adjust`, { delta, reason })

export const getMovements = (id: string) =>
  apiClient.get(`/products/${id}/movements`)
