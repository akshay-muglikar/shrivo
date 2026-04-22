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
  hsn_code: string | null
  gst_rate: string
  price_includes_gst: boolean
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

export interface StockInPayload {
  quantity: number
  notes?: string
  batch_number?: string
  expiry_date?: string  // ISO date string YYYY-MM-DD
  cost_price?: number
}

export interface ProductBatch {
  id: string
  batch_number: string | null
  expiry_date: string | null  // ISO date string
  quantity_remaining: number
  cost_price: string | null
  notes: string | null
  created_at: string
}

export const stockIn = (id: string, payload: StockInPayload) =>
  apiClient.post<Product>(`/products/${id}/stock-in`, payload)

export const adjustStock = (id: string, delta: number, reason: string) =>
  apiClient.post<Product>(`/products/${id}/adjust`, { delta, reason })

export const getMovements = (id: string) =>
  apiClient.get(`/products/${id}/movements`)

export const getBatches = (id: string) =>
  apiClient.get<ProductBatch[]>(`/products/${id}/batches`)

export interface BatchWithProduct extends ProductBatch {
  product_id: string
  product_name: string
  product_sku: string
}

export const getAllBatches = (params?: Record<string, unknown>) =>
  apiClient.get<{ total: number; page: number; limit: number; items: BatchWithProduct[] }>(
    "/products/batches/all",
    { params }
  )
