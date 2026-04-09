import apiClient from "@/lib/api-client"
import type { PaginatedResponse } from "@/types/pagination"

export interface Expense {
  id: string
  title: string
  category: string | null
  amount: string
  expense_date: string
  notes: string | null
  created_at: string
}

export interface ExpenseCreate {
  title: string
  category?: string | null
  amount: number
  expense_date: string
  notes?: string | null
}

export interface ExpenseUpdate {
  title?: string | null
  category?: string | null
  amount?: number
  expense_date?: string
  notes?: string | null
}

export const getExpenses = (params?: Record<string, unknown>) =>
  apiClient.get<PaginatedResponse<Expense>>("/expenses", { params })

export const createExpense = (data: ExpenseCreate) =>
  apiClient.post<Expense>("/expenses", data)

export const updateExpense = (id: string, data: ExpenseUpdate) =>
  apiClient.put<Expense>(`/expenses/${id}`, data)