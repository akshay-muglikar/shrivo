import apiClient from "@/lib/api-client"

export interface ContactLeadCreate {
  name: string
  email: string
  phone?: string | null
  business_name?: string | null
  message: string
}

export interface ContactLead {
  id: string
  name: string
  email: string
  phone: string | null
  business_name: string | null
  message: string
  status: "open" | "closed"
  created_at: string
}

export const createContactLead = (data: ContactLeadCreate) =>
  apiClient.post<{ id: string; status: string }>("/contact/leads", data)

export const getContactLeads = () =>
  apiClient.get<ContactLead[]>("/contact/leads")

export const closeContactLead = (id: string) =>
  apiClient.patch<{ id: string; status: string }>(`/contact/leads/${id}/close`)