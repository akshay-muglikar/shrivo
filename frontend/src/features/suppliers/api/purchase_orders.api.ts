import apiClient from "@/lib/api-client"
import type { PaginatedResponse } from "@/types/pagination"

export interface POItem {
  id: string
  product_id: string | null
  product_name: string
  quantity: number
  unit_cost: string
  line_total: string
  received_quantity: number | null
  batch_number: string | null
  expiry_date: string | null
}

export interface PurchaseOrder {
  id: string
  po_number: string
  supplier: { id: string; name: string }
  status: "draft" | "ordered" | "received" | "cancelled"
  notes: string | null
  supplier_invoice_no: string | null
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

export interface SupplierReturnItem {
  id: string
  product_id: string | null
  batch_id: string | null
  product_name: string
  quantity: number
  unit_cost: string
  line_total: string
  batch_number: string | null
  expiry_date: string | null
}

export interface SupplierReturn {
  id: string
  return_number: string
  supplier: { id: string; name: string }
  supplier_credit_note_no: string | null
  notes: string | null
  total_amount: string
  created_at: string
  items: SupplierReturnItem[]
}

export interface SupplierReturnItemCreate {
  product_id?: string | null
  product_name: string
  quantity: number
  unit_cost: number
  batch_id?: string | null
}

export interface SupplierReturnCreate {
  supplier_credit_note_no?: string | null
  notes?: string | null
  items: SupplierReturnItemCreate[]
}

export const getPurchaseOrders = (params?: Record<string, unknown>) =>
  apiClient.get<PaginatedResponse<PurchaseOrderListItem>>("/purchase-orders", { params })

export const getPurchaseOrder = (id: string) =>
  apiClient.get<PurchaseOrder>(`/purchase-orders/${id}`)

export const createPurchaseOrder = (data: PurchaseOrderCreate) =>
  apiClient.post<PurchaseOrder>("/purchase-orders", data)

export const updatePurchaseOrder = (id: string, data: { status?: string; notes?: string | null }) =>
  apiClient.patch<PurchaseOrder>(`/purchase-orders/${id}`, data)

export interface ReceivePOItemInput {
  po_item_id: string
  batch_number?: string | null
  expiry_date?: string | null
  received_quantity?: number | null
}

export interface ReceivePurchaseOrderInput {
  supplier_invoice_no?: string | null
  items?: ReceivePOItemInput[]
}

export const receivePurchaseOrder = (id: string, data?: ReceivePurchaseOrderInput) =>
  apiClient.post<PurchaseOrder>(`/purchase-orders/${id}/receive`, data ?? {})

export const deletePurchaseOrder = (id: string) =>
  apiClient.delete(`/purchase-orders/${id}`)

export const recordPayment = (supplierId: string, data: { amount: number; notes?: string | null }) =>
  apiClient.post<SupplierPayment>(`/suppliers/${supplierId}/payments`, data)

export const getPayments = (supplierId: string) =>
  apiClient.get<SupplierPayment[]>(`/suppliers/${supplierId}/payments`)

export const getSupplierReturns = (supplierId: string) =>
  apiClient.get<SupplierReturn[]>(`/suppliers/${supplierId}/returns`)

export const createSupplierReturn = (supplierId: string, data: SupplierReturnCreate) =>
  apiClient.post<SupplierReturn>(`/suppliers/${supplierId}/returns`, data)

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
