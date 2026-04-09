import apiClient from "@/lib/api-client"

export interface AppUser {
  id: string
  name: string
  email: string
  is_owner: boolean
}

export interface UserCreate {
  name: string
  email: string
  password: string
  is_owner: boolean
}

export interface UserUpdate {
  name?: string
  email?: string
  password?: string
  is_owner?: boolean
}

export const getUsers = () =>
  apiClient.get<AppUser[]>("/users")

export const createUser = (data: UserCreate) =>
  apiClient.post<AppUser>("/users", data)

export const updateUser = (id: string, data: UserUpdate) =>
  apiClient.patch<AppUser>(`/users/${id}`, data)

export const deleteUser = (id: string) =>
  apiClient.delete(`/users/${id}`)
