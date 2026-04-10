import apiClient from "@/lib/api-client"
import type { PaginatedResponse } from "@/types/pagination"

export interface POItem {
  id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_cost: string
  line_total: string
}

export interface PurchaseOrder {
  id: string
  po_number: string
  supplier: { id: string; name: string }
  status: "draft" | "ordered" | "received" | "cancelled"
  notes: string | null
  total_amount: string
  created_at: string
  received_at: string | null
  items: POItem[]
}

export interface PurchaseOrderListItem {
  id: string
  po_number: string
  supplier: { id: string; name: string }
  status: "draft" | "ordered" | "received" | "cancelled"
  total_amount: string
  created_at: string
}

export interface POItemCreate {
  product_id?: string | null
  product_name: string
  quantity: number
  unit_cost: number
}

export interface PurchaseOrderCreate {
  supplier_id: string
  status?: string
  notes?: string | null
  items: POItemCreate[]
}

export interface SupplierPayment {
  id: string
  supplier_id: string
  amount: string
  notes: string | null
  created_at: string
}

export const getPurchaseOrders = (params?: Record<string, unknown>) =>
  apiClient.get<PaginatedResponse<PurchaseOrderListItem>>("/purchase-orders", { params })

export const getPurchaseOrder = (id: string) =>
  apiClient.get<PurchaseOrder>(`/purchase-orders/${id}`)

export const createPurchaseOrder = (data: PurchaseOrderCreate) =>
  apiClient.post<PurchaseOrder>("/purchase-orders", data)

export const updatePurchaseOrder = (id: string, data: { status?: string; notes?: string | null }) =>
  apiClient.patch<PurchaseOrder>(`/purchase-orders/${id}`, data)

export const receivePurchaseOrder = (id: string) =>
  apiClient.post<PurchaseOrder>(`/purchase-orders/${id}/receive`, {})

export const deletePurchaseOrder = (id: string) =>
  apiClient.delete(`/purchase-orders/${id}`)

export const recordPayment = (supplierId: string, data: { amount: number; notes?: string | null }) =>
  apiClient.post<SupplierPayment>(`/suppliers/${supplierId}/payments`, data)

export const getPayments = (supplierId: string) =>
  apiClient.get<SupplierPayment[]>(`/suppliers/${supplierId}/payments`)

export interface BulkPOResult {
  received?: string[]
  cancelled?: string[]
  skipped: string[]
  errors: { id: string; reason: string }[]
}

export const bulkReceivePOs = (po_ids: string[]) =>
  apiClient.post<BulkPOResult>("/purchase-orders/bulk-receive", { po_ids })

export const bulkCancelPOs = (po_ids: string[]) =>
  apiClient.post<BulkPOResult>("/purchase-orders/bulk-cancel", { po_ids })
