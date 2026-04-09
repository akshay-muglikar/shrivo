import apiClient from "@/lib/api-client"

export interface TicketCreate {
  subject: string
  message: string
}

export interface SupportTicket {
  id: string
  subject: string
  message: string
  status: "open" | "closed"
  submitted_by_name: string | null
  submitted_by_email: string | null
  created_at: string
}

export const createTicket = (data: TicketCreate) =>
  apiClient.post<{ id: string; status: string }>("/support/tickets", data)

export const getTickets = () =>
  apiClient.get<SupportTicket[]>("/support/tickets")

export const closeTicket = (id: string) =>
  apiClient.patch(`/support/tickets/${id}/close`)
