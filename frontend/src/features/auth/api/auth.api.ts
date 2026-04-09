import apiClient from "@/lib/api-client"

export const loginApi = (email: string, password: string) =>
  apiClient.post<{ access_token: string }>("/auth/login", { email, password })

export const getMeApi = () =>
  apiClient.get<{ id: string; name: string; email: string; is_owner: boolean }>("/auth/me")
